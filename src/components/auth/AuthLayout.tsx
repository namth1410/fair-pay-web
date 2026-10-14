import { HandCoins, ReceiptText, Scale } from 'lucide-react';
import type { ReactNode } from 'react';

import { APP_SLOGAN } from '../../config/constants';
import { Wordmark } from '../brand/Wordmark';

const FEATURES = [
  { icon: ReceiptText, text: 'Ghi khoản chi nhóm trong vài giây, chia đều hay theo tỷ lệ đều được' },
  { icon: Scale, text: 'Tự tính ai nợ ai, minh bạch từng đồng' },
  { icon: HandCoins, text: 'Gợi ý quyết toán gọn nhất — ít lượt chuyển khoản nhất' },
];

/** Khung các trang đăng nhập/đăng ký: panel thương hiệu (desktop) + form. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-background">
      {/* Blob trang trí như BrandDecoration của app */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,var(--surface-tertiary),transparent_70%)] opacity-90" />
        <div className="absolute -bottom-32 -left-28 h-96 w-96 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--money-positive)_18%,transparent),transparent_70%)]" />
      </div>

      <div className="relative mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-2">
        <section className="hidden flex-col justify-center px-12 lg:flex">
          <Wordmark size="lg" />
          <p className="mt-3 text-lg text-muted">{APP_SLOGAN}</p>
          <ul className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface shadow-surface">
                  <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
                </span>
                <span className="pt-2 text-[15px] leading-6 text-foreground">{text}</span>
              </li>
            ))}
          </ul>
          <img src="/mascot.webp" alt="" className="mt-10 h-40 w-40 select-none object-contain" draggable={false} />
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-8">
          <div className="fade-up w-full max-w-[420px]">{children}</div>
        </section>
      </div>
    </div>
  );
}

/** Đầu form: logo (mobile) + tiêu đề. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle?: ReactNode }) {
  return (
    <div className="mb-7">
      <div className="mb-6 flex items-center gap-3 lg:hidden">
        <img src="/mascot.webp" alt="" className="h-14 w-14 object-contain" draggable={false} />
        <div>
          <Wordmark size="md" />
          <p className="mt-1 text-sm text-muted">{APP_SLOGAN}</p>
        </div>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {subtitle ? <p className="mt-1.5 text-sm leading-5 text-muted">{subtitle}</p> : null}
    </div>
  );
}
