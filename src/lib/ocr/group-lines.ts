import { unionBoxes, type Box } from '@/lib/geometry';
import { isSpacelessText } from '@/lib/languages';
import type { Bubble, OcrBlock, OcrLine } from './types';

/**
 * Lines separated by less than this many text sizes belong to the same block. All-caps
 * lettering is the tightest case: its boxes cover only the cap height, so ordinary line
 * spacing leaves a gap of almost one box height.
 */
const MAX_LINE_GAP = 1.3;
/** Lines outside bubbles whose text sizes differ more than this (e.g. a sound effect next to dialogue) stay apart. */
const MAX_SIZE_RATIO = 1.8;

interface PlacedLine extends OcrLine {
  bubble: Bubble | null;
}

/**
 * Groups OCR lines into blocks, ordered top to bottom. `bubbles[i]` is the closed speech
 * bubble around `lines[i]`, if any: lines in the same bubble always form one block, and lines
 * in different bubbles never do — however close the bubbles are. Lines outside bubbles are
 * grouped by distance.
 */
export function groupLinesIntoBlocks(ocrLines: readonly OcrLine[], bubbles: readonly (Bubble | null)[]): OcrBlock[] {
  const lines: PlacedLine[] = ocrLines.map((line, index) => ({ ...line, bubble: bubbles[index] ?? null }));
  const parent = lines.map((_, index) => index);
  const root = (index: number): number => {
    while (parent[index] !== index) index = parent[index] = parent[parent[index]];
    return index;
  };

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      if (areNeighbours(lines[i], lines[j])) parent[root(i)] = root(j);
    }
  }

  const groups = new Map<number, PlacedLine[]>();
  lines.forEach((line, index) => {
    const group = groups.get(root(index));
    if (group) group.push(line);
    else groups.set(root(index), [line]);
  });

  return [...groups.values()].map(toBlock).sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
}

/** Glyph size: the height of a horizontal line or the width of a vertical column. */
function textSize(line: OcrLine): number {
  const { width, height } = line.box;
  return [...line.text].length === 1 ? Math.max(width, height) : Math.min(width, height);
}

function isVertical(line: OcrLine): boolean {
  return line.box.height > line.box.width * 1.2 && [...line.text].length > 1;
}

function sameBox(a: Box, b: Box): boolean {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  const overlap = Math.max(0, overlapX) * Math.max(0, overlapY);
  return overlap > 0.8 * Math.max(a.width * a.height, b.width * b.height);
}

function centreInside(line: OcrLine, box: Box): boolean {
  const x = line.box.x + line.box.width / 2;
  const y = line.box.y + line.box.height / 2;
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

/**
 * Lines are neighbours when they share a bubble, or — outside bubbles — when they have a
 * similar text size, overlap on one axis and are close on the other.
 */
function areNeighbours(a: PlacedLine, b: PlacedLine): boolean {
  if (a.bubble && b.bubble) return sameBox(a.bubble.box, b.bubble.box);
  if (a.bubble) return centreInside(b, a.bubble.box);
  if (b.bubble) return centreInside(a, b.bubble.box);
  const [small, large] = [textSize(a), textSize(b)].sort((x, y) => x - y);
  if (large > small * MAX_SIZE_RATIO) return false;
  const gapX = Math.max(a.box.x, b.box.x) - Math.min(a.box.x + a.box.width, b.box.x + b.box.width);
  const gapY = Math.max(a.box.y, b.box.y) - Math.min(a.box.y + a.box.height, b.box.y + b.box.height);
  const maxGap = MAX_LINE_GAP * Math.min(textSize(a), textSize(b));
  return (gapX < 0 && gapY <= maxGap) || (gapY < 0 && gapX <= maxGap);
}

function toBlock(lines: PlacedLine[]): OcrBlock {
  const vertical = lines.filter(isVertical).length > lines.length / 2;
  const ordered = [...lines].sort(
    vertical
      ? (a, b) => b.box.x + b.box.width - (a.box.x + a.box.width) // columns read right to left
      : (a, b) => a.box.y - b.box.y || a.box.x - b.box.x,
  );
  const texts = ordered.map((line) => line.text);
  const text = texts.join(isSpacelessText(texts.join('')) ? '' : ' ');
  const sizes = lines.map(textSize).sort((a, b) => a - b);

  return {
    text,
    box: unionBoxes(lines.map((line) => line.box)),
    textSize: Math.round(sizes[Math.floor(sizes.length / 2)] * glyphToFontSize(text)),
    bubble: lines[0].bubble,
  };
}

/** OCR boxes hug the glyphs; all-caps boxes cover only the cap height (about 70% of the font size). */
function glyphToFontSize(text: string): number {
  return /[A-Z]/.test(text) && !/[a-z]/.test(text) ? 1.4 : 1.1;
}
