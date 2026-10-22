import { DEFAULT_FONT_ID, type FontId } from './fonts';
import { clampBox, expandBox, roundBox, type Box, type Point, type Shape, type Size } from './geometry';
import type { EraseArea } from './inpaint';
import type { Bubble, OcrBlock } from './ocr/types';

export type TextAlign = 'left' | 'center' | 'right';

export interface TextStyle {
  fontId: FontId;
  /** In page pixels. */
  fontSize: number;
  /** Multiple of the font size. */
  lineHeight: number;
  bold: boolean;
  italic: boolean;
  align: TextAlign;
  color: string;
  strokeColor: string;
  /** Outline width in page pixels; 0 disables it. */
  strokeWidth: number;
  backgroundColor: string;
  /** 0–1; 0 disables the background. */
  backgroundOpacity: number;
}

export interface TextLayer {
  id: string;
  /** Text recognized by OCR. */
  sourceText: string;
  /** Text drawn on the page — normally the translation. Empty until translated. */
  text: string;
  /** Where the text is drawn, in page pixels. Rotation is applied around the box centre. */
  box: Box;
  /** `ellipse` shapes the lines to the oval inscribed in the box, as in a round speech bubble. */
  shape: Shape;
  rotation: number;
  style: TextStyle;
  /** Where the original text was. Null for layers added by hand. */
  sourceBox: Box | null;
  /** Whether the original text in `sourceBox` is erased when the page is cleaned. */
  erase: boolean;
}

export interface Page extends Size {
  id: string;
  name: string;
  layers: TextLayer[];
  /** Areas the user marked by hand for erasing (original text that OCR missed). */
  manualEraseAreas: Box[];
  original: Blob;
  /** The page with its original text erased. */
  cleaned: Blob | null;
  /** Object URLs of `original` and `cleaned`. */
  originalUrl: string;
  cleanedUrl: string | null;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontId: DEFAULT_FONT_ID,
  fontSize: 28,
  lineHeight: 1.2,
  bold: false,
  italic: false,
  align: 'center',
  color: '#111111',
  strokeColor: '#ffffff',
  strokeWidth: 3,
  backgroundColor: '#ffffff',
  backgroundOpacity: 0,
};

export function createId(): string {
  // randomUUID is only available in secure contexts (https or localhost).
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function createLayerFromOcr(block: OcrBlock, page: Size): TextLayer {
  return {
    id: createId(),
    sourceText: block.text,
    text: '',
    box: block.bubble ? textBoxForBubble(block.bubble) : textBoxForBlock(block.box, page),
    shape: block.bubble?.shape ?? 'rect',
    rotation: 0,
    style: { ...DEFAULT_TEXT_STYLE, fontSize: block.textSize },
    sourceBox: block.box,
    erase: true,
  };
}



/** A new hand-made text layer centred on `center`. */
export function createBlankLayer(center: Point, page: Size): TextLayer {
  const width = Math.round(page.width * 0.3);
  const height = Math.round(width * 0.45);
  return {
    id: createId(),
    sourceText: '',
    text: 'ข้อความใหม่',
    box: roundBox(clampBox({ x: center.x - width / 2, y: center.y - height / 2, width, height }, page)),
    shape: 'rect',
    rotation: 0,
    style: { ...DEFAULT_TEXT_STYLE, fontSize: Math.max(16, Math.round(page.width / 32)) },
    sourceBox: null,
    erase: false,
  };
}

export function duplicateLayer(layer: TextLayer): TextLayer {
  const offset = Math.round(layer.style.fontSize / 2);
  return {
    ...layer,
    id: createId(),
    box: { ...layer.box, x: layer.box.x + offset, y: layer.box.y + offset },
    sourceBox: null,
    erase: false,
  };
}

/** Everything erased when the page is cleaned: the chosen text boxes and the areas drawn by hand. */
export function areasToErase(page: Pick<Page, 'layers' | 'manualEraseAreas'>): EraseArea[] {
  return [
    ...page.layers.flatMap((layer) => (layer.erase && layer.sourceBox ? [{ box: layer.sourceBox, exact: false }] : [])),
    ...page.manualEraseAreas.map((box) => ({ box, exact: true })),
  ];
}

/** The bubble's body with some breathing room along its outline. */
function textBoxForBubble({ box, shape }: Bubble): Box {
  const padding = shape === 'ellipse' ? 0.1 : 0.08;
  return roundBox(expandBox(box, -box.width * padding, -box.height * padding));
}

/** OCR boxes hug the original glyphs; give the translation a little more room. */
function textBoxForBlock(source: Box, page: Size): Box {
  // Vertical CJK columns are tall and narrow; widen them for horizontal text.
  const width = source.height > source.width * 1.5 ? source.height * 0.8 : source.width;
  const box = { ...source, x: source.x - (width - source.width) / 2, width };
  return roundBox(clampBox(expandBox(box, box.width * 0.06, box.height * 0.1), page));
}
