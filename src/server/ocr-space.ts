import { unionBoxes } from '@/lib/geometry';
import type { SourceLanguage } from '@/lib/languages';
import type { OcrLine } from '@/lib/ocr/types';

const ENDPOINT = 'https://api.ocr.space/parse/image';
/** Shared public demo key; set OCR_SPACE_API_KEY for a real (free) key. */
const DEMO_API_KEY = 'helloworld';
const TIMEOUT_MS = 20_000;

/** OCR.space language codes; null lets Engine 2 detect the language (and read vertical text). */
const LANGUAGE_CODES: Record<SourceLanguage, string | null> = {
  auto: null,
  ja: 'jpn',
  ko: 'kor',
  'zh-CN': 'chs',
  'zh-TW': 'cht',
  en: 'eng',
};

interface OcrSpaceWord {
  WordText: string;
  Left: number;
  Top: number;
  Width: number;
  Height: number;
}

interface OcrSpaceResponse {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string | string[];
  ParsedResults?: { TextOverlay?: { Lines?: { LineText?: string; Words?: OcrSpaceWord[] }[] } | null }[];
}

/** Pause before retrying a rate-limited request. */
const RETRY_DELAY_MS = 1500;
/** A line with no letters at all (dots, dashes, specks of artwork) is not text worth translating. */
const HAS_LETTER = /\p{L}/u;

/**
 * Reads text with Engine 2, which handles vertical CJK and gives accurate boxes (Engine 3's
 * boxes can be far enough off to erase artwork). Engine 2 occasionally returns nothing for a
 * page it reads fine on a second try, so an empty result is retried once.
 */
export async function recognizeWithOcrSpace(image: File, language: SourceLanguage): Promise<OcrLine[]> {
  const lines = await requestLines(image, language);
  return lines.length > 0 ? lines : requestLines(image, language);
}

async function requestLines(image: File, language: SourceLanguage): Promise<OcrLine[]> {
  const form = new FormData();
  form.append('file', image, image.name);
  form.append('OCREngine', '2');
  form.append('isOverlayRequired', 'true');
  form.append('scale', 'true');
  const code = LANGUAGE_CODES[language];
  if (code) form.append('language', code);

  const send = () =>
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { apikey: process.env.OCR_SPACE_API_KEY || DEMO_API_KEY },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  let response = await send();
  if (response.status === 429) {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    response = await send();
  }
  if (response.status === 429) {
    throw new Error('บริการอ่านข้อความถูกใช้งานเกินโควตาชั่วคราว กรุณารอสักครู่แล้วลองใหม่');
  }
  if (!response.ok) throw new Error(`OCR.space ตอบกลับด้วยสถานะ ${response.status}`);

  const result = (await response.json()) as OcrSpaceResponse;
  if (result.IsErroredOnProcessing) {
    const details = [result.ErrorMessage].flat().filter(Boolean).join(' ');
    throw new Error(details ? `OCR.space: ${details}` : 'OCR.space ประมวลผลไม่สำเร็จ');
  }

  return (result.ParsedResults ?? []).flatMap((page) =>
    (page.TextOverlay?.Lines ?? []).flatMap((line) => {
      const words = (line.Words ?? []).filter((word) => word.Width > 0 && word.Height > 0);
      const text = (line.LineText ?? words.map((word) => word.WordText).join(' ')).trim();
      if (!HAS_LETTER.test(text) || words.length === 0) return [];
      const box = unionBoxes(words.map((word) => ({ x: word.Left, y: word.Top, width: word.Width, height: word.Height })));
      return [{ text, box }];
    }),
  );
}
