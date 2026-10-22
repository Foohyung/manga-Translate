export const SOURCE_LANGUAGES = [
  { code: 'auto', label: 'ตรวจจับอัตโนมัติ' },
  { code: 'ja', label: 'ญี่ปุ่น' },
  { code: 'ko', label: 'เกาหลี' },
  { code: 'zh-CN', label: 'จีน (ตัวย่อ)' },
  { code: 'zh-TW', label: 'จีน (ตัวเต็ม)' },
  { code: 'en', label: 'อังกฤษ' },
] as const;

export const TARGET_LANGUAGES = [
  { code: 'th', label: 'ไทย' },
  { code: 'en', label: 'อังกฤษ' },
  { code: 'ja', label: 'ญี่ปุ่น' },
  { code: 'ko', label: 'เกาหลี' },
  { code: 'zh-CN', label: 'จีน (ตัวย่อ)' },
  { code: 'zh-TW', label: 'จีน (ตัวเต็ม)' },
  { code: 'vi', label: 'เวียดนาม' },
  { code: 'id', label: 'อินโดนีเซีย' },
] as const;

export type SourceLanguage = (typeof SOURCE_LANGUAGES)[number]['code'];
export type TargetLanguage = (typeof TARGET_LANGUAGES)[number]['code'];

export function isSourceLanguage(value: unknown): value is SourceLanguage {
  return SOURCE_LANGUAGES.some((language) => language.code === value);
}

export function isTargetLanguage(value: unknown): value is TargetLanguage {
  return TARGET_LANGUAGES.some((language) => language.code === value);
}

const KANA = /[぀-ヿ]/;
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const HAN = /[㐀-䶿一-鿿]/;

/** Guesses the language of recognized text from the scripts it contains. */
export function guessLanguage(text: string): Exclude<SourceLanguage, 'auto'> {
  if (KANA.test(text)) return 'ja';
  if (HANGUL.test(text)) return 'ko';
  if (HAN.test(text)) return 'zh-CN';
  return 'en';
}

/** Japanese and Chinese are written without spaces between words. */
export function isSpacelessText(text: string): boolean {
  return (KANA.test(text) || HAN.test(text)) && !HANGUL.test(text);
}

// Kana, CJK ideographs, CJK punctuation and full-width forms (Hangul is excluded: Korean uses spaces).
const CJK_CHARACTER = '[\\u3000-\\u30ff\\u3400-\\u4dbf\\u4e00-\\u9fff\\uff00-\\uffef]';
const SPACE_BETWEEN_CJK = new RegExp(`(${CJK_CHARACTER})\\s+(?=${CJK_CHARACTER})`, 'g');

/** OCR often puts spaces between Japanese/Chinese characters, which hurts translation quality. */
export function removeSpacesBetweenCjk(text: string): string {
  return text.replace(SPACE_BETWEEN_CJK, '$1');
}
