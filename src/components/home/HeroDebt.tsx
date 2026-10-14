import { Money } from '../ui/Money';
import { Pill } from '../ui/Primitives';

/** Thẻ tổng số dư trên mọi nhóm (chỉ chuyến đang mở) — HeroDebt của app. */
export function HeroDebt({ total, loading }: { total: number; loading?: boolean }) {
  const mode = total > 0 ? 'positive' : total < 0 ? 'negative' : 'zero';
  const label = mode === 'positive' ? 'Bạn đang được nợ' : mode === 'negative' ? 'Bạn đang nợ' : 'Tổng quan số dư';
  const pill = mode === 'positive' ? 'được nhận' : mode === 'negative' ? 'cần trả' : 'đã thanh toán';
  const foot = mode === 'zero' ? 'Không còn khoản nào cần thanh toán' : 'trên tất cả các nhóm đang hoạt động';
  const tint =
    mode === 'positive'
      ? 'from-[color-mix(in_oklab,var(--money-positive)_16%,var(--surface))] to-surface'
      : mode === 'negative'
        ? 'from-[color-mix(in_oklab,var(--money-negative)_14%,var(--surface))] to-surface'
        : 'from-surface-secondary to-surface';

  return (
    <section
      className={`relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br ${tint} p-6 shadow-surface`}
      aria-label="Tổng số dư"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-shine absolute -inset-y-10 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent dark:via-white/5" />
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,var(--surface-tertiary),transparent_70%)] opacity-70" />
      </div>
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted">{label}</p>
          <Pill tone={mode === 'positive' ? 'success' : mode === 'negative' ? 'danger' : 'muted'}>{pill}</Pill>
        </div>
        <div className={`mt-2 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <Money
            value={Math.abs(total)}
            size="hero"
            tone={mode === 'positive' ? 'success' : mode === 'negative' ? 'danger' : 'default'}
          />
        </div>
        <p className="mt-1 text-xs text-muted">{foot}</p>
      </div>
    </section>
  );
}
