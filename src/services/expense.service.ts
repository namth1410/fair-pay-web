import { supabase } from '../config/supabase';
import {
  computeBalances as computeBalancesPure,
  type ExpenseData,
  filterInactiveZeroBalance,
  type PaymentData,
} from '../utils/balance';
import { formatNotificationTitle } from '../utils/notificationFormat';
import { type SplitResult, validateSplits } from '../utils/split';
import { validateName, validatePositiveAmount } from '../utils/validate';
import { requireAuthUserId } from './auth.helper';
import { invokeEdgeFunction, uploadToPresignedUrl } from './edgeFunctions';
import type { Payment } from './payment.service';
import { getActorName } from './user.service';

export interface Expense {
  id: string;
  trip_id: string;
  group_id: string;
  title: string;
  amount: number;
  category: string;
  paid_by: string; // group_member id
  split_type: 'equal' | 'ratio' | 'custom';
  date: string;
  note: string | null;
  image_url: string | null;
  created_by: string;
  version: number;
  created_at: string;
  updated_at?: string;
  deleted_at: string | null;
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  amount: number;
}

export interface ExpenseWithSplits extends Expense {
  expense_splits: ExpenseSplit[];
  payer_name?: string;
}

export type SplitType = 'equal' | 'ratio' | 'custom';

function toRpcSplits(splits: SplitResult[]) {
  return splits.map((s) => ({ member_id: s.memberId, amount: s.amount }));
}

/**
 * Tạo khoản chi + splits — RPC create_expense atomic (insert + splits + audit +
 * notify). Ảnh (nếu có) upload SAU khi khoản chi đã tồn tại vì edge function
 * commit cần row expense.
 */
export async function createExpense(params: {
  id?: string;
  tripId: string;
  groupId: string;
  title: string;
  amount: number;
  paidByMemberId: string;
  splitType: SplitType;
  splits: SplitResult[];
  note?: string;
  date?: string;
}): Promise<Expense> {
  const title = params.title.trim();
  const titleErr = validateName(title, 'Tên khoản chi');
  if (titleErr) throw new Error(titleErr);
  const amountErr = validatePositiveAmount(params.amount);
  if (amountErr) throw new Error(amountErr);
  const splitsErr = validateSplits(params.amount, params.splits);
  if (splitsErr) throw new Error(splitsErr);
  await requireAuthUserId();

  const actorName = await getActorName();
  const { data, error } = await supabase
    .rpc('create_expense', {
      p_id: params.id ?? crypto.randomUUID(),
      p_trip_id: params.tripId,
      p_group_id: params.groupId,
      p_title: title,
      p_amount: params.amount,
      p_category: 'other',
      p_paid_by: params.paidByMemberId,
      p_split_type: params.splitType,
      p_splits: toRpcSplits(params.splits),
      p_note: params.note?.trim() || null,
      p_date: params.date ?? new Date().toISOString(),
      p_image_url: null,
      p_initial_title: formatNotificationTitle({
        type: 'expense.created',
        actorName,
        targetTitle: title,
        amount: params.amount,
      }),
      p_actor_name: actorName,
    })
    .single();
  if (error) throw error;
  return data as Expense;
}

/**
 * Sửa khoản chi + splits — P3 optimistic concurrency theo `baseVersion` của bản
 * đang hiển thị. Người khác sửa trước → P0410 `version_conflict`.
 *
 * `imageUrl`: URL hiện tại muốn giữ, hoặc null để bỏ ảnh. Ảnh MỚI upload riêng
 * qua `uploadExpenseImage` sau khi lưu (commit tự thay URL + xóa file cũ).
 */
export async function editExpense(params: {
  expense: Expense;
  title: string;
  amount: number;
  paidByMemberId: string;
  splitType: SplitType;
  splits: SplitResult[];
  note?: string | null;
  date?: string;
  imageUrl: string | null;
}): Promise<void> {
  const title = params.title.trim();
  const titleErr = validateName(title, 'Tên khoản chi');
  if (titleErr) throw new Error(titleErr);
  const amountErr = validatePositiveAmount(params.amount);
  if (amountErr) throw new Error(amountErr);
  const splitsErr = validateSplits(params.amount, params.splits);
  if (splitsErr) throw new Error(splitsErr);
  await requireAuthUserId();

  const actorName = await getActorName();
  const { error } = await supabase.rpc('update_expense', {
    p_expense_id: params.expense.id,
    p_title: title,
    p_amount: params.amount,
    p_category: params.expense.category || 'other',
    p_paid_by: params.paidByMemberId,
    p_split_type: params.splitType,
    p_splits: toRpcSplits(params.splits),
    p_note: params.note?.trim() || null,
    p_date: params.date ?? params.expense.date,
    p_image_url: params.imageUrl,
    p_base_version: params.expense.version,
    p_edited_title: formatNotificationTitle({
      type: 'expense.edited',
      actorName,
      targetTitle: title,
    }),
    p_actor_name: actorName,
    p_client_request_id: crypto.randomUUID(),
  });
  if (error) throw error;

  // Bỏ ảnh → dọn file R2 (best-effort, giống app).
  if (!params.imageUrl && params.expense.image_url) {
    removeExpenseImage(params.expense.id).catch((err) => {
      if (__DEV__) console.warn('[editExpense] removeExpenseImage failed:', err);
    });
  }
}

/** Xóa mềm khoản chi (admin; chuyến phải đang mở) + dọn ảnh R2. */
export async function deleteExpense(expense: Expense): Promise<void> {
  const actorName = await getActorName();
  const { error } = await supabase.rpc('delete_expense', {
    p_expense_id: expense.id,
    p_actor_name: actorName,
    p_client_request_id: crypto.randomUUID(),
    p_client_created_at: new Date().toISOString(),
  });
  if (error) throw error;
  if (expense.image_url) {
    removeExpenseImage(expense.id).catch((err) => {
      if (__DEV__) console.warn('[deleteExpense] removeExpenseImage failed:', err);
    });
  }
}

// ── Ảnh hoá đơn (R2 qua Edge Functions) ────────────────────────────────────

/** presign → PUT → commit (commit set expenses.image_url + xóa file cũ). */
export async function uploadExpenseImage(
  expenseId: string,
  tripId: string,
  image: { blob: Blob; sizeBytes: number },
): Promise<string> {
  const presign = await invokeEdgeFunction<{ uploadUrl: string; fileKey: string }>(
    'expense-image-presign',
    { expenseId, tripId, sizeBytes: image.sizeBytes },
  );
  await uploadToPresignedUrl(presign.uploadUrl, image.blob);
  const result = await invokeEdgeFunction<{ image_url: string }>('expense-image-commit', {
    expenseId,
    fileKey: presign.fileKey,
  });
  return result.image_url;
}

export async function removeExpenseImage(expenseId: string): Promise<void> {
  await invokeEdgeFunction('expense-image-remove', { expenseId });
}

// ── Balance data ───────────────────────────────────────────────────────────

export interface TripBalanceMember {
  id: string;
  displayName: string;
  leftAt: string | null;
}

export interface TripBalanceData {
  groupId: string;
  expenses: ExpenseWithSplits[];
  payments: Payment[];
  members: TripBalanceMember[];
}

/** 1 RPC gom expenses+splits / payments / members (kể cả đã rời) của chuyến. */
export async function fetchTripBalanceData(tripId: string): Promise<TripBalanceData | null> {
  const { data, error } = await supabase.rpc('get_trip_balance_data', { p_trip_id: tripId });
  if (error) throw error;
  if (!data) return null;
  const d = data as {
    group_id: string;
    expenses: ExpenseWithSplits[] | null;
    payments: Payment[] | null;
    members: { id: string; display_name: string; left_at: string | null }[] | null;
  };
  return {
    groupId: d.group_id,
    expenses: (d.expenses ?? []).map((e) => ({
      ...e,
      amount: Number(e.amount),
      expense_splits: (e.expense_splits ?? []).map((s) => ({ ...s, amount: Number(s.amount) })),
    })),
    payments: (d.payments ?? []).map((p) => ({ ...p, amount: Number(p.amount) })),
    members: (d.members ?? []).map((m) => ({
      id: m.id,
      displayName: m.display_name,
      leftAt: m.left_at,
    })),
  };
}

/** Pure compute số dư từng thành viên (bỏ người đã rời có số dư 0). */
export function computeTripBalances(
  members: TripBalanceMember[],
  expenses: { paid_by: string; amount: number; expense_splits: { member_id: string; amount: number }[] }[],
  payments: { from_member_id: string; to_member_id: string; amount: number }[],
): { memberId: string; memberName: string; balance: number }[] {
  const expenseData: ExpenseData[] = expenses.map((exp) => ({
    paidBy: exp.paid_by,
    amount: exp.amount,
    splits: (exp.expense_splits || []).map((s) => ({ memberId: s.member_id, amount: s.amount })),
  }));
  const paymentData: PaymentData[] = payments.map((pay) => ({
    fromMemberId: pay.from_member_id,
    toMemberId: pay.to_member_id,
    amount: pay.amount,
  }));
  const memberList = members.map((m) => ({ id: m.id, displayName: m.displayName }));
  const all = computeBalancesPure(memberList, expenseData, paymentData);
  const leftMap = new Map(members.map((m) => [m.id, m.leftAt]));
  return filterInactiveZeroBalance(all, leftMap);
}

/** 1 khoản chi + splits (form sửa). RLS: chỉ thành viên nhóm đọc được. */
export async function fetchExpenseById(expenseId: string): Promise<ExpenseWithSplits | null> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, expense_splits(*)')
    .eq('id', expenseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const e = data as ExpenseWithSplits;
  return {
    ...e,
    amount: Number(e.amount),
    expense_splits: (e.expense_splits ?? []).map((s) => ({ ...s, amount: Number(s.amount) })),
  };
}
