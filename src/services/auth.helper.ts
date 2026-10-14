import { supabase } from '../config/supabase';

/**
 * Resolve Supabase auth UUID (`auth.users.id`) → app-level `users.id`.
 *
 * App native cache mapping trong SQLite; bản web cache trong memory + localStorage
 * (key theo `sub`) để reload trang không tốn thêm 1 round-trip. Dedup in-flight:
 * nhiều service gọi đồng thời lúc khởi động chỉ resolve 1 lần.
 */
let cached: { sub: string; userId: string } | null = null;
let inFlight: Promise<string | null> | null = null;

const STORAGE_PREFIX = 'fairpay:app-user-id:';

function readStored(sub: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + sub);
  } catch {
    return null;
  }
}

function writeStored(sub: string, userId: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + sub, userId);
  } catch {
    /* private mode / storage bị chặn — bỏ qua, chỉ mất cache */
  }
}

export async function getAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  const sub = data.session?.user?.id ?? null;
  if (!sub) return null;
  if (cached?.sub === sub) return cached.userId;

  const stored = readStored(sub);
  if (stored) {
    cached = { sub, userId: stored };
    return stored;
  }

  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { data: row, error } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', sub)
        .maybeSingle();
      if (error) throw error;
      if (!row?.id) return null;
      cached = { sub, userId: row.id as string };
      writeStored(sub, row.id as string);
      return row.id as string;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Bắt buộc có user — dùng ở đầu các mutation. */
export async function requireAuthUserId(): Promise<string> {
  const id = await getAuthUserId();
  if (!id) throw new Error('Chưa đăng nhập');
  return id;
}

/** Clear cached user ID — gọi khi logout. */
export function clearAuthCache(): void {
  cached = null;
  inFlight = null;
}

/**
 * Cooldown gửi email đặt lại mật khẩu — 60s/thiết bị (quota email Supabase rất
 * thấp, ~4 email/giờ cho cả hệ thống). Lưu localStorage để sống qua reload.
 */
const RESET_COOLDOWN_KEY = 'fair_pay_reset_last_sent';
const RESET_COOLDOWN_MS = 60_000;

export function getResetCooldownRemaining(): number {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(RESET_COOLDOWN_KEY);
  } catch {
    return 0;
  }
  if (!raw) return 0;
  const last = Number(raw);
  if (!Number.isFinite(last)) return 0;
  const elapsed = Date.now() - last;
  if (elapsed >= RESET_COOLDOWN_MS) return 0;
  return Math.ceil((RESET_COOLDOWN_MS - elapsed) / 1000);
}

export function markResetSent(): void {
  try {
    localStorage.setItem(RESET_COOLDOWN_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
