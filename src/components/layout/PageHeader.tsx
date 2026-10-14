import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Hiện nút quay lại. `true` = history back (fallback `/`), string = đi tới route. */
  back?: boolean | string;
  /** Ẩn nút quay lại từ md trở lên (khi cột danh sách bên trái đã là đường quay về). */
  hideBackOnWide?: boolean;
  /** Avatar/biểu tượng cạnh tiêu đề (header khung chat). */
  leading?: ReactNode;
  /** Bấm vào cụm tiêu đề (vd mở Thông tin chuyến). */
  onTitleClick?: () => void;
  titleLabel?: string;
  right?: ReactNode;
}

/**
 * Header gọn 56px ở đầu khung (trang chi tiết trên điện thoại, khung chính trên desktop) — kiểu
 * header cuộc trò chuyện: nút quay lại + (avatar) + tiêu đề/dòng phụ + nút bên phải. Không dính
 * (sticky): khung chứa là cột flex, phần thân bên dưới tự cuộn.
 */
export function PageHeader({
  title,
  subtitle,
  back,
  hideBackOnWide,
  leading,
  onTitleClick,
  titleLabel,
  right,
}: PageHeaderProps) {
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

  const titleBlock = (
    <>
      {leading}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[17px] font-bold leading-tight text-foreground">{title}</span>
        {subtitle ? <span className="block truncate text-xs text-muted">{subtitle}</span> : null}
      </span>
    </>
  );

  return (
    <header className="flex h-14 shrink-0 items-center gap-1 border-b border-border bg-surface px-2 sm:px-3">
      {back ? (
        <button
          type="button"
          onClick={goBack}
          aria-label="Quay lại"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary ${
            hideBackOnWide ? 'md:hidden' : ''
          }`}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
      ) : null}
      {onTitleClick ? (
        <button
          type="button"
          onClick={onTitleClick}
          aria-label={titleLabel}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1 transition-colors hover:bg-surface-secondary"
        >
          {titleBlock}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5">{titleBlock}</div>
      )}
      {right ? <div className="flex shrink-0 items-center gap-1">{right}</div> : null}
    </header>
  );
}

/** Khung trang 1 cột: header cố định trên + thân tự cuộn, cột nội dung giữa. */
export function PageFrame({
  header,
  children,
  width = 'md',
  bodyClassName = 'px-4 pt-4',
}: {
  header?: ReactNode;
  children: ReactNode;
  width?: 'md' | 'lg' | 'full';
  bodyClassName?: string;
}) {
  const max = width === 'lg' ? 'max-w-4xl' : width === 'full' ? '' : 'max-w-2xl';
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {header}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={`mx-auto w-full ${max} pb-10 ${bodyClassName}`}>{children}</div>
      </div>
    </div>
  );
}
