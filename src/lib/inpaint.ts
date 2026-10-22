import type { Box } from './geometry';
import type { Bubble } from './ocr/types';
import { canvasToBlob, createCanvas, get2dContext } from './image';

/** Max luminance step between neighbouring background pixels (paper shading changes gradually). */
const BACKGROUND_STEP = 14;
/** Areas with less luminance contrast than this have no legible text to erase. */
const MIN_CONTRAST = 40;
/** Below this share of background pixels, a text area is treated as sitting on artwork. */
const MIN_FLAT_SHARE = 0.3;
/** A pixel is ink when it is within this fraction of the way from the ink tone to the background. */
const INK_THRESHOLD = 0.7;
/** An enclosed region with more ink than this share is a panel full of artwork, not a speech bubble. */
const MAX_BUBBLE_INK_SHARE = 0.22;

interface Frame {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AreaAnalysis {
  /** Pixel indices (in the whole image) to erase. */
  erase: number[];
  /** The speech bubble around the text, if it is fully enclosed. */
  bubble: Bubble | null;
}

const NEIGHBOURS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

async function readPixels(image: Blob) {
  const bitmap = await createImageBitmap(image);
  const canvas = createCanvas(bitmap.width, bitmap.height);
  const context = get2dContext(canvas, { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return { canvas, context, pixels: context.getImageData(0, 0, canvas.width, canvas.height) };
}

/** The speech bubble enclosing each text area, or null where the text is not in a closed bubble. */
export async function findBubbles(image: Blob, areas: readonly Box[]): Promise<(Bubble | null)[]> {
  const { pixels } = await readPixels(image);
  const lightness = luminanceMap(pixels);
  return areas.map((area) => analyzeArea(lightness, pixels.width, pixels.height, area).bubble);
}

/**
 * Erases the text inside `areas` and returns the cleaned page as a PNG. The erased pixels are
 * filled in from their surroundings, so off-white paper, shading and tones carry on smoothly.
 */
/** An area whose original text is erased. */
export interface EraseArea {
  box: Box;
  /**
   * Erase exactly the ink inside the box (an area drawn by hand), rather than whole glyphs
   * near it (an area found by OCR, whose box may cut through letters).
   */
  exact: boolean;
}

export async function eraseText(image: Blob, areas: readonly EraseArea[]): Promise<Blob> {
  const { canvas, context, pixels } = await readPixels(image);
  const lightness = luminanceMap(pixels);
  const mask = new Uint8Array(pixels.width * pixels.height);
  for (const area of areas) {
    for (const index of analyzeArea(lightness, pixels.width, pixels.height, area.box, area.exact).erase) mask[index] = 1;
  }
  fillFromSurroundings(pixels, mask);
  context.putImageData(pixels, 0, 0);
  return canvasToBlob(canvas, 'image/png');
}

function luminanceMap({ data, width, height }: ImageData): Uint8Array {
  const map = new Uint8Array(width * height);
  for (let index = 0; index < map.length; index++) {
    const offset = index * 4;
    map[index] = (data[offset] * 299 + data[offset + 1] * 587 + data[offset + 2] * 114) / 1000;
  }
  return map;
}

function percentile(histogram: Uint32Array, total: number, fraction: number): number {
  let count = 0;
  for (let value = 0; value < histogram.length; value++) {
    count += histogram[value];
    if (count >= total * fraction) return value;
  }
  return histogram.length - 1;
}

/** `box` grown by `margin` and clipped to the image. */
function frameAround(box: Box, margin: number, imageWidth: number, imageHeight: number): Frame {
  const left = Math.max(0, Math.floor(box.x - margin));
  const top = Math.max(0, Math.floor(box.y - margin));
  const right = Math.min(imageWidth, Math.ceil(box.x + box.width + margin));
  const bottom = Math.min(imageHeight, Math.ceil(box.y + box.height + margin));
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

/**
 * Works out what to erase for one text area. Background is flood-filled outwards from the
 * text, stepping only between similar neighbouring pixels so uneven lighting is followed but
 * outlines stop it. Whatever that background encloses — the glyphs and their soft edges — is
 * text. If the background itself is closed off, it is a speech bubble.
 */
function analyzeArea(
  lightness: Uint8Array,
  imageWidth: number,
  imageHeight: number,
  area: Box,
  exact = false,
): AreaAnalysis {
  const none = { erase: [], bubble: null };
  const text = frameAround(area, 3, imageWidth, imageHeight);
  if (text.width === 0 || text.height === 0) return none;

  const histogram = new Uint32Array(256);
  for (let y = text.top; y < text.top + text.height; y++) {
    for (let x = text.left; x < text.left + text.width; x++) histogram[lightness[y * imageWidth + x]]++;
  }
  const total = text.width * text.height;
  const lightBackground = percentile(histogram, total, 0.5) >= 128;
  const background = percentile(histogram, total, lightBackground ? 0.85 : 0.15);
  const ink = percentile(histogram, total, lightBackground ? 0.02 : 0.98);
  if (Math.abs(background - ink) < MIN_CONTRAST) return none;
  // Pixels this close to the background tone may seed the fill.
  const seedTolerance = Math.abs(background - ink) * 0.25;

  // Room for the whole bubble around even a short line.
  const frame = frameAround(area, Math.min(400, Math.max(60, 2 * Math.max(area.width, area.height))), imageWidth, imageHeight);
  const size = frame.width * frame.height;
  const toGlobal = (local: number) => {
    const x = local % frame.width;
    return (frame.top + (local - x) / frame.width) * imageWidth + frame.left + x;
  };
  const inText = (local: number) => {
    const x = frame.left + (local % frame.width);
    const y = frame.top + Math.floor(local / frame.width);
    return x >= text.left && x < text.left + text.width && y >= text.top && y < text.top + text.height;
  };

  // 1. Background: grow from background-toned pixels of the text area through similar
  // neighbours. Seeds on either side of an outline grow separate regions; only the one covering
  // most of the text area is the text's background, so outlines never end up enclosed.
  const label = new Int32Array(size);
  const coverage: number[] = [0];
  for (let seed = 0; seed < size; seed++) {
    if (label[seed] || !inText(seed) || Math.abs(lightness[toGlobal(seed)] - background) > seedTolerance) continue;
    const id = coverage.length;
    let covered = 0;
    label[seed] = id;
    const queue = [seed];
    for (let head = 0; head < queue.length; head++) {
      const local = queue[head];
      if (inText(local)) covered++;
      const value = lightness[toGlobal(local)];
      const x = local % frame.width;
      const y = (local - x) / frame.width;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= frame.width || ny >= frame.height) continue;
        const next = ny * frame.width + nx;
        if (label[next]) continue;
        const nextValue = lightness[toGlobal(next)];
        const darker = lightBackground ? nextValue < value : nextValue > value;
        // Shading may drift both ways, but a step towards the ink tone must be small.
        if (Math.abs(nextValue - value) > (darker ? BACKGROUND_STEP : BACKGROUND_STEP * 2)) continue;
        if (Math.abs(nextValue - background) > Math.abs(background - ink) * 0.5) continue;
        label[next] = id;
        queue.push(next);
      }
    }
    coverage.push(covered);
  }
  const best = coverage.indexOf(Math.max(...coverage));
  const isBackground = Uint8Array.from(label, (id) => (best > 0 && id === best ? 1 : 0));

  const textPixels = Array.from({ length: size }, (_, local) => local).filter(inText);
  const flatShare = textPixels.filter((local) => isBackground[local]).length / textPixels.length;
  if (flatShare < MIN_FLAT_SHARE) {
    return { erase: inkPixels(lightness, imageWidth, text, lightBackground, background, ink), bubble: null };
  }

  // 2. Everything not reachable from the frame's border without crossing background is enclosed.
  const border: number[] = [];
  for (let x = 0; x < frame.width; x++) border.push(x, (frame.height - 1) * frame.width + x);
  for (let y = 0; y < frame.height; y++) border.push(y * frame.width, y * frame.width + frame.width - 1);
  const outside = new Uint8Array(size);
  const outsideQueue = border.filter((local) => !isBackground[local]);
  outsideQueue.forEach((local) => (outside[local] = 1));
  for (let head = 0; head < outsideQueue.length; head++) {
    const local = outsideQueue[head];
    const x = local % frame.width;
    const y = (local - x) / frame.width;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= frame.width || ny >= frame.height) continue;
      const next = ny * frame.width + nx;
      if (!outside[next] && !isBackground[next]) {
        outside[next] = 1;
        outsideQueue.push(next);
      }
    }
  }

  // A bubble must also contain the text: a box straddling an outline (e.g. a sound effect over
  // a bubble's edge) is not "in" that bubble.
  const inside = textPixels.filter((local) => !outside[local]).length / textPixels.length;
  let enclosedInk = 0;
  let enclosedArea = 0;
  for (let local = 0; local < size; local++) {
    if (outside[local]) continue;
    enclosedArea++;
    if (!isBackground[local]) enclosedInk++;
  }
  const enclosed =
    !border.some((local) => isBackground[local]) && inside >= 0.9 && enclosedInk <= enclosedArea * MAX_BUBBLE_INK_SHARE;

  return {
    erase: glyphPixels(frame, isBackground, outside, text, area, toGlobal, exact),
    bubble: enclosed ? bubbleBody(frame, outside) : null,
  };
}

/**
 * The ink to erase: each connected blob of ink that lies entirely near the text, grown by a
 * pixel to take the blurry rim of its glyphs. Blobs reaching further — a bubble's outline,
 * artwork — are left alone.
 *
 * For OCR'd text only enclosed blobs count (glyphs surrounded by the bubble or paper). For an
 * area drawn by hand (`exact`) any blob touching the area counts, even one cut off by the edge
 * of the page or touching other ink, because the user marked it as text to erase.
 */
function glyphPixels(
  frame: Frame,
  isBackground: Uint8Array,
  outside: Uint8Array,
  text: Frame,
  area: Box,
  toGlobal: (local: number) => number,
  exact: boolean,
): number[] {
  const pad = exact
    ? Math.min(12, Math.max(3, 0.25 * Math.min(area.width, area.height)))
    : Math.min(24, Math.max(6, 0.5 * Math.min(area.width, area.height)));
  const minX = text.left - pad - frame.left;
  const minY = text.top - pad - frame.top;
  const maxX = text.left + text.width + pad - frame.left;
  const maxY = text.top + text.height + pad - frame.top;
  const inArea = (x: number, y: number) =>
    x >= text.left - frame.left && x < text.left + text.width - frame.left &&
    y >= text.top - frame.top && y < text.top + text.height - frame.top;
  const isInk = exact ? (local: number) => !isBackground[local] : (local: number) => !isBackground[local] && !outside[local];

  const erase = new Set<number>();
  const seen = new Uint8Array(isBackground.length);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !isInk(start)) continue;
    const blob = [start];
    seen[start] = 1;
    let fits = true;
    let touchesArea = false;
    for (let head = 0; head < blob.length; head++) {
      const local = blob[head];
      const x = local % frame.width;
      const y = (local - x) / frame.width;
      if (x < minX || x >= maxX || y < minY || y >= maxY) fits = false;
      if (inArea(x, y)) touchesArea = true;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(frame.height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(frame.width - 1, x + 1); nx++) {
          const next = ny * frame.width + nx;
          if (!seen[next] && isInk(next)) {
            seen[next] = 1;
            blob.push(next);
          }
        }
      }
    }
    if (!fits || (exact && !touchesArea)) continue;
    for (const local of blob) {
      erase.add(toGlobal(local));
      const x = local % frame.width;
      const y = (local - x) / frame.width;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(frame.height - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(frame.width - 1, x + 1); nx++) {
          const neighbour = ny * frame.width + nx;
          if (isBackground[neighbour]) erase.add(toGlobal(neighbour));
        }
      }
    }
  }
  return [...erase];
}

/**
 * The main body of a bubble, ignoring its tail. A bubble that fills nearly all of its bounding
 * box is rectangular (a caption box). Otherwise it is taken as the ellipse with the same centre
 * and spread as the enclosed area — a filled ellipse's semi-axes are twice its standard
 * deviations — clipped to the area's bounds.
 */
function bubbleBody(frame: Frame, outside: Uint8Array): Bubble {
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumYY = 0;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (let local = 0; local < outside.length; local++) {
    if (outside[local]) continue;
    const x = local % frame.width;
    const y = (local - x) / frame.width;
    count++;
    sumX += x;
    sumY += y;
    sumXX += x * x;
    sumYY += y * y;
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x + 1);
    bottom = Math.max(bottom, y + 1);
  }
  if (count > 0.9 * (right - left) * (bottom - top)) {
    return { shape: 'rect', box: { x: frame.left + left, y: frame.top + top, width: right - left, height: bottom - top } };
  }
  const centerX = sumX / count;
  const centerY = sumY / count;
  const radiusX = 2 * Math.sqrt(Math.max(0, sumXX / count - centerX * centerX));
  const radiusY = 2 * Math.sqrt(Math.max(0, sumYY / count - centerY * centerY));
  const x0 = Math.max(left, centerX - radiusX);
  const y0 = Math.max(top, centerY - radiusY);
  const x1 = Math.min(right, centerX + radiusX);
  const y1 = Math.min(bottom, centerY + radiusY);
  return { shape: 'ellipse', box: { x: frame.left + x0, y: frame.top + y0, width: x1 - x0, height: y1 - y0 } };
}

/** Ink pixels of a text area on artwork, grown by one pixel. */
function inkPixels(
  lightness: Uint8Array,
  imageWidth: number,
  area: Frame,
  lightBackground: boolean,
  background: number,
  ink: number,
): number[] {
  const threshold = ink + (background - ink) * INK_THRESHOLD;
  const imageHeight = lightness.length / imageWidth;
  const marked = new Set<number>();
  for (let y = area.top; y < area.top + area.height; y++) {
    for (let x = area.left; x < area.left + area.width; x++) {
      const value = lightness[y * imageWidth + x];
      if (lightBackground ? value >= threshold : value <= threshold) continue;
      for (let ny = Math.max(0, y - 1); ny <= Math.min(imageHeight - 1, y + 1); ny++) {
        for (let nx = Math.max(0, x - 1); nx <= Math.min(imageWidth - 1, x + 1); nx++) {
          marked.add(ny * imageWidth + nx);
        }
      }
    }
  }
  return [...marked];
}

/**
 * Fills masked pixels from the outside in, each taking the average of its already-known
 * neighbours, then softens the result — so shading and tones carry on into the hole.
 */
function fillFromSurroundings(image: ImageData, mask: Uint8Array): void {
  const { width, height, data } = image;
  const known = mask.map((value) => (value ? 0 : 1));
  const filled: number[] = [];

  const neighboursOf = (index: number) => {
    const x = index % width;
    const y = (index - x) / width;
    return NEIGHBOURS.flatMap(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < width && ny < height ? [ny * width + nx] : [];
    });
  };

  const averageAround = (index: number, onlyKnown: boolean): [number, number, number] => {
    const x = index % width;
    const y = (index - x) / width;
    const sum = [0, 0, 0];
    let count = 0;
    for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
      for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
        const neighbour = ny * width + nx;
        if (onlyKnown && !known[neighbour]) continue;
        sum[0] += data[neighbour * 4];
        sum[1] += data[neighbour * 4 + 1];
        sum[2] += data[neighbour * 4 + 2];
        count++;
      }
    }
    return [sum[0] / count, sum[1] / count, sum[2] / count];
  };

  let frontier: number[] = [];
  for (let index = 0; index < mask.length; index++) {
    if (mask[index] && neighboursOf(index).some((neighbour) => known[neighbour])) frontier.push(index);
  }

  while (frontier.length > 0) {
    const colors = frontier.map((index) => averageAround(index, true));
    frontier.forEach((index, i) => {
      data.set(colors[i], index * 4);
      known[index] = 1;
    });
    filled.push(...frontier);
    const next = new Set<number>();
    for (const index of frontier) {
      for (const neighbour of neighboursOf(index)) if (!known[neighbour]) next.add(neighbour);
    }
    frontier = [...next];
  }

  for (let pass = 0; pass < 2; pass++) {
    const colors = filled.map((index) => averageAround(index, false));
    filled.forEach((index, i) => data.set(colors[i], index * 4));
  }
}
