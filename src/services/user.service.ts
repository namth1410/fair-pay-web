import { DISPLAY_NAME_MAX_LENGTH } from '../config/constants';
import { supabase } from '../config/supabase';
import { requireAuthUserId } from './auth.helper';

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  photo_url: string | null;
  settings: UserSettings;
  version: number;
  updated_at: string | null;
}

export interface UserSettings {
  dark_mode: 'system' | 'light' | 'dark';
  notify_activity: boolean;
  notify_payment: boolean;
  notify_member: boolean;
  notify_smart: boolean;
  push_enabled: boolean;
  haptics_enabled: boolean;
  animations_enabled: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  dark_mode: 'system',
  notify_activity: true,
  notify_payment: true,
  notify_member: true,
  notify_smart: true,
  push_enabled: true,
  haptics_enabled: true,
  animations_enabled: true,
};

// Tên người thao tác dùng cho title notification. Auth store set khi tải profile;
// fallback query nếu chưa có (vd mutation chạy trước khi profile về).
let actorNameCache: string | null = null;

export function setActorName(name: string | null): void {
  actorNameCache = name?.trim() || null;
}

export async function getActorName(): Promise<string> {
  if (actorNameCache) return actorNameCache;
  try {
    const userId = await requireAuthUserId();
    const { data } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    const name = (data?.display_name as string | undefined)?.trim();
    if (name) {
      actorNameCache = name;
      return name;
    }
  } catch {
    /* fallback bên dưới */
  }
  return 'Thành viên';
}

/** Hồ sơ user hiện tại (users row) với fallback từ auth metadata. */
export async function fetchCurrentUser(): Promise<UserProfile | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return null;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .maybeSingle();
  if (error && __DEV__) console.warn('[fetchCurrentUser] users query failed:', error.message);

  const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;
  const fallbackName =
    meta.display_name || meta.full_name || meta.name || user.email?.split('@')[0] || 'Bạn';

  const rawSettings = (data?.settings ?? {}) as Partial<UserSettings> | string;
  const settings =
    typeof rawSettings === 'string'
      ? (JSON.parse(rawSettings || '{}') as Partial<UserSettings>)
      : rawSettings;

  return {
    id: (data?.id as string) || user.id,
    email: (data?.email as string) || user.email || '',
    display_name: (data?.display_name as string) || fallbackName,
    photo_url: (data?.photo_url as string) || meta.avatar_url || meta.picture || null,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    version: (data?.version as number) ?? 1,
    updated_at: (data?.updated_at as string) ?? null,
  };
}

/**
 * Đổi tên hiển thị — RPC update_user_display_name (P3). Lấy version MỚI NHẤT
 * ngay trước khi gọi: settings cũng bump version của users row, dùng version cũ
 * sẽ gây version_conflict giả (bài học write-back của app).
 */
export async function updateDisplayName(name: string): Promise<{ version: number }> {
  const userId = await requireAuthUserId();
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tên không được để trống');
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Tên không được quá ${DISPLAY_NAME_MAX_LENGTH} ký tự`);
  }

  const { data: current, error: readErr } = await supabase
    .from('users')
    .select('version')
    .eq('id', userId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!current) throw new Error('Hồ sơ không tồn tại');

  const { data, error } = await supabase.rpc('update_user_display_name', {
    p_display_name: trimmed,
    p_base_version: current.version as number,
    p_client_request_id: crypto.randomUUID(),
  });
  if (error) throw error;
  setActorName(trimmed);

  // Best-effort đồng bộ auth metadata (DB là source of truth).
  supabase.auth.updateUser({ data: { display_name: trimmed } }).catch(() => {});

  const row = (Array.isArray(data) ? data[0] : data) as { version: number } | null;
  return { version: row?.version ?? (current.version as number) + 1 };
}

/**
 * Cập nhật settings — server merge JSONB theo key (last-arrival-wins, P5).
 * `p_base_updated_at` giữ cho backward-compat, server bỏ qua.
 */
export async function updateSettings(
  patch: Partial<UserSettings>,
): Promise<{ settings: Partial<UserSettings>; version: number } | null> {
  await requireAuthUserId();
  if (Object.keys(patch).length === 0) return null;
  const { data, error } = await supabase.rpc('update_user_settings', {
    p_settings: patch,
    p_base_updated_at: new Date().toISOString(),
    p_client_request_id: crypto.randomUUID(),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as {
    settings: Partial<UserSettings>;
    version: number;
  } | null;
  return row;
}
