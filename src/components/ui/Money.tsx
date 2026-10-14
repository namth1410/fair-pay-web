import { memo } from 'react';

import { formatThousands } from '../../utils/format';

type MoneyTone = 'default' | 'success' | 'danger' | 'muted' | 'auto';
type MoneySize = 'hero' | 'display' | 'lg' | 'md' | 'sm';

interface MoneyProps {
  value: number;
  /** Hiện dấu + / - (quy ước: âm = đang nợ, dương = được nợ). Truyền số dư CÓ DẤU. */
  showSign?: boolean;
  /** 'auto' → xanh khi > 0, đỏ khi < 0, mặc định khi = 0. */
  tone?: MoneyTone;
  size?: MoneySize;
  className?: string;
}

const SIZE: Record<MoneySize, { num: string; unit: string }> = {
  hero: { num: 'text-[40px] leading-[46px] font-bold tracking-tight', unit: 'text-xl' },
  display: { num: 'text-[28px] leading-8 font-bold tracking-tight', unit: 'text-base' },
  lg: { num: 'text-xl leading-7 font-semibold', unit: 'text-sm' },
  md: { num: 'text-base leading-6 font-semibold', unit: 'text-xs' },
  sm: { num: 'text-sm leading-5 font-semibold', unit: 'text-[11px]' },
};

function toneClass(tone: MoneyTone, value: number): string {
  if (tone === 'auto') {
    if (value > 0) return 'text-money-positive';
    if (value < 0) return 'text-money-negative';
    return 'text-foreground';
  }
  switch (tone) {
    case 'success':
      return 'text-money-positive';
    case 'danger':
      return 'text-money-negative';
    case 'muted':
      return 'text-muted';
    default:
      return 'text-foreground';
  }
}

/** Số tiền VND: "150.000đ" (đơn vị "đ" thường như app) với đơn vị nhỏ hơn, chữ số tabular. */
export const Money = memo(function Money({
  value,
  showSign = false,
  tone = 'default',
  size = 'md',
  className = '',
}: MoneyProps) {
  const rounded = Math.round(value);
  const sign = showSign ? (rounded >= 0 ? '+' : '-') : rounded < 0 ? '-' : '';
  const s = SIZE[size];
  return (
    <span className={`tabular inline-flex items-baseline whitespace-nowrap ${toneClass(tone, rounded)} ${className}`}>
      <span className={s.num}>
        {sign}
        {formatThousands(Math.abs(rounded)) || '0'}
      </span>
      <span className={`${s.unit} ml-0.5 font-medium opacity-80`}>đ</span>
    </span>
  );
});
