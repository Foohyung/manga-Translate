'use client';

import { ArrowRight, Download, Eraser, FolderDown, Languages, LoaderCircle, ScanText, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/fields';
import { useEditorCommands } from '@/hooks/useEditorCommands';
import {
  SOURCE_LANGUAGES,
  TARGET_LANGUAGES,
  type SourceLanguage,
  type TargetLanguage,
} from '@/lib/languages';
import { TRANSLATION_STYLES, type TranslationStyle } from '@/lib/glossary/style';
import { useActivePage, useProjectStore, type PageTask } from '@/store/project-store';

function TaskIcon({ running, children }: { running: boolean; children: ReactNode }) {
  return running ? <LoaderCircle size={16} className="animate-spin" /> : children;
}

export function EditorToolbar() {
  const page = useActivePage();
  const pageCount = useProjectStore((state) => state.pages.length);
  const sourceLanguage = useProjectStore((state) => state.sourceLanguage);
  const targetLanguage = useProjectStore((state) => state.targetLanguage);
  const setSourceLanguage = useProjectStore((state) => state.setSourceLanguage);
  const setTargetLanguage = useProjectStore((state) => state.setTargetLanguage);
  const translationStyle = useProjectStore((state) => state.translationStyle);
  const setTranslationStyle = useProjectStore((state) => state.setTranslationStyle);
  const task: PageTask | undefined = useProjectStore((state) => (page ? state.pageTasks[page.id] : undefined));
  const { extract, translate, clean, translateAll, exportPage, exportAll, autoProgress, exportProgress } =
    useEditorCommands();

  const pageBusy = !page || Boolean(task) || Boolean(autoProgress);

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        <Select
          aria-label="ภาษาต้นฉบับ"
          className="h-10"
          value={sourceLanguage}
          onChange={(event) => setSourceLanguage(event.target.value as SourceLanguage)}
        >
          {SOURCE_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label}
            </option>
          ))}
        </Select>
        <ArrowRight size={16} className="shrink-0 text-primary" aria-hidden />
        <Select
          aria-label="ภาษาปลายทาง"
          className="h-10"
          value={targetLanguage}
          onChange={(event) => setTargetLanguage(event.target.value as TargetLanguage)}
        >
          {TARGET_LANGUAGES.map((language) => (
            <option key={language.code} value={language.code}>
              {language.label}
            </option>
          ))}
        </Select>
        {targetLanguage === 'th' && (
          <Select
            aria-label="สำนวนการแปล"
            title="สำนวนภาษาไทย: สรรพนามและคำลงท้าย"
            className="h-10"
            value={translationStyle}
            onChange={(event) => setTranslationStyle(event.target.value as TranslationStyle)}
          >
            {TRANSLATION_STYLES.map((style) => (
              <option key={style.id} value={style.id}>
                สำนวน: {style.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="hidden h-6 w-px bg-border sm:block" />

      <Button disabled={pageBusy} onClick={() => page && extract(page.id)} title="อ่านข้อความจากภาพหน้านี้ (OCR)">
        <TaskIcon running={task === 'extract'}>
          <ScanText size={16} />
        </TaskIcon>
        ดึงข้อความ
      </Button>
      <Button disabled={pageBusy} onClick={() => page && translate(page.id)} title="แปลข้อความทั้งหมดในหน้านี้">
        <TaskIcon running={task === 'translate'}>
          <Languages size={16} />
        </TaskIcon>
        แปลภาษา
      </Button>
      <Button disabled={pageBusy} onClick={() => page && clean(page.id)} title="ลบข้อความต้นฉบับออกจากภาพ">
        <TaskIcon running={task === 'clean'}>
          <Eraser size={16} />
        </TaskIcon>
        ลบข้อความเดิม
      </Button>
      <Button
        variant="primary"
        disabled={Boolean(autoProgress) || pageCount === 0}
        onClick={translateAll}
        title="ดึงข้อความ ลบข้อความเดิม และแปล ทุกหน้าที่ยังไม่ได้ทำ"
      >
        <TaskIcon running={Boolean(autoProgress)}>
          <Sparkles size={16} />
        </TaskIcon>
        {autoProgress ? `กำลังแปล ${autoProgress.done}/${autoProgress.total} หน้า` : 'แปลอัตโนมัติทุกหน้า'}
      </Button>

      <div className="flex items-center gap-2 lg:ml-auto">
        <Button disabled={!page || Boolean(exportProgress)} onClick={() => page && exportPage(page.id)}>
          <Download size={16} /> หน้านี้ (PNG)
        </Button>
        <Button disabled={pageCount === 0 || Boolean(exportProgress)} onClick={exportAll}>
          <TaskIcon running={Boolean(exportProgress)}>
            <FolderDown size={16} />
          </TaskIcon>
          {exportProgress && exportProgress.total > 1
            ? `กำลังรวมไฟล์ ${exportProgress.done}/${exportProgress.total}`
            : 'ทุกหน้า (ZIP)'}
        </Button>
      </div>
    </div>
  );
}
