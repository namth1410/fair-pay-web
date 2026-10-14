import { useSyncExternalStore } from 'react';

/** Theo dõi 1 media query (re-render khi đổi kích thước qua ngưỡng). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * ≥ 768px: bố cục kiểu app nhắn tin trên desktop — thanh icon trái + cột danh sách + khung
 * chính. Nhỏ hơn: 1 cột như app điện thoại. PHẢI khớp breakpoint `md` dùng trong className.
 */
export function useIsWide(): boolean {
  return useMediaQuery('(min-width: 768px)');
}

/** ≥ 1280px (`xl`): đủ chỗ cho panel "Thông tin chuyến" thành cột thứ 3 thay vì ngăn kéo phủ. */
export function useIsExtraWide(): boolean {
  return useMediaQuery('(min-width: 1280px)');
}
