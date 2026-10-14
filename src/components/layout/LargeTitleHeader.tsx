import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface LargeTitleHeaderProps {
  title: ReactNode;
  /** Dòng phụ nhỏ dưới tiêu đề (tuỳ chọn). */
  subtitle?: ReactNode;
  /** Nút hành động bên phải (thường là HeaderIconButton). */
  right?: ReactNode;
  className?: string;
}

/**
 * Header tiêu đề lớn căn trái cho các trang tab (Nhóm / Preset / Thông báo / Cài đặt) — kiểu
 * app nhắn tin, khớp LargeTitleHeader của app. Trong cột danh sách desktop thì nhỏ lại một nấc.
 */
export function LargeTitleHeader({ title, subtitle, right, className = '' }: LargeTitleHeaderProps) {
  return (
    <header className={`flex min-h-[66px] items-center justify-between gap-3 px-5 pb-3 pt-5 md:pt-4 ${className}`}>
      <div className="min-w-0">
        <h1 className="truncate text-[30px] font-extrabold leading-9 tracking-[-0.02em] text-foreground md:text-[26px] md:leading-8">
          {title}
        </h1>
        {subtitle ? <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p> : null}
      </div>
      {right ? <div className="flex shrink-0 items-center gap-2">{right}</div> : null}
    </header>
  );
}

/**
 * Khung trang tab không chia vùng (Preset / Thông báo / Cài đặt): tiêu đề lớn dính trên cùng +
 * nội dung trong cột giữa (desktop) — cả trang là 1 vùng cuộn.
 */
export function TabPage({
  title,
  subtitle,
  right,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-surface">
      <div className="mx-auto w-full max-w-2xl pb-10">
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-xl">
          <LargeTitleHeader title={title} subtitle={subtitle} right={right} />
        </div>
        {children}
      </div>
    </div>
  );
}

interface HeaderIconButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** 'soft' = nền xám nhạt (header tiêu đề lớn); 'ghost' = trong suốt (header gọn). */
  variant?: 'soft' | 'ghost';
  badge?: number;
}

/** Nút tròn 40–44px cho header. */
export function HeaderIconButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = 'soft',
  badge,
}: HeaderIconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground transition-colors disabled:pointer-events-none disabled:opacity-35 ${
        variant === 'soft'
          ? 'bg-surface-secondary hover:bg-surface-tertiary'
          : 'hover:bg-surface-secondary'
      }`}
    >
      <Icon className="h-5 w-5" strokeWidth={2} />
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-danger-foreground ring-2 ring-surface">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </button>
  );
}
