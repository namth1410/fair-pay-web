import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import { supabase } from '../config/supabase';
import {
  clearAuthCache,
  getResetCooldownRemaining,
  markResetSent,
} from '../services/auth.helper';
import { clearRoleCache } from '../services/group.service';
import {
  fetchCurrentUser,
  setActorName,
  updateDisplayName as updateDisplayNameService,
  updateSettings as updateSettingsService,
  type UserProfile,
  type UserSettings,
} from '../services/user.service';
import { applyPreferences } from '../utils/preferences';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isInitialized: boolean;
  isLoading: boolean;
  /** Đang ở luồng đặt lại mật khẩu (Supabase phát PASSWORD_RECOVERY). */
  isPasswordRecovery: boolean;

  initialize: () => Promise<void>;
  loadProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ needsConfirm: boolean }>;
  signInWithGoogleIdToken: (idToken: string, nonce?: string) => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => Promise<void>;
  signOut: () => Promise<void>;
}

let authSubscription: { unsubscribe: () => void } | null = null;

/** Reset các store khác khi đổi user (tránh lộ dữ liệu người trước). */
async function resetDataStores(): Promise<void> {
  const [{ useGroupStore }, { useTripStore }, { useNotificationStore }, { usePresetStore }] =
    await Promise.all([
      import('./group.store'),
      import('./trip.store'),
      import('./notification.store'),
      import('./preset.store'),
    ]);
  useGroupStore.getState().reset();
  useTripStore.getState().reset();
  useNotificationStore.getState().reset();
  usePresetStore.getState().reset();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isInitialized: false,
  isLoading: false,
  isPasswordRecovery: false,

  initialize: async () => {
    if (!authSubscription) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        const prevUserId = get().user?.id ?? null;
        const nextUserId = session?.user?.id ?? null;
        set({
          session,
          user: session?.user ?? null,
          ...(event === 'PASSWORD_RECOVERY' && { isPasswordRecovery: true }),
        });
        if (prevUserId !== nextUserId) {
          clearAuthCache();
          clearRoleCache();
          if (prevUserId) void resetDataStores();
          if (nextUserId) {
            // Tách khỏi callback (supabase-js khuyến cáo không await API trong listener).
            setTimeout(() => void get().loadProfile(), 0);
          } else {
            set({ profile: null });
            setActorName(null);
          }
        }
      });
      authSubscription = data.subscription;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      set({ session, user: session?.user ?? null });
      if (session) await get().loadProfile();
    } catch (e) {
      if (__DEV__) console.warn('[auth] initialize failed:', e);
    } finally {
      set({ isInitialized: true });
    }
  },

  loadProfile: async () => {
    try {
      const profile = await fetchCurrentUser();
      set({ profile });
      setActorName(profile?.display_name ?? null);
      if (profile) applyPreferences(profile.settings);
    } catch (e) {
      if (__DEV__) console.warn('[auth] loadProfile failed:', e);
    }
  },

  signInWithEmail: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      set({ session: data.session, user: data.user });
    } finally {
      set({ isLoading: false });
    }
  },

  signUpWithEmail: async (email, password, displayName) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (error) throw error;
      set({ session: data.session, user: data.user });
      return { needsConfirm: !data.session };
    } finally {
      set({ isLoading: false });
    }
  },

  signInWithGoogleIdToken: async (idToken, nonce) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        ...(nonce ? { nonce } : {}),
      });
      if (error) throw error;
      set({ session: data.session, user: data.user });
    } finally {
      set({ isLoading: false });
    }
  },

  sendPasswordResetEmail: async (email) => {
    set({ isLoading: true });
    try {
      const remaining = getResetCooldownRemaining();
      if (remaining > 0) throw new Error(`Vui lòng chờ ${remaining}s trước khi gửi lại`);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      markResetSent();
    } finally {
      set({ isLoading: false });
    }
  },

  updatePassword: async (newPassword) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      set({ user: data.user, isPasswordRecovery: false });
    } finally {
      set({ isLoading: false });
    }
  },

  updateDisplayName: async (name) => {
    const { version } = await updateDisplayNameService(name);
    const trimmed = name.trim();
    set((s) => ({
      profile: s.profile ? { ...s.profile, display_name: trimmed, version } : s.profile,
    }));
  },

  updateSetting: async (key, value) => {
    const prev = get().profile;
    if (!prev) throw new Error('Hồ sơ chưa tải xong, vui lòng thử lại.');
    const prevValue = prev.settings[key];
    const nextSettings = { ...prev.settings, [key]: value };
    set({ profile: { ...prev, settings: nextSettings } });
    applyPreferences(nextSettings);
    try {
      const row = await updateSettingsService({ [key]: value } as Partial<UserSettings>);
      if (row) {
        set((s) => ({
          profile: s.profile ? { ...s.profile, version: row.version } : s.profile,
        }));
      }
    } catch (e) {
      // Rollback đúng key đó.
      set((s) => {
        if (!s.profile) return {};
        const rolled = { ...s.profile.settings, [key]: prevValue };
        applyPreferences(rolled);
        return { profile: { ...s.profile, settings: rolled } };
      });
      throw e;
    }
  },

  signOut: async () => {
    // scope 'local': chỉ đăng xuất tab/trình duyệt này — mặc định 'global' sẽ thu hồi
    // mọi refresh token, đá luôn phiên trên app Android của user.
    await supabase.auth.signOut({ scope: 'local' });
    clearAuthCache();
    clearRoleCache();
    setActorName(null);
    set({ session: null, user: null, profile: null, isPasswordRecovery: false });
    await resetDataStores();
  },
}));
