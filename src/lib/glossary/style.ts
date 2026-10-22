// Register ("สำนวน") of Thai translations. Machine translation produces neutral Thai with
// "ฉัน/คุณ" and few particles; comics need speech that fits the character, so the output is
// rewritten word by word: pronouns, sentence-final particles and a few set phrases.

export const TRANSLATION_STYLES = [
  { id: 'natural', label: 'ทั่วไป' },
  { id: 'casual', label: 'กันเอง (ฉัน/นาย)' },
  { id: 'polite-male', label: 'สุภาพ (ผม/ครับ)' },
  { id: 'polite-female', label: 'สุภาพ (ฉัน/ค่ะ)' },
  { id: 'rough', label: 'ห้าว/นักเลง (ข้า/แก)' },
  { id: 'classic', label: 'ย้อนยุค/กำลังภายใน (ข้า/เจ้า)' },
] as const;

export type TranslationStyle = (typeof TRANSLATION_STYLES)[number]['id'];

export function isTranslationStyle(value: unknown): value is TranslationStyle {
  return TRANSLATION_STYLES.some((style) => style.id === value);
}

interface StyleRules {
  /** Replacement for "I". */
  me?: string;
  /** Replacement for "you". */
  you?: string;
  /** Polite particle to end sentences with, or 'none' to strip polite particles. */
  particle: { statement: string; question: string } | 'none';
  /** Set phrases swapped to fit the register. */
  phrases?: Readonly<Record<string, string>>;
}

const TO_POLITE = { ขอบใจ: 'ขอบคุณ', ขอโทษที: 'ขอโทษ' };
const TO_INFORMAL = { ขอบคุณ: 'ขอบใจ' };

const RULES: Record<Exclude<TranslationStyle, 'natural'>, StyleRules> = {
  casual: { you: 'นาย', particle: 'none', phrases: TO_INFORMAL },
  'polite-male': { me: 'ผม', particle: { statement: 'ครับ', question: 'ครับ' }, phrases: TO_POLITE },
  'polite-female': { me: 'ฉัน', particle: { statement: 'ค่ะ', question: 'คะ' }, phrases: TO_POLITE },
  rough: { me: 'ข้า', you: 'แก', particle: 'none', phrases: TO_INFORMAL },
  classic: { me: 'ข้า', you: 'เจ้า', particle: 'none', phrases: TO_INFORMAL },
};

const FIRST_PERSON = new Set(['ฉัน', 'ดิฉัน', 'ข้าพเจ้า']);
const SECOND_PERSON = new Set(['คุณ']);
const POLITE_PARTICLES = new Set(['ครับ', 'ค่ะ', 'คะ', 'ครับผม', 'จ้ะ', 'จ้า', 'ขา']);
const QUESTION_WORDS = new Set([
  'ไหม', 'มั้ย', 'เหรอ', 'หรอ', 'หรือ', 'เปล่า', 'อะไร', 'ทำไม', 'ยังไง', 'อย่างไร', 'ไหน', 'ที่ไหน', 'ใคร',
  'เมื่อไหร่', 'เมื่อไร', 'เท่าไหร่', 'เท่าไร', 'บ้าง', 'ไง',
]);
/** Soft endings take the question form of the particle: "นะคะ", "สิคะ", "ล่ะคะ". */
const SOFT_ENDINGS = new Set(['นะ', 'สิ', 'ล่ะ', 'น่ะ', 'เนอะ']);
/** Placeholders for glossary terms (see protectTerms) — names that must not be rewritten. */
const PLACEHOLDER = /^XQZ\d+$/i;

const thaiWords = new Intl.Segmenter('th', { granularity: 'word' });

/** Rewrites Thai text in the given register. Text in other languages is returned unchanged. */
export function applyThaiStyle(text: string, style: TranslationStyle): string {
  if (style === 'natural' || !/[฀-๿]/.test(text)) return text;
  const rules = RULES[style];
  // Each sentence keeps its own closing punctuation.
  return text.replace(/([^!?.…]+)([!?.…]*)/g, (_, body: string, ending: string) =>
    restyleSentence(body, ending, rules) + ending,
  );
}

function restyleSentence(body: string, ending: string, rules: StyleRules): string {
  const segments = [...thaiWords.segment(body)].map((part) => ({ text: part.segment, word: part.isWordLike ?? false }));
  // Placeholder digits ("XQZ0") may come out as a word of their own.
  const meaningful = segments.filter((segment) => segment.word && !/^\d+$/.test(segment.text));
  const last = meaningful.at(-1)?.text ?? '';
  const isQuestion =
    ending.includes('?') ||
    SOFT_ENDINGS.has(last) ||
    meaningful.some((segment) => QUESTION_WORDS.has(segment.text));
  const particle =
    rules.particle === 'none' ? '' : isQuestion ? rules.particle.question : rules.particle.statement;

  const words = segments.map(({ text }, index) => {
    const next = segments.slice(index + 1).find((segment) => segment.text.trim())?.text ?? '';
    if (rules.me && FIRST_PERSON.has(text)) return rules.me;
    // "คุณ" right before a name is a title ("คุณทานากะ"), not "you".
    if (rules.you && SECOND_PERSON.has(text) && !PLACEHOLDER.test(next)) return rules.you;
    // Particles MT added are swapped for this register's (or dropped).
    if (POLITE_PARTICLES.has(text)) return particle;
    return rules.phrases?.[text] ?? text;
  });

  let result = words.join('').replace(/\s+$/, '');
  // A sentence trailing off ("เดี๋ยวก่อน...") reads naturally without a particle.
  const trailsOff = /^(?:\.{2,}|…)+$/.test(ending);
  // A sentence may end with a name ("…ไหม อิจิโกะ"); the particle then follows the name.
  const endsInWords = /[฀-๿]/.test(last) || PLACEHOLDER.test(last);
  const hasParticle = meaningful.some((segment) => POLITE_PARTICLES.has(segment.text));
  if (particle && !trailsOff && !hasParticle && endsInWords && meaningful.length >= 2) result += particle;
  // Keep the whitespace that separated this sentence from the previous one.
  const leading = body.match(/^\s*/)?.[0] ?? '';
  return leading + result.trimStart();
}
