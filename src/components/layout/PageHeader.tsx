import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Hiện nút quay lại. `true` = history back (fallback `/`), string = đi tới route. */
  back?: boolean | string;
  right?: ReactNode;
  /** Ẩn tiêu đề trên desktop (khi trang đã có hero riêng). */
  compactOnDesktop?: boolean;
}

/** Header dính trên cùng, nền mờ — tiêu đề giữa trên mobile, trái trên desktop. */
export function PageHeader({ title, subtitle, back, right, compactOnDesktop }: PageHeaderProps) {
  const navigate = useNavigate();
  const goBack = () => {
    if (typeof back === 'string') {
      navigate(back);
      return;
    }
    // Có lịch sử trong app → back; vào thẳng bằng link → về home.
    if (window.history.state && (window.history.state as { idx?: number }).idx) navigate(-1);
    else navigate('/', { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-transparent bg-background/80 px-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex h-14 items-center gap-2">
        {back ? (
          <button
            type="button"
            onClick={goBack}
            aria-label="Quay lại"
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : null}
        <div className={`min-w-0 flex-1 ${compactOnDesktop ? 'lg:invisible' : ''}`}>
          <h1 className="truncate text-[17px] font-semibold leading-tight text-foreground">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
        {right ? <div className="flex shrink-0 items-center gap-1">{right}</div> : null}
      </div>
    </header>
  );
}

/** Nút icon tròn cho vùng phải của header. */
export function HeaderIconButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}
