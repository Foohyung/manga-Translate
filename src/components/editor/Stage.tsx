'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import toast from 'react-hot-toast';
import { Check, Eraser, Eye, LoaderCircle, Maximize2, Minus, Plus, Type } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { errorMessage } from '@/lib/errors';
import { clamp } from '@/lib/geometry';
import { createBlankLayer, type Page } from '@/lib/project';
import { scheduleClean } from '@/store/pipeline';
import { useProjectStore } from '@/store/project-store';
import { EraseAreaPicker } from './EraseAreaPicker';
import { TextLayerView } from './TextLayerView';

/** Space around the page inside the scroll area, in screen pixels. */
const STAGE_PADDING = 24;
const ZOOM_STEP = 1.25;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8;

/** The page with its text layers, plus view controls. Opens at 100% (the image's real size). */
export function Stage({ page }: { page: Page }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  /** Screen pixels per page pixel, or 'fit' to fill the visible width. */
  const [zoom, setZoom] = useState<number | 'fit'>(1);
  const [showOriginal, setShowOriginal] = useState(false);
  /** Choosing what original text to erase, with the result shown live. */
  const [pickingErase, setPickingErase] = useState(false);
  const selectedLayerId = useProjectStore((state) => state.selectedLayerId);
  const selectLayer = useProjectStore((state) => state.selectLayer);
  const addLayer = useProjectStore((state) => state.addLayer);
  const mapLayers = useProjectStore((state) => state.mapLayers);
  const cleaning = useProjectStore((state) => state.pageTasks[page.id] === 'clean');

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => setViewportWidth(entry.contentRect.width));
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  // The observed width excludes the padding, so this fits the page to the visible width.
  const fitScale = viewportWidth / page.width;
  const scale = zoom === 'fit' ? fitScale : zoom;
  const detected = page.layers.filter((layer) => layer.sourceBox);
  const chosen = detected.filter((layer) => layer.erase).length;

  /** Re-cleans the page so it shows the current choice of what to erase. */
  const applyErasing = () =>
    scheduleClean(page.id, (error) => toast.error(errorMessage(error, 'ลบข้อความเดิมไม่สำเร็จ')));

  function chooseAll(erase: boolean) {
    mapLayers(page.id, (layer) => (layer.sourceBox ? { ...layer, erase } : layer));
    applyErasing();
  }

  function togglePicking() {
    if (!pickingErase) applyErasing(); // show the result of the current choice right away
    setPickingErase(!pickingErase);
  }

  function addTextAtViewCenter() {
    const viewport = viewportRef.current?.getBoundingClientRect();
    const pageRect = pageRef.current?.getBoundingClientRect();
    const center =
      viewport && pageRect && scale > 0
        ? {
            x: (viewport.left + viewport.width / 2 - pageRect.left) / scale,
            y: (viewport.top + viewport.height / 2 - pageRect.top) / scale,
          }
        : { x: page.width / 2, y: page.height / 2 };
    addLayer(page.id, createBlankLayer(center, page));
    setShowOriginal(false);
    setPickingErase(false);
  }

  function deselectOnBackground(event: PointerEvent<HTMLDivElement>) {
    const viewport = event.currentTarget;
    const onScrollbar =
      event.target === viewport &&
      (event.nativeEvent.offsetX > viewport.clientWidth || event.nativeEvent.offsetY > viewport.clientHeight);
    if (!onScrollbar) selectLayer(null);
  }

  return (
    <section aria-label="พื้นที่จัดวางข้อความ" className="flex min-h-[60dvh] min-w-0 flex-1 flex-col lg:min-h-0">
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-2">
        <Button size="sm" onClick={addTextAtViewCenter}>
          <Type size={14} /> เพิ่มข้อความ
        </Button>
        <div className="mx-1 h-5 w-px bg-border" />
        <IconButton
          label={showOriginal ? 'แสดงงานแปล' : 'ดูภาพต้นฉบับ'}
          active={showOriginal}
          onClick={() => setShowOriginal((value) => !value)}
        >
          <Eye size={16} />
        </IconButton>
        <Button
          size="sm"
          variant={pickingErase ? 'primary' : 'secondary'}
          aria-pressed={pickingErase}
          title="เลือกว่าจะลบข้อความเดิมในกล่องไหน หรือวาดกรอบตรงที่ต้องลบเพิ่ม"
          onClick={togglePicking}
        >
          <Eraser size={14} /> เลือกกล่องที่จะลบ
        </Button>

        <div className="ml-auto flex items-center gap-1">
          <IconButton
            label="ย่อ"
            disabled={scale <= MIN_ZOOM}
            onClick={() => setZoom(clamp(scale / ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
          >
            <Minus size={16} />
          </IconButton>
          <button
            type="button"
            title="ขนาดจริง (100%)"
            className="w-12 rounded-md py-1 text-center text-xs text-muted tabular-nums hover:bg-white/5 hover:text-foreground"
            onClick={() => setZoom(1)}
          >
            {Math.round(scale * 100)}%
          </button>
          <IconButton
            label="ขยาย"
            disabled={scale >= MAX_ZOOM}
            onClick={() => setZoom(clamp(scale * ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
          >
            <Plus size={16} />
          </IconButton>
          <IconButton label="พอดีความกว้าง" onClick={() => setZoom('fit')}>
            <Maximize2 size={15} />
          </IconButton>
        </div>
      </div>

      {pickingErase && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <span className="text-muted">
            คลิกกล่องเพื่อเลือกหรือยกเลิก · วาดกรอบตรงที่ต้องลบเพิ่ม · คลิกกรอบที่วาดเพื่อเอาออก
          </span>
          <span className="font-semibold text-foreground">
            ลบ {chosen}/{detected.length} กล่อง
            {page.manualEraseAreas.length > 0 && ` · วาดเพิ่ม ${page.manualEraseAreas.length} กรอบ`}
          </span>
          {cleaning && (
            <span className="flex items-center gap-1 text-primary">
              <LoaderCircle size={12} className="animate-spin" /> กำลังอัปเดตภาพ…
            </span>
          )}
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" disabled={chosen === detected.length} onClick={() => chooseAll(true)}>
              เลือกทั้งหมด
            </Button>
            <Button size="sm" variant="ghost" disabled={chosen === 0} onClick={() => chooseAll(false)}>
              ไม่เลือกเลย
            </Button>
            <Button size="sm" variant="primary" onClick={() => setPickingErase(false)}>
              <Check size={14} /> เสร็จ
            </Button>
          </div>
        </div>
      )}

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 overflow-auto bg-[#0e0e11] [scrollbar-gutter:stable]"
        style={{ padding: STAGE_PADDING }}
        onPointerDown={deselectOnBackground}
      >
        {scale > 0 && (
          <div
            ref={pageRef}
            className="relative mx-auto shadow-2xl ring-1 shadow-black/50 ring-white/10"
            style={{ width: page.width * scale, height: page.height * scale }}
          >
            <img
              src={showOriginal ? page.originalUrl : (page.cleanedUrl ?? page.originalUrl)}
              alt={`หน้า ${page.name}`}
              draggable={false}
              className="pointer-events-none absolute inset-0 size-full select-none"
            />

            {pickingErase && <EraseAreaPicker page={page} scale={scale} onChange={applyErasing} />}

            {!showOriginal &&
              !pickingErase &&
              page.layers.map((layer) => (
                <TextLayerView
                  key={layer.id}
                  pageId={page.id}
                  layer={layer}
                  scale={scale}
                  selected={layer.id === selectedLayerId}
                />
              ))}
          </div>
        )}
      </div>
    </section>
  );
}
