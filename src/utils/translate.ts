export type TranslateLanguage = 'th' | 'en' | 'ja' | 'ko' | 'zh-CN' | 'zh-TW' | 'vi' | 'id';

/**
 * Clean up translated Thai text to be more natural.
 * Avoids over-aggressive spacing that breaks Thai words.
 */
function polishThaiText(text: string): string {
  if (!text) return '';

  return text
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    // Remove spaces before Thai punctuation
    .replace(/\s([,.!?;:。、])/g, '$1')
    // Ensure space between Thai and Latin text
    .replace(/([ก-๙])([A-Za-z0-9])/g, '$1 $2')
    .replace(/([A-Za-z0-9])([ก-๙])/g, '$1 $2')
    .trim();
}

function normalizeTranslationText(text: string, targetLang: TranslateLanguage): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (targetLang === 'th') return polishThaiText(normalized);
  return normalized.replace(/\s([,.!?;:])/g, '$1');
}

/**
 * Google Translate (unofficial gtx endpoint)
 */
async function translateWithGoogle(
  text: string,
  sourceLang: string,
  targetLang: TranslateLanguage
): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) throw new Error(`Google translate failed: ${response.status}`);

  const data = await response.json();
  const translated = Array.isArray(data?.[0]) ? data[0].map((item: any) => item?.[0]).filter(Boolean).join('') : '';
  return translated.trim();
}

/**
 * Lingva Translate - an open-source proxy for Google Translate
 * More reliable than the direct gtx endpoint as it's less likely to be rate-limited
 */
async function translateWithLingva(
  text: string,
  sourceLang: string,
  targetLang: TranslateLanguage
): Promise<string> {
  // Try multiple Lingva instances for resilience
  const instances = [
    'lingva.ml',
    'lingva.thedaviddelta.com',
    'translate.plausibility.cloud',
  ];

  for (const instance of instances) {
    try {
      const url = `https://${instance}/api/v1/${sourceLang}/${targetLang}/${encodeURIComponent(text)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();
      if (data?.translation) {
        return data.translation.trim();
      }
    } catch {
      // Try next instance
      continue;
    }
  }

  throw new Error('All Lingva instances failed');
}

/**
 * MyMemory Translation API (community translation memory)
 */
async function translateWithMyMemory(
  text: string,
  sourceLang: string,
  targetLang: TranslateLanguage
): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) throw new Error(`MyMemory failed: ${response.status}`);

  const data = await response.json();
  const translated = data.responseData?.translatedText?.trim() || '';

  // MyMemory sometimes returns all-caps "MYMEMORY WARNING" messages
  if (translated.toUpperCase().includes('MYMEMORY WARNING') || translated.toUpperCase().includes('PLEASE CONTACT')) {
    throw new Error('MyMemory rate limit reached');
  }

  return translated;
}

export const TARGET_LANGUAGE_OPTIONS: { value: TranslateLanguage; label: string; flag: string }[] = [
  { value: 'th', label: 'ไทย', flag: '🇹🇭' },
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'zh-CN', label: '中文 (简体)', flag: '🇨🇳' },
  { value: 'zh-TW', label: '中文 (繁體)', flag: '🇹🇼' },
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
];

// Map OCR language codes to standard language codes
const OCR_TO_TRANSLATE: Record<string, string> = {
  'auto': 'auto',
  'jpn': 'ja',
  'jpn_vert': 'ja',
  'kor': 'ko',
  'chi_sim': 'zh-CN',
  'chi_tra': 'zh-TW',
  'eng': 'en',
};

export function ocrLangToTranslateLang(ocrLang: string): string {
  return OCR_TO_TRANSLATE[ocrLang] || ocrLang;
}

/**
 * Translate text using a robust fallback chain:
 * 1. Google Translate (gtx) - fastest and best quality
 * 2. Lingva Translate - open-source Google proxy, less rate-limited
 * 3. MyMemory API - community translation memory
 */
export async function translateText(
  text: string,
  sourceLang: string,
  targetLang: TranslateLanguage
): Promise<string> {
  let normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const from = OCR_TO_TRANSLATE[sourceLang] || sourceLang;
  const to = targetLang;

  // Pre-process CJK text to remove spurious spaces from OCR
  // This drastically improves translation quality since spaces break the context for Google Translate
  if (['auto', 'ja', 'ko', 'zh-CN', 'zh-TW', 'jpn', 'jpn_vert', 'kor', 'chi_sim', 'chi_tra'].includes(sourceLang)) {
    // Remove spaces between CJK characters
    const cjkRegex = /([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7A3])\s+(?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7A3])/g;
    let prev;
    do {
      prev = normalized;
      normalized = normalized.replace(cjkRegex, '$1');
    } while (normalized !== prev);
    
    // Remove spaces around punctuation
    normalized = normalized.replace(/([\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7A3])\s+([!?,.。，、！？])/g, '$1$2');
    normalized = normalized.replace(/([!?,.。，、！？])\s+(?=[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\uAC00-\uD7A3])/g, '$1');
  }

  // Don't translate if source and target are the same
  if (from === to) return normalized;

  // Strategy 1: Google Translate
  try {
    const translated = await translateWithGoogle(normalized, from, to);
    if (translated && translated !== normalized) {
      return normalizeTranslationText(translated, targetLang);
    }
  } catch (error) {
    console.warn('Google translate failed:', error);
  }

  // Strategy 2: Lingva Translate
  try {
    const translated = await translateWithLingva(normalized, from, to);
    if (translated && translated !== normalized) {
      return normalizeTranslationText(translated, targetLang);
    }
  } catch (error) {
    console.warn('Lingva translate failed:', error);
  }

  // Strategy 3: MyMemory
  try {
    const translated = await translateWithMyMemory(normalized, from, to);
    if (translated && translated !== normalized) {
      return normalizeTranslationText(translated, targetLang);
    }
  } catch (error) {
    console.warn('MyMemory translate failed:', error);
  }

  // All failed - return original text
  console.error('All translation services failed for:', normalized.substring(0, 50));
  return normalized;
}

/**
 * Translate multiple texts in batch with retry logic
 */
export async function translateBatch(
  texts: string[],
  sourceLang: string,
  targetLang: TranslateLanguage,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const filteredTexts = texts.filter((text) => text && text.trim());
  if (!filteredTexts.length) return [];

  const results: string[] = [];

  for (let i = 0; i < filteredTexts.length; i++) {
    const text = filteredTexts[i];
    try {
      const translated = await translateText(text, sourceLang, targetLang);
      results.push(translated);
    } catch {
      results.push(text);
    }

    if (onProgress) {
      onProgress(i + 1, filteredTexts.length);
    }

    // Small delay between requests to avoid rate limiting
    if (i < filteredTexts.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}
