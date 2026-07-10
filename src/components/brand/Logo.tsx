import { Zap } from 'lucide-react';
import { BRAND } from '@/config/brand';
import { cn } from '@/lib/utils';

// ─── Tamanhos disponíveis ─────────────────────────────────────────────────────

const SIZES = {
  xs: { box: 'h-6 w-6',  icon: 'h-3 w-3',   text: 'text-sm',  gap: 'gap-2',   rounded: 'rounded-md' },
  sm: { box: 'h-7 w-7',  icon: 'h-4 w-4',   text: 'text-base', gap: 'gap-2.5', rounded: 'rounded-lg' },
  md: { box: 'h-8 w-8',  icon: 'h-4.5 w-4.5', text: 'text-lg', gap: 'gap-2.5', rounded: 'rounded-lg' },
  lg: { box: 'h-10 w-10', icon: 'h-5 w-5',  text: 'text-xl',  gap: 'gap-3',   rounded: 'rounded-xl' },
  xl: { box: 'h-14 w-14', icon: 'h-7 w-7',  text: 'text-2xl', gap: 'gap-3',   rounded: 'rounded-2xl' },
} as const;

export type LogoSize = keyof typeof SIZES;

// ─── Ícone isolado ─────────────────────────────────────────────────────────────

export function LogoIcon({
  size = 'sm',
  className,
}: {
  size?: LogoSize;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-brand-600 shadow-md shadow-brand-500/30',
        s.box,
        s.rounded,
        className
      )}
    >
      <Zap className={cn('text-white', s.icon)} />
    </div>
  );
}

// ─── Texto da marca ────────────────────────────────────────────────────────────

export function LogoText({
  size = 'sm',
  className,
}: {
  size?: LogoSize;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <span className={cn('font-bold tracking-tight leading-none', s.text, className)}>
      <span className="text-brand-400">{BRAND.namePart1}</span>
      <span className="text-white">{BRAND.namePart2}</span>
    </span>
  );
}

// ─── Logo completa (ícone + texto) ────────────────────────────────────────────

export function Logo({
  size = 'sm',
  showText = true,
  className,
}: {
  size?: LogoSize;
  showText?: boolean;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <div className={cn('flex items-center', s.gap, className)}>
      <LogoIcon size={size} />
      {showText && <LogoText size={size} />}
    </div>
  );
}
