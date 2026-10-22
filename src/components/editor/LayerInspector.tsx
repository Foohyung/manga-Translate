'use client';

import { useEffect, useRef } from 'react';
import {
  Bold,
  Circle,
  Copy,
  Italic,
  Languages,
  MousePointerClick,
  Scaling,
  Square,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignStart,
  Trash,
} from 'lucide-react';
import { Button, IconButton } from '@/components/ui/Button';
import { ColorInput, Field, FieldGroup, NumberInput, RangeInput, Select, TEXTAREA_CLASSES } from '@/components/ui/fields';
import { useEditorCommands } from '@/hooks/useEditorCommands';
import { LETTERING_FONTS, type FontId } from '@/lib/fonts';
import type { Shape } from '@/lib/geometry';
import { duplicateLayer, type TextAlign, type TextLayer, type TextStyle } from '@/lib/project';
import { fitFontSize } from '@/lib/text-layout';
import { useActivePage, useProjectStore, useSelectedLayer } from '@/store/project-store';

const SWATCHES = ['#111111', '#ffffff', '#e11d48', '#f97316', '#facc15', '#16a34a', '#2563eb', '#9333ea'];

const SHAPES: { value: Shape; label: string; icon: typeof Square }[] = [
  { value: 'rect', label: 'สี่เหลี่ยม', icon: Square },
  { value: 'ellipse', label: 'วงรี (บอลลูน)', icon: Circle },
];

const ALIGNMENTS: { value: TextAlign; label: string; icon: typeof TextAlignStart }[] = [
  { value: 'left', label: 'ชิดซ้าย', icon: TextAlignStart },
  { value: 'center', label: 'กึ่งกลาง', icon: TextAlignCenter },
  { value: 'right', label: 'ชิดขวา', icon: TextAlignEnd },
];

/** Text, typography, colour and geometry controls for the selected text layer. */
export function LayerInspector() {
  const page = useActivePage();
  const layer = useSelectedLayer();
  const updateLayer = useProjectStore((state) => state.updateLayer);
  const updateLayerStyle = useProjectStore((state) => state.updateLayerStyle);
  const removeLayer = useProjectStore((state) => state.removeLayer);
  const addLayer = useProjectStore((state) => state.addLayer);
  const textEditRequest = useProjectStore((state) => state.textEditRequest);
  const isTranslating = useProjectStore((state) => (page ? state.pageTasks[page.id] === 'translate' : false));
  const { translate } = useEditorCommands();
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textEditRequest > 0) textRef.current?.select();
  }, [textEditRequest]);

  if (!page || !layer) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
        <MousePointerClick size={28} className="opacity-60" />
        คลิกข้อความบนภาพเพื่อแก้ไข ลากเพื่อย้ายตำแหน่ง และลากมุมกรอบเพื่อปรับขนาด
      </div>
    );
  }

  const update = (patch: Partial<Omit<TextLayer, 'id'>>) => updateLayer(page.id, layer.id, patch);
  const setStyle = (patch: Partial<TextStyle>) => updateLayerStyle(page.id, layer.id, patch);
  const setBox = (patch: Partial<TextLayer['box']>) => update({ box: { ...layer.box, ...patch } });
  const { style } = layer;

  return (
    <div className="space-y-5">
      <FieldGroup title="ข้อความ">
        <Field label="ข้อความที่แสดง (คำแปล)">
          <textarea
            ref={textRef}
            rows={3}
            className={TEXTAREA_CLASSES}
            placeholder="ยังไม่ได้แปล — พิมพ์ข้อความที่ต้องการแสดง"
            value={layer.text}
            onChange={(event) => update({ text: event.target.value })}
          />
        </Field>
        {layer.sourceText && (
          <div className="space-y-2 rounded-lg bg-white/[0.03] p-3">
            <p className="text-xs text-muted">ต้นฉบับ</p>
            <p className="text-sm leading-relaxed break-words text-foreground/90">{layer.sourceText}</p>
            <Button size="sm" disabled={isTranslating} onClick={() => translate(page.id, [layer.id])}>
              <Languages size={14} /> แปลข้อความนี้ใหม่
            </Button>
          </div>
        )}
        {layer.sourceBox && (
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={layer.erase}
              onChange={(event) => update({ erase: event.target.checked })}
            />
            ลบข้อความเดิมใต้กล่องนี้
          </label>
        )}
      </FieldGroup>

      <FieldGroup title="ตัวอักษร">
        <Field label="ฟอนต์">
          <Select value={style.fontId} onChange={(event) => setStyle({ fontId: event.target.value as FontId })}>
            {LETTERING_FONTS.map((font) => (
              <option key={font.id} value={font.id}>
                {font.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <Field label="ขนาดตัวอักษร (px)">
            <NumberInput value={style.fontSize} min={6} max={400} onChange={(fontSize) => setStyle({ fontSize })} />
          </Field>
          <Button
            size="sm"
            title="ขยายหรือย่อตัวอักษรให้เต็มกรอบพอดี"
            onClick={() => setStyle({ fontSize: fitFontSize(layer.text, style, layer.box, layer.shape) })}
          >
            <Scaling size={14} /> พอดีกรอบ
          </Button>
        </div>
        <RangeInput
          label="ระยะห่างบรรทัด"
          min={0.8}
          max={2}
          step={0.05}
          value={style.lineHeight}
          format={(value) => value.toFixed(2)}
          onChange={(lineHeight) => setStyle({ lineHeight })}
        />
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <IconButton label="ตัวหนา" active={style.bold} onClick={() => setStyle({ bold: !style.bold })}>
              <Bold size={16} />
            </IconButton>
            <IconButton label="ตัวเอียง" active={style.italic} onClick={() => setStyle({ italic: !style.italic })}>
              <Italic size={16} />
            </IconButton>
          </div>
          <div className="flex gap-1" role="group" aria-label="การจัดวางข้อความ">
            {ALIGNMENTS.map(({ value, label, icon: Icon }) => (
              <IconButton key={value} label={label} active={style.align === value} onClick={() => setStyle({ align: value })}>
                <Icon size={16} />
              </IconButton>
            ))}
          </div>
        </div>
      </FieldGroup>

      <FieldGroup title="สี">
        <Field label="สีตัวอักษร">
          <ColorInput label="สีตัวอักษร" value={style.color} onChange={(color) => setStyle({ color })} />
        </Field>
        <div className="flex flex-wrap gap-1.5">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={`ใช้สี ${swatch}`}
              title={swatch}
              className={`size-6 rounded-full border transition hover:scale-110 ${
                style.color === swatch ? 'border-primary ring-2 ring-primary/40' : 'border-white/20'
              }`}
              style={{ backgroundColor: swatch }}
              onClick={() => setStyle({ color: swatch })}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="สีเส้นขอบ">
            <ColorInput label="สีเส้นขอบ" value={style.strokeColor} onChange={(strokeColor) => setStyle({ strokeColor })} />
          </Field>
          <Field label="ความหนาเส้นขอบ">
            <NumberInput value={style.strokeWidth} min={0} max={40} onChange={(strokeWidth) => setStyle({ strokeWidth })} />
          </Field>
          <Field label="สีพื้นหลัง">
            <ColorInput
              label="สีพื้นหลัง"
              value={style.backgroundColor}
              onChange={(backgroundColor) => setStyle({ backgroundColor })}
            />
          </Field>
          <RangeInput
            label="ความทึบพื้นหลัง"
            min={0}
            max={1}
            step={0.05}
            value={style.backgroundOpacity}
            format={(value) => `${Math.round(value * 100)}%`}
            onChange={(backgroundOpacity) => setStyle({ backgroundOpacity })}
          />
        </div>
      </FieldGroup>

      <FieldGroup title="ตำแหน่งและขนาด (px)">
        <div className="flex items-center justify-between text-xs font-medium text-muted">
          รูปทรงการจัดบรรทัด
          <div className="flex gap-1" role="group" aria-label="รูปทรงการจัดบรรทัด">
            {SHAPES.map(({ value, label, icon: Icon }) => (
              <IconButton key={value} label={label} active={layer.shape === value} onClick={() => update({ shape: value })}>
                <Icon size={15} />
              </IconButton>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="X">
            <NumberInput value={layer.box.x} onChange={(x) => setBox({ x })} />
          </Field>
          <Field label="Y">
            <NumberInput value={layer.box.y} onChange={(y) => setBox({ y })} />
          </Field>
          <Field label="กว้าง">
            <NumberInput value={layer.box.width} min={12} onChange={(width) => setBox({ width })} />
          </Field>
          <Field label="สูง">
            <NumberInput value={layer.box.height} min={12} onChange={(height) => setBox({ height })} />
          </Field>
        </div>
        <RangeInput
          label="หมุน"
          min={-180}
          max={180}
          value={layer.rotation}
          format={(value) => `${value}°`}
          onChange={(rotation) => update({ rotation })}
        />
      </FieldGroup>

      <div className="flex gap-2 border-t border-border pt-4">
        <Button size="sm" className="flex-1" onClick={() => addLayer(page.id, duplicateLayer(layer))}>
          <Copy size={14} /> ทำสำเนา
        </Button>
        <Button size="sm" variant="danger" className="flex-1" onClick={() => removeLayer(page.id, layer.id)}>
          <Trash size={14} /> ลบกล่องนี้
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted">
        คีย์ลัด: ลูกศรเพื่อเลื่อน (Shift = 10px) · Delete ลบ · Ctrl/⌘+D ทำสำเนา · Esc ยกเลิกการเลือก
      </p>
    </div>
  );
}
