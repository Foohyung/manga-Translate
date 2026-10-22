import type { GlossaryEntry } from './glossary';
import type { TranslationStyle } from './glossary/style';
import type { SourceLanguage, TargetLanguage } from './languages';
import type { OcrLine } from './ocr/types';

// Client wrappers for the app's API routes, plus the limits both sides agree on.

/** OCR.space rejects files over 1 MB on its free plan. */
export const OCR_MAX_UPLOAD_BYTES = 1_000_000;

export const TRANSLATE_LIMITS = { maxTexts: 50, maxTextLength: 2000 } as const;

export interface TranslateRequest {
  texts: string[];
  source: SourceLanguage;
  target: TargetLanguage;
  glossary: GlossaryEntry[];
  /** Also use the built-in Thai glossary of exclamations, sound effects and forms of address. */
  useBuiltInGlossary: boolean;
  /** Register of Thai translations (pronouns and particles). */
  style: TranslationStyle;
}

export type TranslateOptions = Pick<TranslateRequest, 'glossary' | 'useBuiltInGlossary' | 'style'>;

async function readResponse<T>(response: Response, fallbackError: string): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: unknown } | null)?.error;
    throw new Error(typeof message === 'string' ? message : fallbackError);
  }
  return body as T;
}

export async function requestOcr(image: Blob, language: SourceLanguage): Promise<OcrLine[]> {
  const form = new FormData();
  form.append('file', image, image.type === 'image/jpeg' ? 'page.jpg' : 'page.png');
  form.append('language', language);
  const response = await fetch('/api/ocr', { method: 'POST', body: form });
  const { lines } = await readResponse<{ lines: OcrLine[] }>(response, 'อ่านข้อความจากภาพไม่สำเร็จ');
  return lines;
}

/** Translates texts in order; an entry is null when it could not be translated. */
export async function requestTranslations(
  texts: readonly string[],
  source: SourceLanguage,
  target: TargetLanguage,
  options: TranslateOptions,
): Promise<(string | null)[]> {
  const results: (string | null)[] = [];
  for (let start = 0; start < texts.length; start += TRANSLATE_LIMITS.maxTexts) {
    const request: TranslateRequest = {
      texts: texts.slice(start, start + TRANSLATE_LIMITS.maxTexts),
      source,
      target,
      ...options,
    };
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    const { translations } = await readResponse<{ translations: (string | null)[] }>(
      response,
      'แปลภาษาไม่สำเร็จ',
    );
    results.push(...translations);
  }
  return results;
}
