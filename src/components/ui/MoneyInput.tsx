import { FieldError, Input, Label, TextField } from '@heroui/react';
import { useMemo, useState } from 'react';

import { computeMoneySuggestions, formatThousands, parseMoneyInput } from '../../utils/format';

interface MoneyInputProps {
  label?: string;
  /** Chuỗi chữ số thô (vd "150000"). */
  value: string;
  onChange: (digits: string) => void;
  placeholder?: string;
  error?: string | null;
  autoFocus?: boolean;
  /** Hiện chip gợi ý nhanh khi đang focus (mặc định bật). */
  suggestions?: boolean;
  size?: 'md' | 'lg';
  maxDigits?: number;
  className?: string;
  ariaLabel?: string;
}

/**
 * Ô nhập tiền VND: hiển thị dấu chấm hàng nghìn, chỉ nhận chữ số; khi focus hiện
 * 3 chip gợi ý (`computeMoneySuggestions` — giống MoneyChipsDock của app).
 */
export function MoneyInput({
  label,
  value,
  onChange,
  placeholder = '0',
  error,
  autoFocus,
  suggestions = true,
  size = 'md',
  maxDigits = 12,
  className = '',
  ariaLabel,
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const chips = useMemo(() => computeMoneySuggestions(value), [value]);

  return (
    <div className={`w-full ${className}`}>
      <TextField
        className="w-full"
        value={formatThousands(value)}
        onChange={(text) => onChange(parseMoneyInput(text).slice(0, maxDigits))}
        isInvalid={!!error}
        autoFocus={autoFocus}
        aria-label={label ? undefined : ariaLabel ?? placeholder}
      >
        {label ? <Label>{label}</Label> : null}
        <div className="relative">
          <Input
            fullWidth
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            className={`tabular pr-9 ${size === 'lg' ? 'h-12 text-lg font-semibold' : 'font-semibold'}`}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-muted">
            ₫
          </span>
        </div>
        <FieldError>{error}</FieldError>
      </TextField>
      {suggestions && focused && chips.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Gợi ý số tiền">
          {chips.map((amount) => (
            <button
              key={amount}
              type="button"
              // mousedown preventDefault: giữ focus ở ô nhập (chip không cướp focus).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(String(amount))}
              className="tabular rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-secondary active:scale-[0.98]"
            >
              {formatThousands(amount)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
