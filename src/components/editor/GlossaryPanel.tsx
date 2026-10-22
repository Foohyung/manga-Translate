'use client';

import { useDeferredValue, useState } from 'react';
import { ArrowRight, BookOpenText, ClipboardPaste, Plus, Search, Trash } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, IconButton } from '@/components/ui/Button';
import { TEXTAREA_CLASSES } from '@/components/ui/fields';
import {
  BUILT_IN_THAI_ENTRIES,
  BUILT_IN_THAI_ENTRY_COUNT,
  GLOSSARY_LIMITS,
  parseGlossaryText,
  type GlossaryEntry,
} from '@/lib/glossary';
import { useProjectStore } from '@/store/project-store';

const INPUT_CLASSES =
  'h-8 w-full min-w-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20';

const LANGUAGE_LABELS = { en: 'EN', ja: 'JA', ko: 'KO', zh: 'ZH' } as const;
/** Search results shown at once; the built-in glossary has thousands of entries. */
const MAX_RESULTS = 60;

/** Adds entries to the glossary; an entry for a source already listed replaces it. */
function mergeEntries(glossary: readonly GlossaryEntry[], added: readonly GlossaryEntry[]): GlossaryEntry[] {
  const key = (entry: GlossaryEntry) => entry.source.trim().toLowerCase();
  const replaced = new Set(added.map(key));
  return [...glossary.filter((entry) => !replaced.has(key(entry))), ...added].slice(0, GLOSSARY_LIMITS.maxEntries);
}

/** The project's glossary: fixed translations for names and terms, applied on every translation. */
export function GlossaryPanel() {
  const glossary = useProjectStore((state) => state.glossary);
  const setGlossary = useProjectStore((state) => state.setGlossary);
  const useBuiltIn = useProjectStore((state) => state.useBuiltInGlossary);
  const setUseBuiltIn = useProjectStore((state) => state.setUseBuiltInGlossary);
  const targetLanguage = useProjectStore((state) => state.targetLanguage);

  const [bulkText, setBulkText] = useState('');
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const results = deferredQuery
    ? BUILT_IN_THAI_ENTRIES.filter(
        (entry) =>
          entry.thai.includes(deferredQuery) || entry.sources.some((source) => source.toLowerCase().includes(deferredQuery)),
      )
    : [];

  function addBulk() {
    const added = parseGlossaryText(bulkText);
    if (added.length === 0) {
      toast.error('ไม่พบคำศัพท์ — ใส่บรรทัดละคำ เช่น Ichigo = อิจิโกะ');
      return;
    }
    setGlossary(mergeEntries(glossary, added));
    setBulkText('');
    toast.success(`เพิ่ม ${added.length} คำแล้ว`);
  }

  const update = (index: number, patch: Partial<GlossaryEntry>) =>
    setGlossary(glossary.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-sm">
        <h3 className="flex items-center gap-2 font-semibold">
          <BookOpenText size={16} className="text-primary" /> คำศัพท์ของเรื่องนี้
        </h3>
        <p className="text-xs leading-relaxed text-muted">
          คำแปลที่ต้องการให้ใช้ทุกครั้ง เช่น ชื่อตัวละคร ชื่อท่า หรือสรรพนาม (you → นาย) — มีผลตั้งแต่การแปลครั้งถัดไป
        </p>
      </div>

      {glossary.length > 0 && (
        <ul className="space-y-2">
          {glossary.map((entry, index) => (
            <li key={index} className="flex items-center gap-1.5">
              <input
                aria-label={`ต้นฉบับ #${index + 1}`}
                placeholder="ต้นฉบับ"
                maxLength={GLOSSARY_LIMITS.maxLength}
                className={INPUT_CLASSES}
                value={entry.source}
                onChange={(event) => update(index, { source: event.target.value })}
              />
              <ArrowRight size={14} className="shrink-0 text-muted" aria-hidden />
              <input
                aria-label={`คำแปล #${index + 1}`}
                placeholder="คำแปล"
                maxLength={GLOSSARY_LIMITS.maxLength}
                className={INPUT_CLASSES}
                value={entry.target}
                onChange={(event) => update(index, { target: event.target.value })}
              />
              <IconButton
                label={`ลบคำศัพท์ #${index + 1}`}
                onClick={() => setGlossary(glossary.filter((_, i) => i !== index))}
              >
                <Trash size={14} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <Button
        size="sm"
        disabled={glossary.length >= GLOSSARY_LIMITS.maxEntries}
        onClick={() => setGlossary([...glossary, { source: '', target: '' }])}
      >
        <Plus size={14} /> เพิ่มคำศัพท์
      </Button>

      <details className="group rounded-xl border border-border bg-white/[0.02] p-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-2 font-medium select-none">
          <ClipboardPaste size={15} className="text-primary" /> วางหลายคำพร้อมกัน
        </summary>
        <div className="mt-3 space-y-2">
          <textarea
            rows={5}
            className={TEXTAREA_CLASSES}
            placeholder={'บรรทัดละคำ เช่น\nIchigo = อิจิโกะ\nZanpakuto = ดาบวิญญาณ\nCaptain → หัวหน้าหน่วย'}
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
          />
          <Button size="sm" disabled={!bulkText.trim()} onClick={addBulk}>
            <Plus size={14} /> เพิ่มลงคำศัพท์ของเรื่องนี้
          </Button>
        </div>
      </details>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-white/[0.02] p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-primary"
          checked={useBuiltIn}
          onChange={(event) => setUseBuiltIn(event.target.checked)}
        />
        <span className="space-y-1">
          <span className="block font-medium">ใช้คลังคำสำเร็จรูป ({BUILT_IN_THAI_ENTRY_COUNT} ชุดคำ)</span>
          <span className="block text-xs leading-relaxed text-muted">
            คำอุทาน คำทักทาย เสียงประกอบ (SFX) และคำเรียกขาน จากภาษาอังกฤษ ญี่ปุ่น เกาหลี และจีน เช่น “WHAT?!” → “อะไรนะ?!”,
            “ドキドキ” → “ตึกตัก”, “师兄” → “ศิษย์พี่”
            {targetLanguage !== 'th' && ' — ใช้เฉพาะเมื่อแปลเป็นภาษาไทย'}
          </span>
        </span>
      </label>

      <div className="space-y-2">
        <label className="relative block">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            aria-label="ค้นหาในคลังคำสำเร็จรูป"
            placeholder="ค้นหาในคลังคำ เช่น sorry, ありがとう, ศิษย์พี่"
            className={`${INPUT_CLASSES} pl-8`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {deferredQuery && (
          <>
            <p className="text-xs text-muted">
              พบ {results.length} ชุดคำ{results.length > MAX_RESULTS && ` (แสดง ${MAX_RESULTS} รายการแรก)`} — กด + เพื่อคัดลอกมาแก้คำแปลเอง
            </p>
            <ul className="max-h-80 space-y-1 overflow-y-auto pr-1">
              {results.slice(0, MAX_RESULTS).map((entry, index) => (
                <li
                  key={`${entry.language}-${index}-${entry.sources[0]}`}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-white/5"
                >
                  <span className="shrink-0 rounded bg-white/5 px-1 font-mono text-[10px] text-muted">
                    {LANGUAGE_LABELS[entry.language]}
                  </span>
                  <span className="min-w-0 flex-1 truncate" title={entry.sources.join(', ')}>
                    {entry.sources.join(', ')}
                  </span>
                  <ArrowRight size={12} className="shrink-0 text-muted" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{entry.thai}</span>
                  <IconButton
                    label={`คัดลอก “${entry.sources[0]}” มาที่คำศัพท์ของเรื่องนี้`}
                    disabled={glossary.length >= GLOSSARY_LIMITS.maxEntries}
                    onClick={() => setGlossary(mergeEntries(glossary, [{ source: entry.sources[0], target: entry.thai }]))}
                  >
                    <Plus size={13} />
                  </IconButton>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
