import { removeSpacesBetweenCjk, type SourceLanguage } from '@/lib/languages';
import type { OcrLine } from './types';

const TESSERACT_LANGUAGES: Record<Exclude<SourceLanguage, 'auto'>, string> = {
  ja: 'jpn',
  ko: 'kor',
  'zh-CN': 'chi_sim',
  'zh-TW': 'chi_tra',
  en: 'eng',
};

/** Lines Tesseract is less sure about than this are mostly noise from artwork. */
const MIN_CONFIDENCE = 40;

/**
 * Offline OCR in the browser. Less accurate on manga than OCR.space — it finds vertical
 * Japanese text but reads it in the wrong order — and downloads language data on first use.
 */
export async function recognizeWithTesseract(
  image: Blob,
  language: Exclude<SourceLanguage, 'auto'>,
): Promise<OcrLine[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker(TESSERACT_LANGUAGES[language]);
  try {
    const { data } = await worker.recognize(image, {}, { blocks: true });
    return (data.blocks ?? [])
      .flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines))
      .filter((line) => line.confidence >= MIN_CONFIDENCE && /\p{L}/u.test(line.text))
      .map((line) => ({
        text: removeSpacesBetweenCjk(line.text.trim()),
        box: {
          x: line.bbox.x0,
          y: line.bbox.y0,
          width: line.bbox.x1 - line.bbox.x0,
          height: line.bbox.y1 - line.bbox.y0,
        },
      }));
  } finally {
    await worker.terminate();
  }
}
