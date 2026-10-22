import {
  buildDictionary,
  protectTerms,
  restoreTerms,
  splitSentences,
  translatePhrase,
  type Dictionary,
} from '@/lib/glossary';
import type { TranslateOptions } from '@/lib/api';
import { applyThaiStyle } from '@/lib/glossary/style';
import {
  guessLanguage,
  removeSpacesBetweenCjk,
  type SourceLanguage,
  type TargetLanguage,
} from '@/lib/languages';

const TIMEOUT_MS = 8000;
const CONCURRENCY = 4;

type Provider = (text: string, source: SourceLanguage, target: TargetLanguage) => Promise<string>;

/** Google's free web endpoint: best quality, no key needed. */
const translateWithGoogle: Provider = async (text, source, target) => {
  const params = new URLSearchParams({ client: 'gtx', sl: source, tl: target, dt: 't', q: text });
  const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  // Shape: [[["translated sentence", "source sentence", ...], ...], null, "detected language", ...]
  const body: unknown = await response.json();
  if (!Array.isArray(body) || !Array.isArray(body[0])) return '';
  return body[0]
    .map((sentence: unknown) => (Array.isArray(sentence) && typeof sentence[0] === 'string' ? sentence[0] : ''))
    .join('');
};

/** MyMemory: free fallback; needs an explicit source language. */
const translateWithMyMemory: Provider = async (text, source, target) => {
  const from = source === 'auto' ? guessLanguage(text) : source;
  const params = new URLSearchParams({ q: text, langpair: `${from}|${target}` });
  const response = await fetch(`https://api.mymemory.translated.net/get?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const body = (await response.json()) as { responseStatus?: number | string; responseData?: { translatedText?: string } };
  const translated = body.responseData?.translatedText ?? '';
  if (Number(body.responseStatus) !== 200 || /MYMEMORY WARNING/i.test(translated)) {
    throw new Error(`MyMemory: ${translated || body.responseStatus}`);
  }
  return translated;
};

const PROVIDERS = [translateWithGoogle, translateWithMyMemory];

/** Translates each text. An entry is null if every provider failed for it. */
export function translateTexts(
  texts: readonly string[],
  source: SourceLanguage,
  target: TargetLanguage,
  options: TranslateOptions,
): Promise<(string | null)[]> {
  return mapWithConcurrency(texts, CONCURRENCY, (text) => translateText(text, source, target, options));
}

async function translateText(
  text: string,
  source: SourceLanguage,
  target: TargetLanguage,
  options: TranslateOptions,
): Promise<string | null> {
  const prepared = removeSpacesBetweenCjk(text.replace(/\s+/g, ' ').trim());
  if (!prepared) return '';
  const dictionary = buildDictionary(prepared, source, target, options.glossary, options.useBuiltInGlossary);
  // Thai has no full stop: lettering ends a statement with nothing at all.
  const restyle = (translation: string) =>
    target === 'th' ? applyThaiStyle(translation, options.style).replace(/(?<=[฀-๿])\.(?=\s|$)/g, '') : translation;

  // Sentences the glossary knows ("WHAT?!", "BOOM") use its wording; the rest go to MT.
  const sentences = splitSentences(prepared);
  const known = sentences.map((sentence) => translatePhrase(sentence, dictionary));
  if (known.some((phrase) => phrase !== null)) {
    const parts = await Promise.all(
      sentences.map((sentence, index) => {
        const phrase = known[index];
        return phrase !== null ? restyle(phrase) : machineTranslate(sentence, source, target, dictionary, restyle);
      }),
    );
    return parts.includes(null) ? null : parts.join(' ');
  }
  if (source === target) return prepared;
  return machineTranslate(prepared, source, target, dictionary, restyle);
}

/** Tries each provider in turn, keeping glossary terms intact. */
async function machineTranslate(
  text: string,
  source: SourceLanguage,
  target: TargetLanguage,
  dictionary: Dictionary,
  restyle: (translation: string) => string,
): Promise<string | null> {
  const guarded = protectTerms(sentenceCase(text), dictionary);
  for (const provider of PROVIDERS) {
    try {
      const translated = tidy(await provider(guarded.text, source, target));
      if (!translated) continue;
      // Restyled before the terms go back in, so names are never taken for pronouns.
      const restored = restoreTerms(restyle(translated), guarded.targets, target);
      if (restored !== null) return restored;
      // The provider mangled a placeholder: translate the plain text instead.
      const plain = tidy(await provider(text, source, target));
      if (plain) return restyle(plain);
    } catch (error) {
      console.warn(`${provider.name} failed:`, error);
    }
  }
  return null;
}

/**
 * Comic lettering is usually ALL CAPS, which makes machine translation pick worse senses
 * ("PICKED HER UP" → chose her). Such text is translated in sentence case instead.
 */
function sentenceCase(text: string): string {
  if (!/[A-Z]{2}/.test(text) || /[a-z]/.test(text)) return text;
  return text
    .toLowerCase()
    .replace(/(^|[.!?…]\s+)(\p{Ll})/gu, (_, boundary: string, letter: string) => boundary + letter.toUpperCase())
    .replace(/\bi\b/g, 'I');
}

function tidy(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
