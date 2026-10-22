'use client';

import { useEffect, type DragEvent } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { Trash } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { useEditorShortcuts } from '@/hooks/useEditorShortcuts';
import { errorMessage } from '@/lib/errors';
import { keepCleanedPagesInSync } from '@/store/pipeline';
import { useActivePage, useProjectStore } from '@/store/project-store';
import { EditorToolbar } from './EditorToolbar';
import { PageList } from './PageList';
import { SidePanel } from './SidePanel';
import { Stage } from './Stage';
import { UploadDropzone } from './UploadDropzone';

/** The translation editor. Runs only in the browser; the project is restored from IndexedDB. */
export function Workspace() {
  const status = useProjectStore((state) => state.status);
  const hasPages = useProjectStore((state) => state.pages.length > 0);
  const load = useProjectStore((state) => state.load);
  const addPages = useProjectStore((state) => state.addPages);
  const clearProject = useProjectStore((state) => state.clearProject);
  const page = useActivePage();
  useEditorShortcuts();

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(
    () => keepCleanedPagesInSync((error) => toast.error(errorMessage(error, 'อัปเดตภาพที่ลบข้อความไม่สำเร็จ'))),
    [],
  );

  async function addFiles(files: File[]) {
    const added = await addPages(files);
    const skipped = files.length - added;
    if (skipped > 0) toast.error(`ข้าม ${skipped} ไฟล์ที่ไม่ใช่ภาพหรือเปิดไม่ได้`);
  }

  function dropFiles(event: DragEvent) {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    void addFiles([...event.dataTransfer.files]);
  }

  function startOver() {
    if (window.confirm('ล้างโปรเจกต์นี้ทั้งหมด? ภาพและข้อความที่แก้ไขไว้จะถูกลบ')) void clearProject();
  }

  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{ style: { background: '#1c1c22', color: '#fafafa', border: '1px solid #27272a' } }}
      />
      {status === 'loading' ? (
        <Spinner />
      ) : hasPages ? (
        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden"
          onDragOver={(event) => event.preventDefault()}
          onDrop={dropFiles}
        >
          <EditorToolbar />
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <PageList onAddFiles={addFiles} />
            {page && <Stage page={page} />}
            <SidePanel />
          </div>
          <footer className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted">
            <span>บันทึกอัตโนมัติในเบราว์เซอร์นี้</span>
            <Button size="sm" variant="ghost" onClick={startOver}>
              <Trash size={14} /> เริ่มโปรเจกต์ใหม่
            </Button>
          </footer>
        </div>
      ) : (
        <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-12">
          <h1 className="mb-3 text-center text-3xl font-black tracking-tight sm:text-4xl">
            อัปโหลดภาพ <span className="gradient-text">เพื่อเริ่มแปล</span>
          </h1>
          <p className="mb-8 text-center text-muted">
            ดึงข้อความจากภาพ แปลภาษา แล้วจัดตำแหน่ง ขนาด สี และฟอนต์ของตัวอักษรได้ตามต้องการ
          </p>
          <UploadDropzone onFiles={addFiles} />
        </main>
      )}
    </>
  );
}
