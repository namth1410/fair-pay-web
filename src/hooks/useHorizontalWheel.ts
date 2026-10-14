import { type RefObject, useEffect } from 'react';

/**
 * Hàng cuộn ngang (story chuyến ghim, chọn người trả...): chuột thường chỉ có con lăn dọc →
 * đổi thành cuộn ngang khi hàng đang tràn. Trackpad / shift+lăn vẫn cuộn ngang như thường.
 */
export function useHorizontalWheel(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
}
