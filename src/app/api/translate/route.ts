import { TRANSLATE_LIMITS, type TranslateRequest } from '@/lib/api';
import { GLOSSARY_LIMITS } from '@/lib/glossary';
import { isTranslationStyle } from '@/lib/glossary/style';
import { isSourceLanguage, isTargetLanguage } from '@/lib/languages';
import { translateTexts } from '@/server/translate';

export const maxDuration = 60;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isTranslateRequest(body)) {
    return Response.json({ error: 'คำขอไม่ถูกต้อง' }, { status: 400 });
  }
  const { texts, source, target, glossary, useBuiltInGlossary, style } = body;
  return Response.json({
    translations: await translateTexts(texts, source, target, { glossary, useBuiltInGlossary, style }),
  });
}

function isTranslateRequest(body: unknown): body is TranslateRequest {
  if (typeof body !== 'object' || body === null) return false;
  const { texts, source, target, glossary, useBuiltInGlossary, style } = body as Record<string, unknown>;
  return (
    isTranslationStyle(style) &&
    typeof useBuiltInGlossary === 'boolean' &&
    Array.isArray(glossary) &&
    glossary.length <= GLOSSARY_LIMITS.maxEntries &&
    glossary.every(isGlossaryEntry) &&
    Array.isArray(texts) &&
    texts.length <= TRANSLATE_LIMITS.maxTexts &&
    texts.every((text) => typeof text === 'string' && text.length <= TRANSLATE_LIMITS.maxTextLength) &&
    isSourceLanguage(source) &&
    isTargetLanguage(target)
  );
}

function isGlossaryEntry(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return false;
  const { source, target } = entry as Record<string, unknown>;
  return [source, target].every(
    (text) => typeof text === 'string' && text.trim() !== '' && text.length <= GLOSSARY_LIMITS.maxLength,
  );
}
