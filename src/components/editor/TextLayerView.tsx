'use client';

import { memo, useEffect, useRef, type PointerEvent } from 'react';
import { useFontsVersion } from '@/hooks/useFontsVersion';
import { fontFamily } from '@/lib/fonts';
import { moveBox, resizeBox, RESIZE_HANDLES, roundBox, type Box, type ResizeHandle } from '@/lib/geometry';
import type { TextLayer } from '@/lib/project';
import { backgroundRadius, layoutText } from '@/lib/text-layout';
import { useProjectStore } from '@/store/project-store';

/** Smallest box the user can resize a layer to, in page pixels. */
const MIN_BOX_SIZE = 12;

const HANDLE_POSITIONS: Record<ResizeHandle, string> = {
  nw: '-top-1.5 -left-1.5 cursor-nwse-resize',
  n: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
  ne: '-top-1.5 -right-1.5 cursor-nesw-resize',
  e: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize',
  se: '-right-1.5 -bottom-1.5 cursor-nwse-resize',
  s: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize',
  sw: '-bottom-1.5 -left-1.5 cursor-nesw-resize',
  w: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize',
};

interface Drag {
  pointerId: number;
  startX: number;
  startY: number;
  startBox: Box;
  /** Null when moving the whole layer. */
  handle: ResizeHandle | null;
}

interface TextLayerViewProps {
  pageId: string;
  layer: TextLayer;
  /** Screen pixels per page pixel. */
  scale: number;
  selected: boolean;
}

export const TextLayerView = memo(function TextLayerView({ pageId, layer, scale, selected }: TextLayerViewProps) {
  useFontsVersion(); // re-wrap the text once its web font has loaded
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const selectLayer = useProjectStore((state) => state.selectLayer);
  const requestTextEdit = useProjectStore((state) => state.requestTextEdit);
  const elementRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);

  useEffect(() => {
    if (selected) elementRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selected]);

  const { box, style } = layer;
  const layout = layoutText(layer.text, style, box, layer.shape);
  const lineHeight = layout.lineHeight * scale;

  function startDrag(event: PointerEvent<HTMLElement>, handle: ResizeHandle | null) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startBox: box, handle };
    selectLayer(layer.id, { inspect: true });
  }

  function drag(event: PointerEvent<HTMLElement>) {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = (event.clientX - current.startX) / scale;
    const dy = (event.clientY - current.startY) / scale;
    const next = current.handle
      ? resizeBox(current.startBox, layer.rotation, current.handle, dx, dy, MIN_BOX_SIZE)
      : moveBox(current.startBox, dx, dy);
    updateLayer(pageId, layer.id, { box: roundBox(next) });
  }

  function endDrag(event: PointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  return (
    <div
      ref={elementRef}
      className={`group absolute touch-none select-none ${selected ? 'z-10 cursor-move' : 'cursor-pointer'}`}
      style={{
        left: box.x * scale,
        top: box.y * scale,
        width: box.width * scale,
        height: box.height * scale,
        transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
      }}
      onPointerDown={(event) => startDrag(event, null)}
      onPointerMove={drag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDoubleClick={() => requestTextEdit(layer.id)}
    >
      {style.backgroundOpacity > 0 && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: style.backgroundColor,
            opacity: style.backgroundOpacity,
            borderRadius: layer.shape === 'ellipse' ? '50%' : backgroundRadius(box, layer.shape) * scale,
          }}
        />
      )}

      <div
        className="absolute inset-0 flex flex-col justify-center whitespace-pre"
        style={{
          fontFamily: fontFamily(style.fontId),
          fontSize: style.fontSize * scale,
          fontWeight: style.bold ? 700 : 400,
          fontStyle: style.italic ? 'italic' : 'normal',
          lineHeight: `${lineHeight}px`,
          textAlign: style.align,
          color: style.color,
          WebkitTextStroke: style.strokeWidth > 0 ? `${style.strokeWidth * scale}px ${style.strokeColor}` : undefined,
          paintOrder: 'stroke fill',
        }}
      >
        {layout.lines.map((line, index) => (
          <div
            key={index}
            className="shrink-0"
            style={{ height: lineHeight, width: line.width * scale, marginLeft: ((box.width - line.width) / 2) * scale }}
          >
            {line.text || '\u00a0'}
          </div>
        ))}
      </div>

      <div
        className={`pointer-events-none absolute inset-0 rounded-[2px] ${
          selected
            ? 'outline-2 outline-primary'
            : layer.text.trim()
              ? 'outline-1 outline-transparent outline-dashed group-hover:outline-white/70'
              : 'bg-cyan-400/10 outline-1 outline-cyan-400/80 outline-dashed' // not translated yet
        }`}
      />

      {selected &&
        RESIZE_HANDLES.map((handle) => (
          <span
            key={handle}
            aria-hidden
            className={`absolute size-3 rounded-[3px] border-2 border-primary bg-white shadow before:absolute before:-inset-2 before:content-[''] ${HANDLE_POSITIONS[handle]}`}
            onPointerDown={(event) => startDrag(event, handle)}
          />
        ))}
    </div>
  );
});
