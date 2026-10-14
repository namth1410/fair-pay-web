export const APP_NAME = 'Fair Pay';
export const APP_SLOGAN = 'Chia tiền · Không chia rẽ';
export const APP_VERSION = '1.0.0-web';

// Supabase — `.env.development.local` (dev project) / `.env.production.local` (prod).
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env');
}

// Google Sign-In (Google Identity Services) — Web Client ID. ID token Google trả
// về phải có `aud` = client ID này thì Supabase mới verify được (giống app native).
export const GOOGLE_WEB_CLIENT_ID = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? '';

// User
export const DISPLAY_NAME_MAX_LENGTH = 30;

// Group
export const GROUP_NAME_MAX_LENGTH = 100;

// Trip
export const TRIP_NAME_MAX_LENGTH = 50;

// Chuyến ghim (hàng "story" cuộn ngang ở trang Nhóm). PHẢI khớp limit trong RPC pin_trip
// (migration 20261014120000_pinned_trips_raise_limit ở repo app) + MAX_PINNED_TRIPS của app.
export const MAX_PINNED_TRIPS = 20;


// Group avatar (Cloudflare R2 storage)
export const GROUP_AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB sau compress
export const R2_PUBLIC_BASE_URL = import.meta.env.VITE_R2_PUBLIC_BASE_URL ?? '';

// Expense image (Cloudflare R2 — bucket dùng chung với avatar, prefix khác)
export const EXPENSE_IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// Notifications
export const NOTIF_PAGE_SIZE = 30;
export const NOTIF_DEDUP_WINDOW_MS = 10 * 60 * 1000;
