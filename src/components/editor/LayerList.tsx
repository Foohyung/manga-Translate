'use client';

import { ScanText, Trash } from 'lucide-react';
import { IconButton } from '@/components/ui/Button';
import { TEXTAREA_CLASSES } from '@/components/ui/fields';
import { useActivePage, useProjectStore } from '@/store/project-store';

/** Every text layer of the page, with its recognized text and translation side by side. */
export function LayerList() {
  const page = useActivePage();
  const selectedLayerId = useProjectStore((state) => state.selectedLayerId);
  const selectLayer = useProjectStore((state) => state.selectLayer);
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const removeLayer = useProjectStore((state) => state.removeLayer);

  if (!page || page.layers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
        <ScanText size={28} className="opacity-60" />
        ยังไม่มีข้อความในหน้านี้
        <span className="text-xs">กด “ดึงข้อความ” เพื่ออ่านข้อความจากภาพ หรือ “เพิ่มข้อความ” เพื่อวางเอง</span>
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {page.layers.map((layer, index) => (
        <li
          key={layer.id}
          className={`space-y-2 rounded-xl border p-3 transition ${
            layer.id === selectedLayerId ? 'border-primary/60 bg-primary/5' : 'border-border bg-white/[0.02]'
          }`}
          onFocusCapture={() => selectLayer(layer.id)}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary hover:bg-primary/20"
              onClick={() => selectLayer(layer.id, { inspect: true })}
            >
              #{index + 1} ปรับแต่ง
            </button>
            {layer.sourceBox && (
              <label className="mr-1 ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  className="size-3.5 accent-primary"
                  checked={layer.erase}
                  onChange={(event) => updateLayer(page.id, layer.id, { erase: event.target.checked })}
                />
                ลบข้อความเดิม
              </label>
            )}
            <IconButton label={`ลบกล่อง #${index + 1}`} onClick={() => removeLayer(page.id, layer.id)}>
              <Trash size={14} />
            </IconButton>
          </div>
          {layer.sourceBox && (
            <label className="block space-y-1 text-xs text-muted">
              ต้นฉบับ (แก้ได้ก่อนแปล)
              <textarea
                rows={2}
                className={TEXTAREA_CLASSES}
                value={layer.sourceText}
                onChange={(event) => updateLayer(page.id, layer.id, { sourceText: event.target.value })}
              />
            </label>
          )}
          <label className="block space-y-1 text-xs text-muted">
            คำแปล
            <textarea
              rows={2}
              className={TEXTAREA_CLASSES}
              placeholder="ยังไม่ได้แปล — กด “แปลภาษา” หรือพิมพ์เอง"
              value={layer.text}
              onChange={(event) => updateLayer(page.id, layer.id, { text: event.target.value })}
            />
          </label>
        </li>
      ))}
    </ol>
  );
}
