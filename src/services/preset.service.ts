import { supabase } from '../config/supabase';
import type { ExpensePresetRow, PresetSplitEntry } from '../types/database.types';
import { splitByRatio, splitEqual, type SplitResult, validateAmount } from '../utils/split';
import { validateName } from '../utils/validate';
import { getAuthUserId, requireAuthUserId } from './auth.helper';

export type ExpensePreset = ExpensePresetRow;
export type { PresetSplitEntry };
export type PresetSplitType = 'equal' | 'ratio' | 'custom';

export interface PresetCreateParams {
  title: string;
  amount: number;
  tripId?: string | null;
  paidByMemberId?: string | null;
  splitType?: PresetSplitType | null;
  splitsData?: PresetSplitEntry[] | null;
}

/** Khớp các CHECK constraint `preset_scope_consistency` + `preset_splits_pair`. */
function validateScope(params: PresetCreateParams): void {
  const tripId = params.tripId ?? null;
  const hasPaidBy = (params.paidByMemberId ?? null) !== null;
  const hasSplitType = (params.splitType ?? null) !== null;
  const splitsData = params.splitsData ?? null;
  const hasSplitsData = splitsData !== null;

  if (tripId === null && (hasPaidBy || hasSplitType || hasSplitsData)) {
    throw new Error('Preset paid_by/splits chỉ áp dụng khi gắn với chuyến đi');
  }
  if (hasSplitType !== hasSplitsData) {
    throw new Error('split_type và splits_data phải đi cùng nhau');
  }
  if (splitsData && splitsData.length === 0) {
    throw new Error('Danh sách thành viên chia không được rỗng');
  }
  if (splitsData && params.splitType === 'ratio' && splitsData.some((s) => (s.ratio ?? 0) <= 0)) {
    throw new Error('Mỗi thành viên phải có tỷ lệ > 0');
  }
  if (splitsData && params.splitType === 'custom') {
    if (splitsData.some((s) => (s.amount ?? -1) < 0)) {
      throw new Error('Mỗi thành viên phải có số tiền >= 0');
    }
    const sum = splitsData.reduce((acc, s) => acc + (s.amount ?? 0), 0);
    if (sum !== params.amount) {
      throw new Error(
        `Tổng chia (${sum.toLocaleString('vi-VN')}đ) khác số tiền preset (${params.amount.toLocaleString('vi-VN')}đ)`,
      );
    }
  }
}

function normalize(row: ExpensePreset): ExpensePreset {
  const raw = row.splits_data as unknown;
  let splits: PresetSplitEntry[] | null = null;
  if (typeof raw === 'string') {
    try {
      splits = JSON.parse(raw) as PresetSplitEntry[];
    } catch {
      splits = null;
    }
  } else if (raw && typeof raw === 'object') {
    splits = raw as PresetSplitEntry[];
  }
  return { ...row, amount: Number(row.amount), splits_data: splits };
}

/** Preset của user, mới cập nhật trước. */
export async function fetchPresets(): Promise<ExpensePreset[]> {
  const userId = await getAuthUserId();
  if (!userId) return [];
  const { data, error } = await supabase
    .from('expense_presets')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as ExpensePreset[]).map(normalize);
}

export async function createPreset(params: PresetCreateParams): Promise<ExpensePreset> {
  const titleErr = validateName(params.title, 'Tên preset');
  if (titleErr) throw new Error(titleErr);
  const amountErr = validateAmount(params.amount);
  if (amountErr) throw new Error(amountErr);
  validateScope(params);
  const userId = await requireAuthUserId();

  const { data, error } = await supabase
    .from('expense_presets')
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      title: params.title.trim(),
      amount: params.amount,
      category: 'other',
      trip_id: params.tripId ?? null,
      paid_by_member_id: params.paidByMemberId ?? null,
      split_type: params.splitType ?? null,
      splits_data: params.splitsData ?? null,
      client_request_id: crypto.randomUUID(),
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new Error('Đã có preset trùng tên trong phạm vi này');
    throw error;
  }
  return normalize(data as ExpensePreset);
}

/** Cập nhật preset — RPC update_preset (P3). Preset là dữ liệu 1-user → lấy version mới nhất. */
export async function updatePreset(
  presetId: string,
  params: PresetCreateParams,
): Promise<ExpensePreset> {
  const titleErr = validateName(params.title, 'Tên preset');
  if (titleErr) throw new Error(titleErr);
  const amountErr = validateAmount(params.amount);
  if (amountErr) throw new Error(amountErr);
  validateScope(params);
  const userId = await requireAuthUserId();

  const { data: current, error: readErr } = await supabase
    .from('expense_presets')
    .select('version')
    .eq('id', presetId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();
  if (readErr) throw readErr;
  if (!current) throw new Error('Preset không tồn tại');

  const { error } = await supabase.rpc('update_preset', {
    p_preset_id: presetId,
    p_title: params.title.trim(),
    p_amount: params.amount,
    p_category: 'other',
    p_trip_id: params.tripId ?? null,
    p_paid_by_member_id: params.paidByMemberId ?? null,
    p_split_type: params.splitType ?? null,
    p_splits_data: params.splitsData ?? null,
    p_base_version: current.version as number,
    p_client_request_id: crypto.randomUUID(),
  });
  if (error) {
    if (error.code === '23505') throw new Error('Đã có preset trùng tên trong phạm vi này');
    throw error;
  }

  const { data: row, error: fetchErr } = await supabase
    .from('expense_presets')
    .select('*')
    .eq('id', presetId)
    .single();
  if (fetchErr) throw fetchErr;
  return normalize(row as ExpensePreset);
}

/** Xóa mềm preset. */
export async function deletePreset(presetId: string): Promise<void> {
  const userId = await requireAuthUserId();
  const { error } = await supabase
    .from('expense_presets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', presetId)
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) throw error;
}

/** "Full" preset = gắn chuyến + đủ người trả + cách chia → tạo khoản chi 1 chạm. */
export function isFullPreset(preset: ExpensePreset): boolean {
  return (
    preset.trip_id !== null &&
    preset.paid_by_member_id !== null &&
    preset.split_type !== null &&
    preset.splits_data !== null
  );
}

export interface PresetApplyResult {
  paidByMemberId: string;
  splitType: PresetSplitType;
  splits: SplitResult[];
  warnings: string[];
  hasFallback: boolean;
  tripGroupId: string;
}

/**
 * Resolve preset thành dữ liệu khoản chi cho 1 chuyến, fallback graceful nếu
 * thành viên trong preset đã rời nhóm (người trả → bạn; cách chia → chia đều).
 */
export async function applyPresetToTrip(
  preset: ExpensePreset,
  tripId: string,
): Promise<PresetApplyResult> {
  if (preset.trip_id !== null && preset.trip_id !== tripId) {
    throw new Error('Preset gắn với trip khác, không apply được');
  }
  const userId = await requireAuthUserId();

  const { data: trip, error: tripErr } = await supabase
    .from('trips')
    .select('group_id')
    .eq('id', tripId)
    .single();
  if (tripErr || !trip) throw new Error('Chuyến đi không tồn tại');
  const groupId = trip.group_id as string;

  const { data: membersRaw, error: memErr } = await supabase
    .from('group_members')
    .select('id, user_id, display_name, left_at')
    .eq('group_id', groupId);
  if (memErr) throw memErr;
  const members = (membersRaw ?? []) as {
    id: string;
    user_id: string | null;
    display_name: string;
    left_at: string | null;
  }[];

  const activeMembers = members.filter((m) => m.left_at === null);
  const activeIds = new Set(activeMembers.map((m) => m.id));
  const me = activeMembers.find((m) => m.user_id === userId);
  if (!me) throw new Error('Bạn không còn là thành viên của nhóm');

  const warnings: string[] = [];
  let hasFallback = false;

  let paidByMemberId: string;
  if (preset.paid_by_member_id && activeIds.has(preset.paid_by_member_id)) {
    paidByMemberId = preset.paid_by_member_id;
  } else {
    if (preset.paid_by_member_id) {
      const old = members.find((m) => m.id === preset.paid_by_member_id);
      warnings.push(`${old?.display_name ?? 'Người trả'} đã rời nhóm, đặt người trả mặc định là bạn`);
      hasFallback = true;
    }
    paidByMemberId = me.id;
  }

  let splitType: PresetSplitType;
  let splits: SplitResult[];
  const presetSplits = preset.splits_data;
  const allActive = presetSplits !== null && presetSplits.every((s) => activeIds.has(s.member_id));

  if (presetSplits !== null && preset.split_type !== null && allActive) {
    splitType = preset.split_type;
    if (splitType === 'equal') {
      splits = splitEqual(preset.amount, presetSplits.map((s) => s.member_id));
    } else if (splitType === 'ratio') {
      splits = splitByRatio(
        preset.amount,
        presetSplits.map((s) => ({ memberId: s.member_id, ratio: s.ratio ?? 1 })),
      );
    } else {
      splits = presetSplits.map((s) => ({ memberId: s.member_id, amount: s.amount ?? 0 }));
    }
  } else {
    if (presetSplits !== null) {
      warnings.push('Thành viên trong cách chia của preset đã thay đổi, đặt chia đều cho hiện tại');
      hasFallback = true;
    }
    splitType = 'equal';
    splits = splitEqual(preset.amount, activeMembers.map((m) => m.id));
  }

  return { paidByMemberId, splitType, splits, warnings, hasFallback, tripGroupId: groupId };
}
