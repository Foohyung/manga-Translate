import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-brand-gradient text-white shadow-lg shadow-primary/20 hover:brightness-110',
  secondary: 'border border-border bg-surface text-foreground hover:bg-white/5',
  ghost: 'text-muted hover:bg-white/5 hover:text-foreground',
  danger: 'border border-red-500/30 text-red-400 hover:bg-red-500/10',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-10 gap-2 px-4 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'secondary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex shrink-0 items-center justify-center rounded-xl font-medium whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...props}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name, also shown as a tooltip. */
  label: string;
  /** Set for toggle buttons. */
  active?: boolean;
}

export function IconButton({ label, active, className = '', ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg transition focus-visible:outline-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-40 ${
        active ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-white/5 hover:text-foreground'
      } ${className}`}
      {...props}
    />
  );
}
