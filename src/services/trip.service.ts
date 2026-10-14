import { TRIP_NAME_MAX_LENGTH } from '../config/constants';
import { supabase } from '../config/supabase';
import type { TripWithGroup } from '../types/database.types';
import { validateName } from '../utils/validate';
import { logAction } from './audit.service';
import { requireAuthUserId } from './auth.helper';
import { assertRole } from './group.service';
import { notifyTripEvent } from './notification.service';
import { getActorName } from './user.service';

export interface Trip {
  id: string;
  group_id: string;
  name: string;
  type: 'travel' | 'meal' | 'event' | 'other';
  status: 'open' | 'closed';
  created_by: string;
  version: number;
  client_request_id: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  deleted_at: string | null;
}

export type { TripWithGroup };

/** Chuyến của 1 nhóm, mới nhất trước. */
export async function fetchTrips(groupId: string): Promise<Trip[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Trip[] | null) ?? [];
}

export async function fetchTripById(tripId: string): Promise<Trip | null> {
  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as Trip | null) ?? null;
}

/** Mọi chuyến user thấy được (RLS theo membership) + tên nhóm. */
export async function fetchAllUserTripsWithGroup(): Promise<TripWithGroup[]> {
  const { data, error } = await supabase
    .from('trips')
    .select('*, groups!inner(name, deleted_at)')
    .is('deleted_at', null)
    .is('groups.deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  type Row = Trip & { groups: { name: string; deleted_at: string | null } };
  return ((data ?? []) as unknown as Row[]).map((t) => {
    const { groups, ...rest } = t;
    return { ...rest, group_name: groups.name };
  });
}

/** Tạo chuyến (mọi member). RPC create_trip atomic + audit server-side. */
export async function createTrip(
  groupId: string,
  name: string,
  type: Trip['type'] = 'other',
): Promise<Trip> {
  await assertRole(groupId, ['admin', 'member']);
  const trimmed = name.trim();
  const nameErr = validateName(trimmed, 'Tên chuyến');
  if (nameErr) throw new Error(nameErr);
  if (trimmed.length > TRIP_NAME_MAX_LENGTH) {
    throw new Error(`Tên chuyến không được quá ${TRIP_NAME_MAX_LENGTH} ký tự`);
  }
  const { data, error } = await supabase
    .rpc('create_trip', {
      p_id: crypto.randomUUID(),
      p_group_id: groupId,
      p_name: trimmed,
      p_type: type,
      p_client_request_id: crypto.randomUUID(),
      p_client_created_at: new Date().toISOString(),
    })
    .single();
  if (error) throw error;
  return data as Trip;
}

/** Version mới nhất — cho các chuyển trạng thái idempotent (đóng/mở lại). */
async function fetchTripVersion(tripId: string): Promise<number> {
  const { data, error } = await supabase
    .from('trips')
    .select('version')
    .eq('id', tripId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Chuyến đi không tồn tại');
  return data.version as number;
}

/** BR-05: Đóng chuyến (admin). Idempotent server-side. */
export async function closeTrip(trip: Trip): Promise<void> {
  if (trip.status === 'closed') return;
  await assertRole(trip.group_id, ['admin']);
  const { error } = await supabase.rpc('close_trip', {
    p_trip_id: trip.id,
    p_base_version: await fetchTripVersion(trip.id),
    p_client_request_id: crypto.randomUUID(),
    p_client_created_at: new Date().toISOString(),
  });
  if (error) throw error;

  // Notify best-effort — RPC đã log audit atomic.
  const actorId = await requireAuthUserId();
  await notifyTripEvent('trip.closed', {
    groupId: trip.group_id,
    tripId: trip.id,
    tripName: trip.name,
    actorId,
    actorName: await getActorName(),
  });
}

/** Mở lại chuyến (admin). Idempotent server-side. */
export async function reopenTrip(trip: Trip): Promise<void> {
  if (trip.status === 'open') return;
  await assertRole(trip.group_id, ['admin']);
  const { error } = await supabase.rpc('reopen_trip', {
    p_trip_id: trip.id,
    p_base_version: await fetchTripVersion(trip.id),
    p_client_request_id: crypto.randomUUID(),
    p_client_created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Đổi tên chuyến (admin) — P3 theo version đang hiển thị (phát hiện sửa chồng). */
export async function updateTripName(trip: Trip, newName: string): Promise<void> {
  await assertRole(trip.group_id, ['admin']);
  const trimmed = newName.trim();
  const nameErr = validateName(trimmed, 'Tên chuyến');
  if (nameErr) throw new Error(nameErr);
  if (trimmed.length > TRIP_NAME_MAX_LENGTH) {
    throw new Error(`Tên chuyến không được quá ${TRIP_NAME_MAX_LENGTH} ký tự`);
  }
  if (trimmed === trip.name) return;

  const { error } = await supabase.rpc('update_trip_name', {
    p_trip_id: trip.id,
    p_name: trimmed,
    p_base_version: trip.version,
    p_client_request_id: crypto.randomUUID(),
    p_client_created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Reset chuyến: xóa mềm mọi khoản chi + thanh toán (atomic RPC), tự mở lại nếu đang đóng. */
export async function clearTrip(trip: Trip): Promise<void> {
  await assertRole(trip.group_id, ['admin']);
  const { data, error } = await supabase
    .rpc('clear_trip', { p_trip_id: trip.id })
    .single<{ group_id: string; name: string; was_closed: boolean }>();
  if (error) throw error;
  if (!data) throw new Error('Chuyến đi không tồn tại');

  const actorId = await requireAuthUserId();
  await Promise.all([
    logAction({
      groupId: data.group_id,
      tripId: trip.id,
      action: 'trip.clear',
      targetId: trip.id,
      beforeData: { name: data.name, was_closed: data.was_closed },
      afterData: { cleared_at: new Date().toISOString() },
    }),
    getActorName().then((actorName) =>
      notifyTripEvent('trip.cleared', {
        groupId: data.group_id,
        tripId: trip.id,
        tripName: data.name,
        actorId,
        actorName,
      }),
    ),
  ]);
}

/** Xóa chuyến: xóa mềm chuyến + khoản chi + thanh toán (atomic RPC). */
export async function deleteTrip(trip: Trip): Promise<void> {
  await assertRole(trip.group_id, ['admin']);
  const { data, error } = await supabase
    .rpc('delete_trip', { p_trip_id: trip.id })
    .single<{ group_id: string; name: string }>();
  if (error) throw error;
  if (!data) throw new Error('Chuyến đi không tồn tại');

  const actorId = await requireAuthUserId();
  await Promise.all([
    logAction({
      groupId: data.group_id,
      tripId: trip.id,
      action: 'trip.delete',
      targetId: trip.id,
      beforeData: { name: data.name },
      afterData: { deleted_at: new Date().toISOString() },
    }),
    getActorName().then((actorName) =>
      notifyTripEvent('trip.deleted', {
        groupId: data.group_id,
        tripId: trip.id,
        tripName: data.name,
        actorId,
        actorName,
      }),
    ),
  ]);
}

// ── Pinned trips (tối đa 2, per-user) ──────────────────────────────────────

interface PinnedTripJoinRow {
  position: number;
  trips: (Trip & { groups: { name: string; deleted_at: string | null } }) | null;
}

/** Chuyến đã ghim (kèm tên nhóm), theo position 0 → 1. */
export async function fetchPinnedTrips(): Promise<TripWithGroup[]> {
  const { data, error } = await supabase
    .from('pinned_trips')
    .select('position, trips!inner(*, groups!inner(name, deleted_at))')
    .order('position', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as PinnedTripJoinRow[])
    .map((r) => r.trips)
    .filter(
      (t): t is Trip & { groups: { name: string; deleted_at: string | null } } =>
        !!t && !t.deleted_at && !t.groups?.deleted_at,
    )
    .map((t) => {
      const { groups, ...rest } = t;
      return { ...rest, group_name: groups.name };
    });
}

/** Ghim (idempotent; RPC xử lý giới hạn 2 + dọn pin mồ côi). */
export async function pinTrip(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('pin_trip', { p_trip_id: tripId });
  if (error) throw error;
}

export async function unpinTrip(tripId: string): Promise<void> {
  const { error } = await supabase.rpc('unpin_trip', { p_trip_id: tripId });
  if (error) throw error;
}

