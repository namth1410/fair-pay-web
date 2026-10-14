import type { UserSettings } from '../services/user.service';

/**
 * Áp dụng tuỳ chỉnh giao diện của user (đồng bộ từ users.settings — cùng nguồn
 * với app Android): theme sáng/tối/hệ thống + giảm chuyển động.
 * Cache localStorage để lần tải sau áp NGAY trước khi profile về (không nháy).
 */
const PREFS_KEY = 'fair_pay_user_prefs';

type ThemePref = UserSettings['dark_mode'];

interface CachedPrefs {
  dark_mode: ThemePref;
  animations_enabled: boolean;
}

let currentTheme: ThemePref = 'system';
let mediaListenerAttached = false;

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

export function resolveIsDark(pref: ThemePref): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  return systemPrefersDark();
}

function applyTheme(pref: ThemePref): void {
  currentTheme = pref;
  const dark = resolveIsDark(pref);
  const root = document.documentElement;
  root.classList.toggle('dark', dark);
  root.classList.toggle('light', !dark);
  root.dataset.theme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0f0f12' : '#f7f7f7');
  window.dispatchEvent(new CustomEvent('fairpay:theme', { detail: { dark } }));

  if (!mediaListenerAttached && window.matchMedia) {
    mediaListenerAttached = true;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentTheme === 'system') applyTheme('system');
    });
  }
}

function applyMotion(enabled: boolean): void {
  document.documentElement.dataset.reduceMotion = enabled ? 'false' : 'true';
}

export function applyPreferences(settings: Pick<UserSettings, 'dark_mode' | 'animations_enabled'>): void {
  applyTheme(settings.dark_mode ?? 'system');
  applyMotion(settings.animations_enabled ?? true);
  try {
    const cache: CachedPrefs = {
      dark_mode: settings.dark_mode ?? 'system',
      animations_enabled: settings.animations_enabled ?? true,
    };
    localStorage.setItem(PREFS_KEY, JSON.stringify(cache));
  } catch {
    /* ignore */
  }
}

/** Gọi 1 lần lúc khởi động, trước render đầu tiên. */
export function applyCachedPreferences(): void {
  let cache: CachedPrefs | null = null;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    cache = raw ? (JSON.parse(raw) as CachedPrefs) : null;
  } catch {
    cache = null;
  }
  applyTheme(cache?.dark_mode ?? 'system');
  applyMotion(cache?.animations_enabled ?? true);
}

export function isDarkNow(): boolean {
  return document.documentElement.classList.contains('dark');
}

// ── Lựa chọn hiển thị trên Home (per-thiết bị) ─────────────────────────────
const HOME_VIEW_KEY = 'fair_pay_home_view_mode';
export type HomeViewMode = 'grid' | 'list';

export function getHomeViewMode(): HomeViewMode {
  try {
    const v = localStorage.getItem(HOME_VIEW_KEY);
    return v === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

export function setHomeViewMode(mode: HomeViewMode): void {
  try {
    localStorage.setItem(HOME_VIEW_KEY, mode);
  } catch {
    /* ignore */
  }
}

// ── Cờ đã chào mừng (WelcomeDialog chỉ hiện 1 lần / user / trình duyệt) ────
export function hasBeenWelcomed(authId: string): boolean {
  try {
    return localStorage.getItem(`fair_pay_welcomed_${authId}`) === '1';
  } catch {
    return true;
  }
}

export function markWelcomed(authId: string): void {
  try {
    localStorage.setItem(`fair_pay_welcomed_${authId}`, '1');
  } catch {
    /* ignore */
  }
}
