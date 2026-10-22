import { OCR_MAX_UPLOAD_BYTES, requestOcr } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { findBubbles } from '@/lib/inpaint';
import { canvasToBlob, createCanvas, get2dContext } from '@/lib/image';
import type { SourceLanguage } from '@/lib/languages';
import { groupLinesIntoBlocks } from './group-lines';
import { recognizeWithTesseract } from './tesseract';
import type { OcrBlock, OcrLine } from './types';

/** Tall pages (webtoons) are read in slices so the text is not shrunk to fit the upload limit. */
const MAX_SLICE_HEIGHT = 2400;
/** Must exceed the tallest line of text, so every line lies fully inside some slice. */
const SLICE_OVERLAP = 300;
/** Narrow pages (phone photos, small scans) are enlarged up to this width, at most 2×, before OCR. */
const MIN_OCR_WIDTH = 1000;

export type OcrEngine = 'ocr-space' | 'tesseract';

interface Slice {
  top: number;
  height: number;
  /** Lines centred in [keepFrom, keepTo) belong to this slice; the rest are left to its neighbours. */
  keepFrom: number;
  keepTo: number;
}

/**
 * Finds the text on a page with OCR.space. If that fails and the source language is known,
 * falls back to Tesseract in the browser (it cannot detect the language by itself).
 */
export async function extractText(
  image: Blob,
  language: SourceLanguage,
): Promise<{ blocks: OcrBlock[]; engine: OcrEngine }> {
  let lines: OcrLine[];
  let engine: OcrEngine = 'ocr-space';
  try {
    lines = await recognizeOnline(image, language);
  } catch (error) {
    if (language === 'auto') {
      throw new Error(`${errorMessage(error)} (หรือเลือกภาษาต้นฉบับ เพื่อใช้ระบบอ่านข้อความสำรองในเครื่อง)`);
    }
    console.warn('OCR.space failed; falling back to Tesseract.', error);
    lines = await recognizeWithTesseract(image, language);
    engine = 'tesseract';
  }
  const bubbles = await findBubbles(
    image,
    lines.map((line) => line.box),
  );
  return { blocks: groupLinesIntoBlocks(lines, bubbles), engine };
}

async function recognizeOnline(image: Blob, language: SourceLanguage): Promise<OcrLine[]> {
  const bitmap = await createImageBitmap(image);
  try {
    const lines: OcrLine[] = [];
    for (const slice of planSlices(bitmap.height)) {
      const { upload, scale } = await encodeSlice(bitmap, slice);
      for (const line of await requestOcr(upload, language)) {
        const box = {
          x: line.box.x / scale,
          y: line.box.y / scale + slice.top,
          width: line.box.width / scale,
          height: line.box.height / scale,
        };
        const centerY = box.y + box.height / 2;
        if (centerY >= slice.keepFrom && centerY < slice.keepTo) lines.push({ text: line.text, box });
      }
    }
    return lines;
  } finally {
    bitmap.close();
  }
}

function planSlices(pageHeight: number): Slice[] {
  const slices: Slice[] = [];
  for (let top = 0; ; top += MAX_SLICE_HEIGHT - SLICE_OVERLAP) {
    const bottom = Math.min(top + MAX_SLICE_HEIGHT, pageHeight);
    slices.push({
      top,
      height: bottom - top,
      keepFrom: top === 0 ? 0 : top + SLICE_OVERLAP / 2,
      keepTo: bottom === pageHeight ? pageHeight : bottom - SLICE_OVERLAP / 2,
    });
    if (bottom === pageHeight) return slices;
  }
}

/**
 * Encodes a slice under the upload limit: enlarged if the page is narrow, as PNG where it fits
 * (OCR.space often misses vertical text in browser-encoded JPEGs), else as JPEG, and scaled
 * down only as a last resort.
 */
async function encodeSlice(bitmap: ImageBitmap, slice: Slice): Promise<{ upload: Blob; scale: number }> {
  let scale = Math.min(2, Math.max(1, MIN_OCR_WIDTH / bitmap.width));
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = createCanvas(Math.round(bitmap.width * scale), Math.round(slice.height * scale));
    const context = get2dContext(canvas);
    context.fillStyle = '#ffffff'; // flatten transparency, which OCR may read as black
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, slice.top, bitmap.width, slice.height, 0, 0, canvas.width, canvas.height);

    const actualScale = canvas.width / bitmap.width;
    const png = await canvasToBlob(canvas, 'image/png');
    if (png.size <= OCR_MAX_UPLOAD_BYTES) return { upload: png, scale: actualScale };
    const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    if (jpeg.size <= OCR_MAX_UPLOAD_BYTES) return { upload: jpeg, scale: actualScale };
    scale *= Math.sqrt(OCR_MAX_UPLOAD_BYTES / jpeg.size) * 0.9;
  }
  throw new Error('ภาพใหญ่เกินกว่าจะส่งไปอ่านข้อความได้');
}
