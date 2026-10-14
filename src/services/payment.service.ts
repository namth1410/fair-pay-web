import { supabase } from '../config/supabase';
import { formatNotificationTitle } from '../utils/notificationFormat';
import { validatePositiveAmount } from '../utils/validate';
import { requireAuthUserId } from './auth.helper';
import { getActorName } from './user.service';

export interface Payment {
  id: string;
  trip_id: string;
  group_id: string;
  from_member_id: string;
  to_member_id: string;
  amount: number;
  note: string | null;
  recorded_by: string;
  date: string;
  version: number;
  client_request_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Ghi nhận thanh toán — RPC create_payment atomic (insert + audit + notify người
 * trả/người nhận). Title notification render ở client như app.
 */
export async function createPayment(params: {
  tripId: string;
  groupId: string;
  fromMemberId: string;
  toMemberId: string;
  fromName: string;
  toName: string;
  amount: number;
  note?: string;
}): Promise<Payment> {
  const amountErr = validatePositiveAmount(params.amount);
  if (amountErr) throw new Error(amountErr);
  if (params.fromMemberId === params.toMemberId) {
    throw new Error('Người trả và người nhận không được giống nhau');
  }
  await requireAuthUserId();

  const actorName = await getActorName();
  const titleParams = {
    actorName,
    fromName: params.fromName,
    toName: params.toName,
    amount: params.amount,
  };
  const { data, error } = await supabase
    .rpc('create_payment', {
      p_id: crypto.randomUUID(),
      p_trip_id: params.tripId,
      p_group_id: params.groupId,
      p_from_member_id: params.fromMemberId,
      p_to_member_id: params.toMemberId,
      p_amount: params.amount,
      p_note: params.note?.trim() || null,
      p_date: new Date().toISOString(),
      p_client_request_id: crypto.randomUUID(),
      p_title_for_payer: formatNotificationTitle({ type: 'payment.recorded', ...titleParams }),
      p_title_for_receiver: formatNotificationTitle({ type: 'payment.received', ...titleParams }),
      p_actor_name: actorName,
    })
    .single<Payment>();
  if (error) throw error;
  if (!data) throw new Error('Ghi nhận thanh toán thất bại');
  return data;
}

/** Xóa mềm thanh toán — người ghi nhận hoặc admin. */
export async function deletePayment(paymentId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_payment', {
    p_payment_id: paymentId,
    p_client_request_id: crypto.randomUUID(),
    p_client_created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export { calculateSettlements } from '../utils/settlement';
