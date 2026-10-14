import { NOTIF_PAGE_SIZE } from '../config/constants';
import { supabase } from '../config/supabase';
import {
  formatNotificationTitle,
  type NotificationSettingKey,
  type NotificationType,
} from '../utils/notificationFormat';
import { getAuthUserId } from './auth.helper';
import type { UserSettings } from './user.service';

export interface Notification {
  id: string;
  user_id: string;
  group_id: string | null;
  trip_id: string | null;
  type: string;
  actor_id: string | null;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  actor_name?: string;
  actor_photo_url?: string | null;
  group_name?: string;
}

export interface NotificationListFilter {
  scope?: 'all' | 'unread';
  groupIds?: string[];
}

// ── Recipient resolver ─────────────────────────────────────────────────────

/**
 * Người nhận của 1 sự kiện nhóm: loại actor, thành viên ảo, người đã rời, và
 * user tắt setting tương ứng (notify_activity/payment/member/smart).
 */
export async function getGroupRecipients(params: {
  groupId: string;
  excludeUserId?: string | null;
  settingKey: NotificationSettingKey;
}): Promise<string[]> {
  const { groupId, excludeUserId, settingKey } = params;
  const { data: members } = await supabase
    .from('group_members')
    .select('user_id, is_virtual, left_at, users:user_id(id, settings)')
    .eq('group_id', groupId)
    .is('left_at', null);
  if (!members?.length) return [];

  type Row = {
    user_id: string | null;
    is_virtual: boolean | number | null;
    users:
      | { id: string; settings: Partial<UserSettings> | null }
      | { id: string; settings: Partial<UserSettings> | null }[]
      | null;
  };

  const out: string[] = [];
  for (const raw of members as unknown as Row[]) {
    if (!raw.user_id) continue;
    if (raw.is_virtual) continue;
    if (excludeUserId && raw.user_id === excludeUserId) continue;
    const userRel = Array.isArray(raw.users) ? raw.users[0] : raw.users;
    const enabled = userRel?.settings?.[settingKey] ?? true;
    if (!enabled) continue;
    out.push(raw.user_id);
  }
  return out;
}

/** Fan-out qua RPC create_notifications_batch (dedup 10 phút server-side). */
export async function createNotifications(params: {
  type: NotificationType;
  recipients: string[];
  actorId: string | null;
  groupId: string | null;
  tripId?: string | null;
  title: string;
  actorName?: string;
  body?: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const recipients = Array.from(new Set(params.recipients)).filter(Boolean);
  if (!recipients.length) return;
  const { error } = await supabase.rpc('create_notifications_batch', {
    p_recipients: recipients,
    p_type: params.type,
    p_group_id: params.groupId ?? null,
    p_trip_id: params.tripId ?? null,
    p_title: params.title,
    p_actor_name: params.actorName ?? 'Ai đó',
    p_body: params.body ?? null,
    p_data: params.data ?? {},
  });
  if (error) throw error;
}

// ── Inbox ──────────────────────────────────────────────────────────────────

export async function fetchNotifications(opts?: {
  cursor?: string | null;
  limit?: number;
  filter?: NotificationListFilter;
}): Promise<Notification[]> {
  const userId = await getAuthUserId();
  if (!userId) return [];
  const limit = opts?.limit ?? NOTIF_PAGE_SIZE;
  const filter = opts?.filter;

  let query = supabase
    .from('notifications')
    .select('*, actor:actor_id(display_name, photo_url), group:group_id(name)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (opts?.cursor) query = query.lt('created_at', opts.cursor);
  if (filter?.scope === 'unread') query = query.is('read_at', null);
  if (filter?.groupIds && filter.groupIds.length > 0) {
    query = query.in('group_id', filter.groupIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  type Row = Notification & {
    actor: { display_name: string; photo_url: string | null } | null;
    group: { name: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    actor_name: r.actor?.display_name,
    actor_photo_url: r.actor?.photo_url ?? null,
    group_name: r.group?.name,
  }));
}

/** Gắn tên actor/nhóm cho 1 row realtime (payload realtime không có join). */
export async function hydrateNotification(row: Notification): Promise<Notification> {
  const [actorRes, groupRes] = await Promise.all([
    row.actor_id
      ? supabase.from('users').select('display_name, photo_url').eq('id', row.actor_id).maybeSingle()
      : Promise.resolve({ data: null }),
    row.group_id
      ? supabase.from('groups').select('name').eq('id', row.group_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const actor = actorRes.data as { display_name: string; photo_url: string | null } | null;
  const group = groupRes.data as { name: string } | null;
  return {
    ...row,
    actor_name: actor?.display_name ?? row.actor_name,
    actor_photo_url: actor?.photo_url ?? row.actor_photo_url ?? null,
    group_name: group?.name ?? row.group_name,
  };
}

export async function getUnreadCount(): Promise<number> {
  const userId = await getAuthUserId();
  if (!userId) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markAsRead(ids: string[]): Promise<void> {
  if (!ids.length) return;
  const userId = await getAuthUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

export async function markAllAsRead(opts?: { groupIds?: string[] }): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;
  let query = supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (opts?.groupIds?.length) query = query.in('group_id', opts.groupIds);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) return;
  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);
  if (error) throw error;
}

// ── Event emitters (best-effort, lỗi bị nuốt — KHÔNG chặn luồng chính) ─────

export async function notifyJoinResolved(
  type: 'member.join_approved' | 'member.join_rejected',
  input: { groupId: string; groupName: string; reviewerId: string; requesterUserId: string },
): Promise<void> {
  try {
    if (input.requesterUserId === input.reviewerId) return;
    const { data: userRow } = await supabase
      .from('users')
      .select('settings')
      .eq('id', input.requesterUserId)
      .maybeSingle();
    const enabled = (userRow?.settings as Partial<UserSettings> | null)?.notify_member ?? true;
    if (!enabled) return;
    await createNotifications({
      type,
      recipients: [input.requesterUserId],
      actorId: input.reviewerId,
      groupId: input.groupId,
      title: formatNotificationTitle({ type, actorName: '', groupName: input.groupName }),
      data: { group_name: input.groupName },
    });
  } catch (e) {
    if (__DEV__) console.warn('[Notif] join_resolved failed:', e);
  }
}

type TripEventType = 'trip.closed' | 'trip.cleared' | 'trip.deleted';

export async function notifyTripEvent(
  type: TripEventType,
  input: { groupId: string; tripId: string; tripName: string; actorId: string; actorName: string },
): Promise<void> {
  try {
    const recipients = await getGroupRecipients({
      groupId: input.groupId,
      excludeUserId: input.actorId,
      settingKey: 'notify_activity',
    });
    if (!recipients.length) return;
    await createNotifications({
      type,
      recipients,
      actorId: input.actorId,
      actorName: input.actorName,
      groupId: input.groupId,
      tripId: input.tripId,
      title: formatNotificationTitle({ type, actorName: input.actorName, tripName: input.tripName }),
      data: { target_id: input.tripId, trip_name: input.tripName },
    });
  } catch (e) {
    if (__DEV__) console.warn(`[Notif] ${type} failed:`, e);
  }
}
