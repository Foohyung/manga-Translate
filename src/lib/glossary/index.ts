import { guessLanguage, type SourceLanguage, type TargetLanguage } from '@/lib/languages';
import { THAI_PHRASES, THAI_TERMS, type GlossaryLanguage } from './thai';

/** A user-defined translation: character names, attack names, preferred pronouns… */
export interface GlossaryEntry {
  source: string;
  target: string;
}

export const GLOSSARY_LIMITS = { maxEntries: 200, maxLength: 100 } as const;

/** Entries ready to use: trimmed, without half-filled rows. */
export function completeEntries(entries: readonly GlossaryEntry[]): GlossaryEntry[] {
  return entries
    .map((entry) => ({ source: entry.source.trim(), target: entry.target.trim() }))
    .filter((entry) => entry.source && entry.target);
}

const countEntries = (groups: Readonly<Record<string, readonly unknown[]>>) =>
  Object.values(groups).reduce((count, entries) => count + entries.length, 0);

export const BUILT_IN_THAI_ENTRY_COUNT = countEntries(THAI_PHRASES) + countEntries(THAI_TERMS);

/** One built-in entry, flattened for browsing. */
export interface BuiltInEntry {
  language: GlossaryLanguage;
  sources: readonly string[];
  thai: string;
}

/** Every built-in Thai entry: whole utterances first, then terms. */
export const BUILT_IN_THAI_ENTRIES: readonly BuiltInEntry[] = (Object.keys(THAI_PHRASES) as GlossaryLanguage[]).flatMap(
  (language) => [
    ...THAI_PHRASES[language].map(([sources, thai]) => ({ language, sources, thai })),
    ...THAI_TERMS[language].map(([source, thai]) => ({ language, sources: [source], thai })),
  ],
);

/** Parses one entry per line, "source = translation" (also "→", "=>", "->" or a tab). */
export function parseGlossaryText(text: string): GlossaryEntry[] {
  return completeEntries(
    text.split('\n').flatMap((line) => {
      const match = line.match(/^(.+?)\s*(?:=>|->|→|=|\t)\s*(.+)$/);
      return match
        ? [{ source: match[1].slice(0, GLOSSARY_LIMITS.maxLength), target: match[2].slice(0, GLOSSARY_LIMITS.maxLength) }]
        : [];
    }),
  );
}

interface Phrase {
  target: string;
  asQuestion?: string;
}

interface Term {
  pattern: RegExp;
  target: string;
}

export interface Dictionary {
  /** Whole utterances, keyed by `phraseKey`. */
  phrases: Map<string, Phrase>;
  /** Terms replaced inside sentences, longest first. */
  terms: Term[];
}

/** Lookup key for an utterance: lower case, letters only, repeats squeezed ("BOOOOM!!" → "bom"). */
export function phraseKey(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s']/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(.)\1+/gu, '$1');
}

function glossaryLanguage(text: string, source: SourceLanguage): GlossaryLanguage {
  const language = source === 'auto' ? guessLanguage(text) : source;
  return language === 'zh-CN' || language === 'zh-TW' ? 'zh' : language;
}

function termPattern(source: string): RegExp {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Latin words need whole-word matches; Korean nouns take particles after them; Chinese and
  // Japanese have no word boundaries at all.
  // Honorific suffixes ("-kun") attach straight to the name before them.
  if (source.startsWith('-')) return new RegExp(`${escaped}(?![\\p{L}\\p{N}])`, 'giu');
  if (/\p{Script=Latin}/u.test(source)) return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'giu');
  if (/\p{Script=Hangul}/u.test(source)) return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}`, 'gu');
  return new RegExp(escaped, 'gu');
}

/**
 * The glossary for one text: the user's entries, plus — when translating into Thai — the
 * built-in phrases and terms for the text's language. User entries win over built-in ones.
 */
export function buildDictionary(
  text: string,
  source: SourceLanguage,
  target: TargetLanguage,
  userEntries: readonly GlossaryEntry[],
  useBuiltIn: boolean,
): Dictionary {
  const phrases = new Map<string, Phrase>();
  const terms = new Map<string, string>();

  if (useBuiltIn && target === 'th') {
    const language = glossaryLanguage(text, source);
    // Comics in every language use some English ("OK!", "NO!").
    const builtInPhrases = language === 'en' ? THAI_PHRASES.en : [...THAI_PHRASES.en, ...THAI_PHRASES[language]];
    for (const [sources, thai, asQuestion] of builtInPhrases) {
      for (const spelling of sources) phrases.set(phraseKey(spelling), { target: thai, asQuestion });
    }
    for (const [term, thai] of THAI_TERMS[language]) terms.set(term, thai);
  }
  for (const entry of userEntries) {
    phrases.set(phraseKey(entry.source), { target: entry.target });
    terms.set(entry.source, entry.target);
  }

  return {
    phrases,
    terms: [...terms]
      .sort(([a], [b]) => b.length - a.length)
      .map(([term, translation]) => ({ pattern: termPattern(term), target: translation })),
  };
}

/** Splits text after sentence-ending punctuation ("WHAT?! SHUT UP..." → two sentences). */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?…])\s+|(?<=[。！？])/u).filter((sentence) => sentence.trim());
}

/** Full-width and Japanese punctuation, rewritten the way Thai text writes it. */
function thaiPunctuation(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[「」『』]/g, '')
    .replace(/。/g, '')
    .replace(/、/g, ' ')
    .replace(/〜/g, '~')
    .trim();
}

const UTTERANCE = /^([^\p{L}\p{N}]*)([\s\S]*?)([^\p{L}\p{N}]*)$/u;

/** The glossary translation of a whole sentence, keeping its punctuation, or null. */
export function translatePhrase(sentence: string, dictionary: Dictionary): string | null {
  const [, lead = '', core = '', trail = ''] = UTTERANCE.exec(sentence.trim()) ?? [];
  const phrase = core && dictionary.phrases.get(phraseKey(core));
  if (!phrase) return null;
  const isQuestion = /[?？]/.test(trail);
  return `${thaiPunctuation(lead)}${isQuestion && phrase.asQuestion ? phrase.asQuestion : phrase.target}${thaiPunctuation(trail)}`;
}

const TOKEN = /(\s?)X\s?Q\s?Z\s?(\d+)(\s?)/gi;
const THAI = /[฀-๿]/;

/** Swaps glossary terms for placeholders that machine translation leaves untouched. */
export function protectTerms(text: string, dictionary: Dictionary): { text: string; targets: string[] } {
  const targets: string[] = [];
  let result = text;
  for (const term of dictionary.terms) {
    result = result.replace(term.pattern, () => {
      targets.push(term.target);
      return `XQZ${targets.length - 1}`;
    });
  }
  return { text: result, targets };
}

/** Puts the terms back into a translation; null if the translation lost a placeholder. */
export function restoreTerms(translated: string, targets: readonly string[], target: TargetLanguage): string | null {
  const found = new Set<number>();
  const result = translated.replace(
    TOKEN,
    (match: string, before: string, index: string, after: string, offset: number) => {
      const term = targets[Number(index)];
      if (term === undefined) return match;
      found.add(Number(index));
      // Thai doesn't put spaces between words, so drop the ones MT left around the placeholder.
      const joinsThai = (neighbour: string, edge: string) => target === 'th' && THAI.test(neighbour) && THAI.test(edge);
      const keepBefore = before && !joinsThai(translated[offset - 1] ?? '', term[0]);
      const keepAfter = after && !joinsThai(translated[offset + match.length] ?? '', term.at(-1) ?? '');
      return `${keepBefore ? before : ''}${term}${keepAfter ? after : ''}`;
    },
  );
  return found.size === targets.length ? result : null;
}
