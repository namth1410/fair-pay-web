/**
 * Chụp URL lúc trang vừa tải — TRƯỚC khi supabase-js xử lý & xóa fragment
 * `#access_token=…` / `#error=…` của link đặt lại mật khẩu. Phải import ĐẦU TIÊN
 * trong main.tsx (ES module chạy theo thứ tự import).
 */
export const INITIAL_URL = typeof window !== 'undefined' ? window.location.href : '';

export function getInitialAuthParams(): URLSearchParams {
  const url = new URL(INITIAL_URL || 'http://localhost/');
  const params = new URLSearchParams(url.search);
  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  // Hash thắng query (giống app).
  new URLSearchParams(hash).forEach((v, k) => params.set(k, v));
  return params;
}
