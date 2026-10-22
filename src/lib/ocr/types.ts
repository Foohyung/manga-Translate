import type { Box, Shape } from '@/lib/geometry';

/** One line (or vertical column) of text found by OCR, in page pixels. */
export interface OcrLine {
  text: string;
  box: Box;
}

/** A closed speech bubble: the area of its main body (without the tail) and its rough shape. */
export interface Bubble {
  box: Box;
  shape: Shape;
}

/** Neighbouring lines merged into one block — usually a speech bubble. */
export interface OcrBlock {
  text: string;
  box: Box;
  /** Estimated font size of the original text, in page pixels. */
  textSize: number;
  /** The closed speech bubble around the block, if there is one. */
  bubble: Bubble | null;
}
