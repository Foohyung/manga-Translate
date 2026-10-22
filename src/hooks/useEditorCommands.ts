import { useState } from 'react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/errors';
import { downloadPage, downloadPagesAsZip } from '@/lib/export';
import {
  cleanPage,
  extractPageText,
  translatePage,
  translatePagesAutomatically,
} from '@/store/pipeline';
import { useProjectStore } from '@/store/project-store';

export interface Progress {
  done: number;
  total: number;
}

const findPage = (pageId: string) => useProjectStore.getState().pages.find((page) => page.id === pageId);

/** The editor's actions, wrapped with confirmation prompts and progress/result toasts. */
export function useEditorCommands() {
  const [autoProgress, setAutoProgress] = useState<Progress | null>(null);
  const [exportProgress, setExportProgress] = useState<Progress | null>(null);

  async function extract(pageId: string) {
    const page = findPage(pageId);
    if (page?.layers.length && !window.confirm('ข้อความที่จัดไว้ในหน้านี้จะถูกแทนที่ ต้องการดึงข้อความใหม่หรือไม่?')) {
      return;
    }
    const toastId = toast.loading('กำลังอ่านข้อความจากภาพ...');
    try {
      const { blocks, engine } = await extractPageText(pageId);
      if (blocks === 0) {
        toast('ไม่พบข้อความในหน้านี้', { id: toastId, icon: '🔍' });
      } else {
        const fallbackNote = engine === 'tesseract' ? ' (ใช้ระบบอ่านข้อความสำรอง)' : '';
        toast.success(`พบข้อความ ${blocks} จุด${fallbackNote}`, { id: toastId });
      }
    } catch (error) {
      toast.error(errorMessage(error, 'อ่านข้อความไม่สำเร็จ'), { id: toastId });
    }
  }

  async function translate(pageId: string, layerIds?: readonly string[]) {
    const toastId = toast.loading('กำลังแปลภาษา...');
    try {
      const { translated, failed } = await translatePage(pageId, layerIds);
      if (failed > 0) {
        toast.error(`แปลไม่สำเร็จ ${failed} ข้อความ กรุณาลองใหม่อีกครั้ง`, { id: toastId });
      } else if (translated === 0) {
        toast('ยังไม่มีข้อความให้แปล — กด "ดึงข้อความ" ก่อน', { id: toastId, icon: 'ℹ️' });
      } else {
        toast.success(`แปลแล้ว ${translated} ข้อความ`, { id: toastId });
      }
    } catch (error) {
      toast.error(errorMessage(error, 'แปลภาษาไม่สำเร็จ'), { id: toastId });
    }
  }

  async function clean(pageId: string) {
    const page = findPage(pageId);
    if (!page?.layers.some((layer) => layer.sourceBox) && !page?.manualEraseAreas.length) {
      toast('ยังไม่รู้ตำแหน่งข้อความเดิม — กด "ดึงข้อความ" หรือวาดกรอบในโหมด "เลือกกล่องที่จะลบ"', {
        icon: 'ℹ️',
      });
      return;
    }
    const toastId = toast.loading('กำลังลบข้อความเดิม...');
    try {
      const erased = await cleanPage(pageId);
      if (erased === 0) {
        toast('ไม่ได้เลือกกล่องที่จะลบ — ใช้ภาพต้นฉบับ', { id: toastId, icon: 'ℹ️' });
      } else {
        toast.success(`ลบข้อความเดิมแล้ว ${erased} กล่อง`, { id: toastId });
      }
    } catch (error) {
      toast.error(errorMessage(error, 'ลบข้อความเดิมไม่สำเร็จ'), { id: toastId });
    }
  }

  /** Runs the whole pipeline on pages that have no text layers yet (or, if confirmed, on all). */
  async function translateAll() {
    const { pages } = useProjectStore.getState();
    let targets = pages.filter((page) => page.layers.length === 0);
    if (targets.length === 0) {
      if (!window.confirm('ทุกหน้ามีข้อความแล้ว ต้องการแปลใหม่ทั้งหมดหรือไม่? การแก้ไขเดิมจะหายไป')) return;
      targets = pages;
    }

    setAutoProgress({ done: 0, total: targets.length });
    try {
      const { failedPages, pagesWithoutText } = await translatePagesAutomatically(
        targets.map((page) => page.id),
        (done, total) => setAutoProgress({ done, total }),
      );
      const translatedPages = targets.length - failedPages - pagesWithoutText;
      const notes = [
        pagesWithoutText > 0 && `ไม่พบข้อความ ${pagesWithoutText} หน้า`,
        failedPages > 0 && `ไม่สำเร็จ ${failedPages} หน้า (ลองทำทีละหน้าอีกครั้ง)`,
      ].filter(Boolean);
      const summary = [`แปลเสร็จ ${translatedPages} หน้า`, ...notes].join(' · ');
      if (failedPages > 0) toast.error(summary);
      else if (pagesWithoutText > 0) toast(summary, { icon: 'ℹ️' });
      else toast.success(`${summary} ปรับแต่งข้อความต่อได้เลย`);
    } finally {
      setAutoProgress(null);
    }
  }

  async function exportPage(pageId: string) {
    const page = findPage(pageId);
    if (!page) return;
    setExportProgress({ done: 0, total: 1 });
    try {
      await downloadPage(page);
    } catch (error) {
      toast.error(errorMessage(error, 'ดาวน์โหลดไม่สำเร็จ'));
    } finally {
      setExportProgress(null);
    }
  }

  async function exportAll() {
    const { pages } = useProjectStore.getState();
    setExportProgress({ done: 0, total: pages.length });
    try {
      await downloadPagesAsZip(pages, (done, total) => setExportProgress({ done, total }));
    } catch (error) {
      toast.error(errorMessage(error, 'ดาวน์โหลดไม่สำเร็จ'));
    } finally {
      setExportProgress(null);
    }
  }

  return { extract, translate, clean, translateAll, exportPage, exportAll, autoProgress, exportProgress };
}
