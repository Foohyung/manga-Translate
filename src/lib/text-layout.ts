import { fontFamily } from './fonts';
import type { Box, Shape, Size } from './geometry';
import type { TextLayer, TextStyle } from './project';

// Line breaking and drawing shared by the editor preview and the exported image,
// so both wrap text at exactly the same places.

const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Closing punctuation (and Thai ๆ ฯ) that typesetters never put at the start of a line. */
const NO_LINE_START = /^[\s.,!?;:…、。，！？）」』】〉》)\]}"'”’ๆฯ~ー-]+$/u;

export interface LayoutLine {
  text: string;
  /** Width available to the line; the slot is centred horizontally in the box. */
  width: number;
}

export interface TextLayout {
  lines: LayoutLine[];
  lineHeight: number;
  /** False when the text overflows its box at this size. */
  fits: boolean;
}

let measureContext: CanvasRenderingContext2D | null = null;

function measurer(font: string): (text: string) => number {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) throw new Error('เบราว์เซอร์นี้ไม่รองรับการวาดภาพ (Canvas)');
  const context = measureContext;
  context.font = font;
  return (text) => context.measureText(text).width;
}

export function cssFont(style: TextStyle, fontSize = style.fontSize): string {
  return `${style.italic ? 'italic ' : ''}${style.bold ? 700 : 400} ${fontSize}px ${fontFamily(style.fontId)}`;
}

export function lineHeightOf(style: TextStyle): number {
  return style.fontSize * style.lineHeight;
}

export function backgroundRadius(box: Box, shape: Shape): number {
  return shape === 'ellipse' ? Math.min(box.width, box.height) / 2 : Math.min(box.width, box.height) * 0.15;
}

/**
 * Breaks text into lines, line `i` being at most `widthOf(i)` wide. Lines break between words
 * — using the browser's dictionary-based segmentation, which handles Thai and CJK — a word too
 * wide for any line is split between characters, and closing punctuation stays with the word
 * before it.
 */
function wrapLines(text: string, font: string, widthOf: (index: number) => number): string[] {
  const measure = measurer(font);
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const { segment } of wordSegmenter.segment(paragraph)) {
      const candidate = line + segment;
      if (measure(candidate.trimEnd()) <= widthOf(lines.length) || (line.trim() && NO_LINE_START.test(segment))) {
        line = candidate;
        continue;
      }
      if (line.trim()) lines.push(line.trimEnd());
      const pieces = splitWord(segment.trimStart(), widthOf(lines.length), measure);
      line = pieces.pop() ?? '';
      lines.push(...pieces);
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

function splitWord(word: string, maxWidth: number, measure: (text: string) => number): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const { segment } of graphemeSegmenter.segment(word)) {
    if (piece && measure(piece + segment) > maxWidth) {
      pieces.push(piece);
      piece = segment;
    } else {
      piece += segment;
    }
  }
  pieces.push(piece);
  return pieces;
}

/**
 * Width of the oval inscribed in `box` across line `index` of `count` lines centred
 * vertically — measured at the line's glyph edge farthest from the middle.
 */
function chordWidth(box: Size, style: TextStyle, count: number, index: number): number {
  const lineHeight = lineHeightOf(style);
  const halfHeight = box.height / 2;
  const glyphTop = halfHeight - (count * lineHeight) / 2 + index * lineHeight + (lineHeight - style.fontSize) / 2;
  const offset = Math.max(Math.abs(glyphTop - halfHeight), Math.abs(glyphTop + style.fontSize - halfHeight));
  const ratio = Math.min(1, offset / halfHeight);
  return box.width * Math.sqrt(1 - ratio * ratio);
}

/**
 * Lays text out in its box. In an `ellipse`, each line gets the oval's width at its height —
 * short lines at the top and bottom, the longest in the middle, as letterers shape text in
 * round speech bubbles.
 */
export function layoutText(text: string, style: TextStyle, box: Size, shape: Shape): TextLayout {
  const font = cssFont(style);
  const lineHeight = lineHeightOf(style);
  const measure = measurer(font);
  const fitsBox = (lines: LayoutLine[]) =>
    lines.length * lineHeight <= box.height + 0.5 && lines.every((line) => measure(line.text) <= line.width + 0.5);

  if (shape === 'ellipse') {
    const maxLines = Math.max(1, Math.floor(box.height / lineHeight));
    for (let count = 1; count <= maxLines; count++) {
      const texts = wrapLines(text, font, (index) => chordWidth(box, style, count, index));
      if (texts.length > count) continue;
      // The text may need fewer lines than assumed; check it at its own height.
      const lines = texts.map((line, index) => ({ text: line, width: chordWidth(box, style, texts.length, index) }));
      if (fitsBox(lines)) return { lines, lineHeight, fits: true };
    }
    // Too much text for the oval: use the rectangle inscribed in it.
    const width = box.width * Math.SQRT1_2;
    const lines = wrapLines(text, font, () => width).map((line) => ({ text: line, width }));
    return { lines, lineHeight, fits: false };
  }

  const lines = wrapLines(text, font, () => box.width).map((line) => ({ text: line, width: box.width }));
  return { lines, lineHeight, fits: fitsBox(lines) };
}

/** The largest font size (up to `max`) at which the text fits its box and shape. */
export function fitFontSize(text: string, style: TextStyle, box: Box, shape: Shape, max = 200): number {
  let low = 6;
  let high = Math.max(low, Math.min(max, Math.floor(box.height / style.lineHeight)));
  let best = low;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    if (layoutText(text, { ...style, fontSize: middle }, box, shape).fits) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return best;
}

/** Makes sure the web fonts used by these styles are loaded before drawing on a canvas. */
export async function loadFonts(styles: readonly TextStyle[]): Promise<void> {
  const fonts = new Set(styles.map((style) => cssFont(style)));
  await Promise.all([...fonts].map((font) => document.fonts.load(font)));
}

/** Horizontal anchor of a line for canvas text drawing, within its centred slot. */
function anchorX(box: Size, line: LayoutLine, style: TextStyle): number {
  const slotLeft = (box.width - line.width) / 2;
  if (style.align === 'left') return slotLeft;
  if (style.align === 'right') return slotLeft + line.width;
  return box.width / 2;
}

export function drawTextLayer(context: CanvasRenderingContext2D, layer: TextLayer): void {
  const { box, style } = layer;
  const { lines, lineHeight } = layoutText(layer.text, style, box, layer.shape);

  context.save();
  context.translate(box.x + box.width / 2, box.y + box.height / 2);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.translate(-box.width / 2, -box.height / 2);

  if (style.backgroundOpacity > 0) {
    context.globalAlpha = style.backgroundOpacity;
    context.fillStyle = style.backgroundColor;
    context.beginPath();
    if (layer.shape === 'ellipse') {
      context.ellipse(box.width / 2, box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2);
    } else {
      context.roundRect(0, 0, box.width, box.height, backgroundRadius(box, layer.shape));
    }
    context.fill();
    context.globalAlpha = 1;
  }

  context.font = cssFont(style);
  context.textAlign = style.align;
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  const { fontBoundingBoxAscent: ascent, fontBoundingBoxDescent: descent } = context.measureText(layer.text);
  // Lines are centred vertically in the box, and each glyph run is centred in its line —
  // the same way CSS lays out the preview.
  const top = (box.height - lines.length * lineHeight) / 2;

  lines.forEach((line, index) => {
    const x = anchorX(box, line, style);
    const baseline = top + index * lineHeight + (lineHeight - ascent - descent) / 2 + ascent;
    if (style.strokeWidth > 0) {
      context.lineWidth = style.strokeWidth;
      context.strokeStyle = style.strokeColor;
      context.strokeText(line.text, x, baseline);
    }
    context.fillStyle = style.color;
    context.fillText(line.text, x, baseline);
  });

  context.restore();
}
