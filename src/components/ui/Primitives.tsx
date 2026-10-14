import type { LucideIcon } from 'lucide-react';
import { CircleAlert } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

// ── ChipPicker: chip chọn 1 (radio) ────────────────────────────────────────

export interface ChipOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function ChipPicker<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
  tone = 'default',
}: {
  options: ChipOption<T>[];
  value: T | null;
  onChange: (v: T) => void;
  ariaLabel: string;
  className?: string;
  tone?: 'default' | 'success';
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`flex flex-wrap gap-2 ${className}`}>
      {options.map((o) => {
        const selected = o.value === value;
        const selectedCls =
          tone === 'success'
            ? 'border-money-positive bg-[color-mix(in_oklab,var(--money-positive)_12%,transparent)] text-money-positive'
            : 'border-foreground bg-surface-secondary text-foreground';
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={`max-w-full truncate rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
              selected ? selectedCls : 'border-border text-muted hover:border-foreground/30 hover:text-foreground'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── SegmentedTabs: thanh tab dạng viên thuốc ───────────────────────────────

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  badge?: number;
}

export function SegmentedTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
  className = '',
  stretch = false,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
  stretch?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  // Tràn ngang (vd 5 tab trên điện thoại): mờ mép phía còn nội dung + cuộn tab đang chọn vào giữa.
  const updateFade = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const next = { left: el.scrollLeft > 2, right: max - el.scrollLeft > 2 };
    setFade((prev) => (prev.left === next.left && prev.right === next.right ? prev : next));
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    updateFade();
    const ro = new ResizeObserver(updateFade);
    ro.observe(el);
    return () => ro.disconnect();
  }, [updateFade, tabs.length]);

  const didInitialScroll = useRef(false);
  useEffect(() => {
    const el = listRef.current;
    const active = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !active || el.scrollWidth <= el.clientWidth) return;
    // Lần đầu (vd mở thẳng ?tab=manage) cuộn tức thì; các lần đổi tab sau thì cuộn mượt.
    el.scrollTo({
      left: active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2,
      behavior: didInitialScroll.current ? 'smooth' : 'auto',
    });
    didInitialScroll.current = true;
    updateFade();
  }, [value, updateFade]);

  const mask =
    fade.left || fade.right
      ? `linear-gradient(to right, ${fade.left ? 'transparent 0, black 28px' : 'black 0'}, ${
          fade.right ? 'black calc(100% - 28px), transparent 100%' : 'black 100%'
        })`
      : undefined;

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      onScroll={updateFade}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
      className={`scrollbar-none flex gap-1 overflow-x-auto rounded-2xl bg-surface-secondary p-1 ${className}`}
    >
      {tabs.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={`relative flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-medium transition-all sm:px-3.5 sm:text-sm ${
              stretch ? 'flex-1' : ''
            } ${active ? 'bg-surface text-foreground shadow-surface' : 'text-muted hover:text-foreground'}`}
          >
            {t.label}
            {t.badge ? (
              <span className="min-w-5 rounded-full bg-danger px-1.5 text-center text-[11px] font-semibold leading-5 text-danger-foreground">
                {t.badge > 9 ? '9+' : t.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────

export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
  className = '',
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative flex flex-col items-center px-6 py-12 text-center ${className}`}>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-6 h-40 w-40 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,var(--surface-tertiary),transparent_70%)] opacity-80" />
      </div>
      {Icon ? (
        <div className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface shadow-surface">
          <Icon className="h-6 w-6 text-muted" strokeWidth={1.75} />
        </div>
      ) : null}
      <p className="relative text-base font-semibold text-foreground">{title}</p>
      {subtitle ? <p className="relative mt-1 max-w-[280px] text-sm leading-5 text-muted">{subtitle}</p> : null}
      {action ? <div className="relative mt-5">{action}</div> : null}
    </div>
  );
}

// ── ErrorBox / InfoBox ─────────────────────────────────────────────────────

export function ErrorBox({ children, className = '' }: { children: ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 rounded-xl bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] px-3 py-2.5 text-sm leading-5 text-danger ${className}`}
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function InfoBox({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  tone?: 'default' | 'success' | 'warning';
  className?: string;
}) {
  const cls =
    tone === 'success'
      ? 'bg-[color-mix(in_oklab,var(--money-positive)_12%,transparent)] text-foreground'
      : tone === 'warning'
        ? 'bg-[color-mix(in_oklab,var(--warning)_16%,transparent)] text-foreground'
        : 'bg-surface-secondary text-foreground';
  return <div className={`rounded-xl px-3 py-2.5 text-sm leading-5 ${cls} ${className}`}>{children}</div>;
}

// ── SectionLabel: "NHÓM CỦA BẠN  03 ─────" ────────────────────────────────

export function SectionLabel({
  children,
  count,
  right,
  className = '',
}: {
  children: ReactNode;
  count?: number;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{children}</span>
      {count !== undefined ? (
        <span className="tabular rounded-md bg-surface-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted">
          {String(count).padStart(2, '0')}
        </span>
      ) : null}
      <span className="h-px flex-1 bg-border" />
      {right}
    </div>
  );
}

// ── Card bề mặt ────────────────────────────────────────────────────────────

export function Panel({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li';
}) {
  return (
    <Tag className={`rounded-2xl border border-border/70 bg-surface shadow-surface ${className}`}>{children}</Tag>
  );
}

// ── Pill trạng thái ────────────────────────────────────────────────────────

export function Pill({
  children,
  tone = 'default',
  className = '',
}: {
  children: ReactNode;
  tone?: 'default' | 'success' | 'danger' | 'warning' | 'accent' | 'muted';
  className?: string;
}) {
  const cls = {
    default: 'bg-surface-secondary text-foreground',
    muted: 'bg-surface-secondary text-muted',
    success: 'balance-pill-positive',
    danger: 'balance-pill-negative',
    warning: 'bg-[color-mix(in_oklab,var(--warning)_18%,transparent)] text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]',
    accent: 'bg-foreground text-background',
  }[tone];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-4 ${cls} ${className}`}>
      {children}
    </span>
  );
}
