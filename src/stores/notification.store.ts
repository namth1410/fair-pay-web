import { create } from 'zustand';

import { NOTIF_PAGE_SIZE } from '../config/constants';
import {
  deleteNotification,
  fetchNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
  type Notification,
  type NotificationListFilter,
} from '../services/notification.service';

interface NotificationState {
  items: Notification[];
  unreadCount: number;
  hasMore: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  loaded: boolean;
  lastRefreshAt: number;
  filter: Required<NotificationListFilter>;

  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  refreshUnreadCount: () => Promise<void>;
  setFilter: (patch: Partial<NotificationListFilter>) => Promise<void>;
  markRead: (ids: string[]) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Realtime INSERT. */
  prepend: (n: Notification) => void;
  /** Realtime UPDATE (dedup server-side gộp nhiều sự kiện vào 1 row). */
  applyUpdate: (n: Notification) => void;
  reset: () => void;
}

const initialState = {
  items: [] as Notification[],
  unreadCount: 0,
  hasMore: true,
  isRefreshing: false,
  isLoadingMore: false,
  loaded: false,
  lastRefreshAt: 0,
  filter: { scope: 'all', groupIds: [] } as Required<NotificationListFilter>,
};

export const useNotificationStore = create<NotificationState>((set, get) => ({
  ...initialState,

  refresh: async () => {
    set({ isRefreshing: true });
    try {
      const [items, unreadCount] = await Promise.all([
        fetchNotifications({ filter: get().filter }),
        getUnreadCount(),
      ]);
      set({
        items,
        unreadCount,
        hasMore: items.length >= NOTIF_PAGE_SIZE,
        loaded: true,
        lastRefreshAt: Date.now(),
      });
    } finally {
      set({ isRefreshing: false });
    }
  },

  loadMore: async () => {
    const { items, hasMore, isLoadingMore, isRefreshing, filter } = get();
    if (!hasMore || isLoadingMore || isRefreshing || items.length === 0) return;
    set({ isLoadingMore: true });
    try {
      const cursor = items[items.length - 1].created_at;
      const more = await fetchNotifications({ cursor, filter });
      const seen = new Set(items.map((i) => i.id));
      set({
        items: [...items, ...more.filter((m) => !seen.has(m.id))],
        hasMore: more.length >= NOTIF_PAGE_SIZE,
      });
    } finally {
      set({ isLoadingMore: false });
    }
  },

  refreshUnreadCount: async () => {
    try {
      set({ unreadCount: await getUnreadCount() });
    } catch {
      /* im lặng — badge giữ giá trị cũ */
    }
  },

  setFilter: async (patch) => {
    set((s) => ({ filter: { ...s.filter, ...patch }, items: [], hasMore: true }));
    await get().refresh();
  },

  markRead: async (ids) => {
    const unreadIds = ids.filter((id) => get().items.some((i) => i.id === id && !i.read_at));
    if (!unreadIds.length) return;
    const now = new Date().toISOString();
    const prevItems = get().items;
    const prevCount = get().unreadCount;
    set({
      items: prevItems.map((i) => (unreadIds.includes(i.id) ? { ...i, read_at: now } : i)),
      unreadCount: Math.max(0, prevCount - unreadIds.length),
    });
    try {
      await markAsRead(unreadIds);
    } catch {
      set({ items: prevItems, unreadCount: prevCount });
    }
  },

  markAllRead: async () => {
    const now = new Date().toISOString();
    const prevItems = get().items;
    const prevCount = get().unreadCount;
    const groupIds = get().filter.groupIds;
    const inScope = (i: Notification) =>
      !groupIds.length || (!!i.group_id && groupIds.includes(i.group_id));
    set({
      items: prevItems.map((i) => (!i.read_at && inScope(i) ? { ...i, read_at: now } : i)),
      unreadCount: groupIds.length ? prevCount : 0,
    });
    try {
      await markAllAsRead({ groupIds });
      await get().refreshUnreadCount();
    } catch (e) {
      set({ items: prevItems, unreadCount: prevCount });
      throw e;
    }
  },

  remove: async (id) => {
    const prevItems = get().items;
    const prevCount = get().unreadCount;
    const target = prevItems.find((i) => i.id === id);
    set({
      items: prevItems.filter((i) => i.id !== id),
      unreadCount: target && !target.read_at ? Math.max(0, prevCount - 1) : prevCount,
    });
    try {
      await deleteNotification(id);
    } catch {
      set({ items: prevItems, unreadCount: prevCount });
    }
  },

  prepend: (n) => {
    if (get().items.some((i) => i.id === n.id)) return;
    set((s) => ({
      items: [n, ...s.items],
      unreadCount: n.read_at ? s.unreadCount : s.unreadCount + 1,
    }));
  },

  applyUpdate: (n) => {
    if (!get().items.some((i) => i.id === n.id)) {
      set((s) => ({ items: [n, ...s.items] }));
      return;
    }
    set((s) => ({
      items: s.items
        .map((i) =>
          i.id === n.id
            ? {
                ...i,
                ...n,
                actor_name: n.actor_name ?? i.actor_name,
                actor_photo_url: n.actor_photo_url ?? i.actor_photo_url,
                group_name: n.group_name ?? i.group_name,
              }
            : i,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
  },

  reset: () => set({ ...initialState }),
}));
