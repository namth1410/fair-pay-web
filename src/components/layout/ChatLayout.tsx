import { type ReactNode, useEffect } from 'react';

import { useIsExtraWide } from '../../hooks/useMediaQuery';

interface ChatLayoutProps {
  /** Cột danh sách (nhóm / chuyến của nhóm) — chỉ hiện từ md trở lên. */
  list?: ReactNode;
  /** Khung chính (luồng chuyến đi, thông tin nhóm, form...). */
  main: ReactNode;
  /** Panel phụ bên phải (Thông tin chuyến). ≥ xl là cột thứ 3, nhỏ hơn là ngăn kéo phủ. */
  aside?: ReactNode;
  onCloseAside?: () => void;
  asideLabel?: string;
}

/**
 * Bố cục kiểu app nhắn tin trên màn rộng (Telegram/WhatsApp Web): cột danh sách + khung
 * chính (+ panel phải). Dưới md chỉ còn khung chính — trang tự lo phần còn lại như app điện thoại.
 * Mỗi vùng tự cuộn, toàn trang không cuộn.
 */
export function ChatLayout({ list, main, aside, onCloseAside, asideLabel = 'Thông tin' }: ChatLayoutProps) {
  const extraWide = useIsExtraWide();

  useEffect(() => {
    if (!aside || extraWide || !onCloseAside) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseAside();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aside, extraWide, onCloseAside]);

  return (
    <div className="flex h-full min-h-0">
      {list ? (
        <section
          aria-label="Danh sách"
          className="hidden w-[320px] shrink-0 flex-col border-r border-border bg-surface md:flex lg:w-[360px]"
        >
          {list}
        </section>
      ) : null}

      <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">{main}</main>

      {aside && extraWide ? (
        <aside
          aria-label={asideLabel}
          className="flex w-[400px] shrink-0 flex-col border-l border-border bg-background"
        >
          {aside}
        </aside>
      ) : null}

      {aside && !extraWide ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Đóng"
            onClick={onCloseAside}
            className="absolute inset-0 cursor-default bg-[var(--backdrop)]"
          />
          <aside
            aria-label={asideLabel}
            className="fade-up relative flex h-full w-[min(420px,92vw)] flex-col bg-background shadow-overlay"
          >
            {aside}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
