import { useEffect } from 'react';

import { supabase } from '../config/supabase';
import { getAuthUserId } from '../services/auth.helper';
import { hydrateNotification, type Notification } from '../services/notification.service';
import { useAuthStore } from '../stores/auth.store';
import { useGroupStore } from '../stores/group.store';
import { useNotificationStore } from '../stores/notification.store';
import { dispatchNotificationRefetch } from '../utils/notificationRouter';
import { showInfo, showSuccess, showWarning } from '../utils/toast';

const WARNING_TYPES = new Set(['member.join_rejected', 'expense.deleted', 'trip.deleted']);

/**
 * Realtime khi đã đăng nhập:
 * - `notif:<users.id>`: INSERT → prepend inbox + toast + refetch màn liên quan;
 *   UPDATE (dedup gộp) → cập nhật tại chỗ, không toast.
 * - `invites:user:<users.id>`: lời mời vào nhóm thay đổi → tải lại.
 * Channel dùng users.id (KHÔNG phải auth id) — khớp app native.
 */
export function useNotificationRealtime(): void {
  const authUserId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    if (!authUserId) return;
    let cancelled = false;
    const channels: ReturnType<typeof supabase.channel>[] = [];

    (async () => {
      const appUserId = await getAuthUserId();
      if (!appUserId || cancelled) return;

      const notifChannel = supabase
        .channel(`notif:${appUserId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${appUserId}` },
          async (payload) => {
            const store = useNotificationStore.getState();
            const row = payload.new as Notification;
            if (store.items.some((i) => i.id === row.id)) return;
            const hydrated = await hydrateNotification(row);
            store.prepend(hydrated);
            const show = row.type === 'member.join_approved' ? showSuccess : WARNING_TYPES.has(row.type) ? showWarning : showInfo;
            show(row.title, row.body ?? undefined);
            dispatchNotificationRefetch(row.type, row.group_id, row.trip_id);
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${appUserId}` },
          async (payload) => {
            const row = payload.new as Notification;
            const hydrated = await hydrateNotification(row);
            useNotificationStore.getState().applyUpdate(hydrated);
          },
        )
        .subscribe();
      channels.push(notifChannel);

      const inviteChannel = supabase
        .channel(`invites:user:${appUserId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'group_invitations', filter: `invited_user_id=eq.${appUserId}` },
          () => {
            void useGroupStore.getState().loadMyPendingInvitations();
          },
        )
        .subscribe();
      channels.push(inviteChannel);

      if (cancelled) channels.forEach((c) => void supabase.removeChannel(c));
    })();

    return () => {
      cancelled = true;
      channels.forEach((c) => void supabase.removeChannel(c));
    };
  }, [authUserId]);
}

/** Đồng bộ lại khi tab quay lại foreground (tương đương AppState active của app). */
export function useForegroundRefresh(): void {
  useEffect(() => {
    let last = Date.now();
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - last < 15_000) return;
      last = Date.now();
      void useNotificationStore.getState().refreshUnreadCount();
      void useGroupStore.getState().loadBalanceSummary();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
}
