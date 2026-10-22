'use client';

import { useRef, useState, type PointerEvent } from 'react';
import { Eraser, X } from 'lucide-react';
import { clamp, roundBox, type Box, type Point } from '@/lib/geometry';
import type { Page } from '@/lib/project';
import { useProjectStore } from '@/store/project-store';

/** Smallest area (in page pixels) that dragging adds; anything smaller was meant as a click. */
const MIN_AREA_SIZE = 6;

function boxStyle(box: Box, scale: number) {
  return { left: box.x * scale, top: box.y * scale, width: box.width * scale, height: box.height * scale };
}

function boxBetween(a: Point, b: Point): Box {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

interface EraseAreaPickerProps {
  page: Page;
  scale: number;
  /** Called after the user changes what gets erased. */
  onChange: () => void;
}

/**
 * Overlay for choosing which original text gets erased: detected text boxes are toggled by
 * clicking, dragging marks an extra area to erase (text OCR missed), and clicking a drawn
 * area removes it.
 */
export function EraseAreaPicker({ page, scale, onChange }: EraseAreaPickerProps) {
  const mapLayers = useProjectStore((state) => state.mapLayers);
  const addEraseArea = useProjectStore((state) => state.addEraseArea);
  const removeEraseArea = useProjectStore((state) => state.removeEraseArea);
  const [draft, setDraft] = useState<Box | null>(null);
  const startRef = useRef<{ pointerId: number; point: Point } | null>(null);

  function pagePoint(event: PointerEvent<HTMLElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / scale, 0, page.width),
      y: clamp((event.clientY - rect.top) / scale, 0, page.height),
    };
  }

  function startArea(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = { pointerId: event.pointerId, point: pagePoint(event) };
  }

  function growArea(event: PointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (start?.pointerId === event.pointerId) setDraft(boxBetween(start.point, pagePoint(event)));
  }

  function finishArea(event: PointerEvent<HTMLDivElement>) {
    if (startRef.current?.pointerId !== event.pointerId) return;
    startRef.current = null;
    if (draft && draft.width >= MIN_AREA_SIZE && draft.height >= MIN_AREA_SIZE) {
      addEraseArea(page.id, roundBox(draft));
      onChange();
    }
    setDraft(null);
  }

  return (
    <div
      className="absolute inset-0 cursor-crosshair touch-none"
      onPointerDown={startArea}
      onPointerMove={growArea}
      onPointerUp={finishArea}
      onPointerCancel={() => {
        startRef.current = null;
        setDraft(null);
      }}
    >
      {page.layers.map(
        (layer, index) =>
          layer.sourceBox && (
            <button
              key={layer.id}
              type="button"
              aria-pressed={layer.erase}
              aria-label={`กล่อง #${index + 1}: ${layer.erase ? 'ลบข้อความเดิม' : 'เก็บข้อความเดิมไว้'}`}
              title={layer.sourceText || `กล่อง #${index + 1}`}
              className={`absolute rounded-sm border-2 transition ${
                layer.erase
                  ? 'border-primary bg-primary/10 hover:bg-primary/25'
                  : 'border-dashed border-white/80 bg-black/5 hover:bg-white/15'
              }`}
              style={boxStyle(layer.sourceBox, scale)}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => {
                mapLayers(page.id, (candidate) =>
                  candidate.id === layer.id ? { ...candidate, erase: !candidate.erase } : candidate,
                );
                onChange();
              }}
            >
              {layer.erase && (
                <Eraser
                  size={14}
                  aria-hidden
                  className="absolute -top-2 -right-2 rounded-full bg-primary p-0.5 text-white shadow"
                />
              )}
            </button>
          ),
      )}

      {page.manualEraseAreas.map((area, index) => (
        <button
          key={`manual-${index}-${area.x}-${area.y}`}
          type="button"
          aria-label={`พื้นที่ที่วาด #${index + 1}: คลิกเพื่อเอาออก`}
          title="คลิกเพื่อเอาพื้นที่นี้ออก (ข้อความต้นฉบับจะกลับมา)"
          className="absolute rounded-sm border-2 border-primary bg-primary/10 transition hover:bg-red-500/25"
          style={boxStyle(area, scale)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => {
            removeEraseArea(page.id, index);
            onChange();
          }}
        >
          <X
            size={14}
            aria-hidden
            className="absolute -top-2 -right-2 rounded-full bg-primary p-0.5 text-white shadow"
          />
        </button>
      ))}

      {draft && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-primary bg-primary/15"
          style={boxStyle(draft, scale)}
        />
      )}
    </div>
  );
}
