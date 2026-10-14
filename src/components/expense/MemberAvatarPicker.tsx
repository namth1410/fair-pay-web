import { Check, Minus } from 'lucide-react';
import { useRef } from 'react';

import { useHorizontalWheel } from '../../hooks/useHorizontalWheel';
import { Avatar } from '../ui/Avatar';

/**
 * Chọn 1 thành viên bằng hàng avatar cuộn ngang (giao diện "Hội thoại", khớp MemberAvatarPicker
 * của app — thay chip chữ ở mục "Ai trả?"). Avatar được chọn có viền xanh + dấu tích. Option có
 * key bắt đầu bằng "__" (vd "__none__" = Không chọn) hiện vòng tròn nét đứt thay avatar.
 */
export function MemberAvatarPicker({
  options,
  selected,
  onSelect,
  ariaLabel = 'Người trả',
}: {
  /** label = chữ dưới avatar; name = tên thật để lấy chữ cái đầu (mặc định = label, vd "Bạn" vẫn hiện NT). */
  options: { key: string; label: string; name?: string }[];
  selected: string | null;
  onSelect: (key: string) => void;
  ariaLabel?: string;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useHorizontalWheel(rowRef);

  return (
    <div ref={rowRef} role="radiogroup" aria-label={ariaLabel} className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1 py-0.5">
      {options.map((o) => {
        const isSelected = o.key === selected;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={o.label}
            onClick={() => {
              if (!isSelected) onSelect(o.key);
            }}
            className="group flex w-16 shrink-0 flex-col items-center gap-1"
          >
            <span
              className={`relative flex h-[54px] w-[54px] items-center justify-center rounded-full border-[2.5px] transition-colors ${
                isSelected ? 'border-accent' : 'border-transparent group-hover:border-border'
              }`}
            >
              {o.key.startsWith('__') ? (
                <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full border-2 border-dashed border-[color-mix(in_oklab,var(--muted)_70%,transparent)] text-muted">
                  <Minus className="h-5 w-5" strokeWidth={2.2} />
                </span>
              ) : (
                <Avatar seed={o.key} label={o.name ?? o.label} size={46} />
              )}
              {isSelected ? (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-surface bg-accent text-accent-foreground">
                  <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                </span>
              ) : null}
            </span>
            <span className={`w-full truncate text-center text-xs ${isSelected ? 'font-bold text-accent' : 'font-medium text-muted'}`}>
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
