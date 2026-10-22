'use client';

import { useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { clamp } from '@/lib/geometry';

const CONTROL_CLASSES =
  'min-w-0 rounded-lg border border-border bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20';
const INPUT_CLASSES = `${CONTROL_CLASSES} h-8 w-full`;

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-xs font-medium text-muted ${className}`}>
      {label}
      {children}
    </label>
  );
}

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-[11px] font-semibold tracking-wider text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  'aria-label'?: string;
}

/** A number field that lets the user clear it while typing; only valid numbers are reported. */
export function NumberInput({ value, onChange, min = -Infinity, max = Infinity, step = 1, ...rest }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = String(Math.round(value * 100) / 100);

  return (
    <input
      type="number"
      inputMode="decimal"
      className={INPUT_CLASSES}
      value={draft ?? shown}
      min={Number.isFinite(min) ? min : undefined}
      max={Number.isFinite(max) ? max : undefined}
      step={step}
      onFocus={() => setDraft(shown)}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = Number(event.target.value);
        if (event.target.value.trim() !== '' && Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
      }}
      {...rest}
    />
  );
}

interface RangeInputProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  /** Formats the value shown next to the label. */
  format?: (value: number) => string;
}

export function RangeInput({ value, onChange, min, max, step = 1, label, format = String }: RangeInputProps) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
      <span className="flex justify-between">
        {label}
        <span className="text-foreground tabular-nums">{format(value)}</span>
      </span>
      <input
        type="range"
        className="w-full accent-primary"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function ColorInput({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        aria-label={label}
        className="size-8 shrink-0 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        aria-label={`${label} (รหัสสี)`}
        spellCheck={false}
        maxLength={7}
        className={`${INPUT_CLASSES} font-mono uppercase`}
        value={draft ?? value}
        onFocus={() => setDraft(value)}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          setDraft(event.target.value);
          if (HEX_COLOR.test(event.target.value)) onChange(event.target.value.toLowerCase());
        }}
      />
    </div>
  );
}

/** `className` sets the size; by default the select fills its container. */
export function Select({ className = 'h-8 w-full', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`${CONTROL_CLASSES} cursor-pointer ${className}`} {...props} />;
}

export const TEXTAREA_CLASSES =
  'w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20';
