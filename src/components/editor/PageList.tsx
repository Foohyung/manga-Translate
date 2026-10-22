'use client';

import { ImagePlus, LoaderCircle, X } from 'lucide-react';
import { useProjectStore } from '@/store/project-store';
import { ImagePickerButton } from './UploadDropzone';

/** Page thumbnails: a column on large screens, a scrolling row on small ones. */
export function PageList({ onAddFiles }: { onAddFiles: (files: File[]) => void }) {
  const pages = useProjectStore((state) => state.pages);
  const activePageId = useProjectStore((state) => state.activePageId);
  const pageTasks = useProjectStore((state) => state.pageTasks);
  const setActivePage = useProjectStore((state) => state.setActivePage);
  const removePage = useProjectStore((state) => state.removePage);

  return (
    <nav
      aria-label="หน้าทั้งหมด"
      className="flex shrink-0 gap-2 overflow-x-auto border-b border-border p-3 lg:w-28 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:border-r lg:border-b-0"
    >
      {pages.map((page, index) => {
        const active = page.id === activePageId;
        const busy = Boolean(pageTasks[page.id]);
        return (
          <div key={page.id} className="group relative shrink-0">
            <button
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-label={`หน้า ${index + 1}: ${page.name}`}
              onClick={() => setActivePage(page.id)}
              className={`relative block h-24 w-[4.5rem] overflow-hidden rounded-lg border-2 transition lg:h-28 lg:w-full ${
                active ? 'border-primary shadow-lg shadow-primary/20' : 'border-border hover:border-primary/40'
              }`}
            >
              <img src={page.cleanedUrl ?? page.originalUrl} alt="" className="size-full object-cover object-top" />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/90 to-transparent px-1.5 pt-4 pb-1 text-[11px] font-semibold text-white">
                {index + 1}
                {page.layers.length > 0 && (
                  <span className="rounded bg-primary/80 px-1 text-[10px]" title="จำนวนข้อความ">
                    {page.layers.length}
                  </span>
                )}
              </span>
              {busy && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <LoaderCircle size={20} className="animate-spin text-white" />
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label={`ลบหน้า ${index + 1}`}
              title={`ลบหน้า ${index + 1}`}
              disabled={busy}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-md bg-black/70 text-white opacity-0 transition group-hover:opacity-100 hover:bg-red-500 focus-visible:opacity-100 disabled:hidden"
              onClick={() => {
                if (window.confirm(`ลบหน้า ${index + 1} (${page.name}) ออกจากโปรเจกต์?`)) removePage(page.id);
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}

      <ImagePickerButton
        onFiles={onAddFiles}
        className="flex h-24 w-[4.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border text-xs text-muted transition hover:border-primary/50 hover:text-foreground lg:h-20 lg:w-full"
      >
        <ImagePlus size={18} />
        เพิ่มหน้า
      </ImagePickerButton>
    </nav>
  );
}
