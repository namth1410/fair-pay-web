import { ChevronRight, Info, MessageSquarePlus } from 'lucide-react';
import { Fragment, useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { deleteExpense, type ExpenseWithSplits } from '../../services/expense.service';
import type { Payment } from '../../services/payment.service';
import type { Trip } from '../../services/trip.service';
import { useAuthStore } from '../../stores/auth.store';
import { useGroupStore } from '../../stores/group.store';
import { useTripStore } from '../../stores/trip.store';
import type { MyBalanceExplanation } from '../../utils/explainBalance';
import { formatDateVN, formatVND } from '../../utils/format';
import { processImageFile } from '../../utils/imageProcessing';
import { setPendingImage } from '../../utils/pendingImage';
import { showError, showSuccess } from '../../utils/toast';
import { buildTripThread, type ThreadItem } from '../../utils/tripThread';
import { PageHeader } from '../layout/PageHeader';
import { HeaderIconButton } from '../layout/LargeTitleHeader';
import { Avatar } from '../ui/Avatar';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { MyBalanceExplanationSheet } from './BalancesTab';
import { ExpenseDetailSheet } from './ExpenseDetailSheet';
import { ExpenseBubble, PaymentBubble } from './thread/Bubbles';
import { DragonMessage, ThreadDaySeparator, ThreadSystemNotice } from './thread/ThreadNotices';
import { TripComposer } from './thread/TripComposer';

type Item = ThreadItem<ExpenseWithSplits, Payment>;

const SPLIT_LABEL: Record<string, string> = {
  equal: 'Chia đều',
  ratio: 'Chia theo tỷ lệ',
  custom: 'Chia tùy chỉnh',
};

/** Người "gửi" của 1 tin (người trả / người chuyển) — null với vạch ngày, tin hệ thống. */
function senderKeyOf(item: Item | undefined): string | null {
  if (!item) return null;
  if (item.kind === 'expense') return item.expense.paid_by;
  if (item.kind === 'payment') return item.payment.from_member_id;
  return null;
}

interface TripThreadProps {
  trip: Trip;
  explanation: MyBalanceExplanation | null;
  /** Mở panel/trang Thông tin chuyến (tab tuỳ chọn). */
  onOpenInfo: (tab?: string) => void;
  infoOpen: boolean;
  /** Sau khi xoá/sửa dữ liệu → làm mới chuyến + số dư tổng. */
  afterMutation: () => void;
}

/**
 * Màn chuyến đi giao diện "Hội thoại": 1 luồng tin gộp khoản chi + thanh toán theo thời gian (mới
 * nhất sát ô soạn ở đáy), banner số dư của bạn ở trên. Số dư / Quyết toán / Lịch sử / Quản lý nằm
 * ở "Thông tin chuyến" (nút ⓘ). Khớp màn trips/[id] của app.
 */
export function TripThread({ trip, explanation, onOpenInfo, infoOpen, afterMutation }: TripThreadProps) {
  const navigate = useNavigate();
  const expenses = useTripStore((s) => s.expenses);
  const payments = useTripStore((s) => s.payments);
  const allMembers = useTripStore((s) => s.allMembers);
  const settlements = useTripStore((s) => s.settlements);
  const isLoadingTrip = useTripStore((s) => s.isLoadingTrip);
  const removePayment = useTripStore((s) => s.removePayment);
  const toggleTripStatus = useTripStore((s) => s.toggleTripStatus);

  const group = useGroupStore((s) => (s.currentGroupId === trip.group_id ? s.currentGroup : null));
  const members = useGroupStore((s) => (s.currentGroupId === trip.group_id ? s.members : null));
  const myMemberId = useGroupStore((s) => (s.currentGroupId === trip.group_id ? s.myMemberId : null));
  const isAdmin = useGroupStore((s) => s.currentGroupId === trip.group_id && s.myRole === 'admin');
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);

  const [explainOpen, setExplainOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseWithSplits | null>(null);
  const [deleteExpenseTarget, setDeleteExpenseTarget] = useState<ExpenseWithSplits | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<Payment | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [isPicking, setIsPicking] = useState(false);

  const isOpen = trip.status === 'open';
  const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);

  // allMembers gồm cả người đã rời (tên vẫn hiện đúng trong luồng cũ).
  const nameOf = useCallback(
    (memberId: string) => allMembers.find((m) => m.id === memberId)?.displayName || '?',
    [allMembers],
  );
  // created_by / recorded_by là users.id → map sang member để hiện "do X ghi".
  const memberByUserId = useMemo(() => {
    const map = new Map<string, { id: string; display_name: string }>();
    for (const m of members ?? []) if (m.user_id) map.set(m.user_id, m);
    return map;
  }, [members]);
  const userIdOfMember = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const m of members ?? []) map.set(m.id, m.user_id);
    return map;
  }, [members]);

  const thread = useMemo(
    () =>
      buildTripThread<ExpenseWithSplits, Payment>({
        expenses,
        payments,
        closedAt: trip.status === 'closed' ? (trip.closed_at ?? null) : null,
        showSuggest: trip.status === 'open' && settlements.length > 0,
      }),
    [expenses, payments, trip.status, trip.closed_at, settlements.length],
  );
  // Thứ tự hiển thị cũ → mới (trên → dưới); vùng cuộn flex-col-reverse tự neo ở đáy.
  const ascending = useMemo(() => [...thread].reverse(), [thread]);

  // Gợi ý tất toán của rồng: ưu tiên lượt chuyển liên quan tới chính user.
  const suggestText = useMemo(() => {
    const toMe = settlements.find((s) => s.to === myMemberId);
    if (toMe) return `${toMe.fromName} nên trả bạn ${formatVND(toMe.amount)} để cân sổ.`;
    const fromMe = settlements.find((s) => s.from === myMemberId);
    if (fromMe) return `Bạn nên trả ${fromMe.toName} ${formatVND(fromMe.amount)} để cân sổ.`;
    return `Còn ${settlements.length} lượt chuyển để cả nhóm cân sổ.`;
  }, [settlements, myMemberId]);

  const expenseDetail = useCallback(
    (e: ExpenseWithSplits): string => {
      const n = e.expense_splits.length;
      const isMine = e.paid_by === myMemberId;
      let mode = `${SPLIT_LABEL[e.split_type] ?? 'Chia'} ${n} người`;
      const parts: string[] = [];
      if (isMine) {
        parts.push('Bạn trả');
        mode = mode.charAt(0).toLowerCase() + mode.slice(1);
      }
      parts.push(mode);
      if (myMemberId) {
        const mySplit = e.expense_splits.find((s) => s.member_id === myMemberId);
        if (mySplit && mySplit.amount > 0) parts.push(`phần bạn ${formatVND(mySplit.amount)}`);
        else if (!isMine) parts.push('bạn không tham gia');
      }
      // Người ghi khác người trả → nói rõ (vd Nam ghi hộ khoản Hà trả).
      const recorder = memberByUserId.get(e.created_by);
      const payerUserId = userIdOfMember.get(e.paid_by) ?? null;
      if (recorder && e.created_by !== payerUserId) {
        parts.push(`do ${recorder.id === myMemberId ? 'bạn' : recorder.display_name} ghi`);
      }
      return parts.join(' · ');
    },
    [myMemberId, memberByUserId, userIdOfMember],
  );

  const paymentHeadline = useCallback(
    (p: Payment): string => {
      if (p.to_member_id === myMemberId) return 'Đã chuyển cho bạn';
      if (p.from_member_id === myMemberId) return `Bạn đã chuyển cho ${nameOf(p.to_member_id)}`;
      return `Đã chuyển cho ${nameOf(p.to_member_id)}`;
    },
    [myMemberId, nameOf],
  );

  const compose = () => navigate(`/trips/${trip.id}/expenses/new?expenseId=${crypto.randomUUID()}`);

  const pickImage = async (file: File) => {
    setIsPicking(true);
    try {
      const img = await processImageFile(file);
      setPendingImage(img);
      navigate(`/trips/${trip.id}/expenses/new?expenseId=${crypto.randomUUID()}&withImage=1`);
    } catch (e) {
      showError(e);
    } finally {
      setIsPicking(false);
    }
  };

  // Quy ước dấu: '+' được nhận, '-' đang nợ, 0 → cân bằng.
  const myBalance = explanation?.totalBalance ?? 0;
  let balanceText = 'Bạn đang cân bằng';
  let balanceCls = 'text-foreground';
  if (myMemberId && myBalance !== 0) {
    balanceText = `Số dư của bạn ${myBalance > 0 ? '+' : '-'}${formatVND(Math.abs(myBalance))}`;
    balanceCls = myBalance > 0 ? 'text-money-positive' : 'text-money-negative';
  }
  const memberCount = members?.filter((m) => !m.left_at).length ?? allMembers.length;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <PageHeader
        back={`/groups/${trip.group_id}`}
        hideBackOnWide
        leading={<Avatar seed={trip.id} label={trip.name} size={40} />}
        title={trip.name}
        subtitle={`${group?.name ?? ''}${group ? ' · ' : ''}${memberCount} người${isOpen ? '' : ' · đã đóng'}`}
        onTitleClick={() => onOpenInfo()}
        titleLabel={`Thông tin chuyến ${trip.name}`}
        right={
          <HeaderIconButton
            icon={Info}
            label="Thông tin chuyến: số dư, quyết toán, lịch sử"
            onClick={() => onOpenInfo()}
            variant={infoOpen ? 'soft' : 'ghost'}
          />
        }
      />

      <button
        type="button"
        onClick={() => setExplainOpen(true)}
        disabled={!explanation}
        aria-label={`${balanceText}. Tổng chi ${formatVND(totalSpent)}, ${expenses.length} khoản, ${memberCount} người. Xem cách tính`}
        className="flex min-h-14 shrink-0 items-center gap-2.5 bg-brand-soft px-4 py-2 text-left transition-opacity hover:opacity-90 disabled:cursor-default"
      >
        <span className="min-w-0 flex-1">
          <span className={`block text-[15px] font-bold leading-5 ${balanceCls}`}>{balanceText}</span>
          <span className="block truncate text-xs text-muted">
            Tổng chi {formatVND(totalSpent)} · {expenses.length} khoản · {memberCount} người
          </span>
        </span>
        {explanation ? (
          <span className="flex shrink-0 items-center gap-0.5 text-[13px] font-bold text-accent">
            Cách tính <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </span>
        ) : null}
      </button>

      <div className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto" aria-live="polite">
        {/* Bám 2 lề như app nhắn tin (tin người khác trái, của mình phải) — KHÔNG gói vào cột
            giữa: khung chính desktop rộng thì cột giữa để lại 2 mảng trống, trông như căn giữa.
            Độ rộng mỗi bong bóng đã tự giới hạn trong Bubbles. */}
        <div className="w-full px-3 py-3 sm:px-5">
          {ascending.length === 0 && !isLoadingTrip ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-soft text-accent">
                <MessageSquarePlus className="h-7 w-7" />
              </span>
              <p className="mt-4 text-base font-bold text-foreground">Chưa có khoản chi nào</p>
              <p className="mt-1 max-w-xs text-sm text-muted">
                {isOpen ? 'Bấm “Thêm khoản chi…” ở dưới để ghi khoản đầu tiên của chuyến.' : 'Chuyến đã đóng.'}
              </p>
            </div>
          ) : null}
          {ascending.map((item, index) => {
            // Gom tin liên tiếp cùng người gửi như app nhắn tin: tên ở tin đầu cụm (trên),
            // avatar ở tin cuối cụm (dưới).
            const key = senderKeyOf(item);
            const showSender = senderKeyOf(ascending[index - 1]) !== key;
            const showAvatar = senderKeyOf(ascending[index + 1]) !== key;
            switch (item.kind) {
              case 'day':
                return <ThreadDaySeparator key={item.key} title={item.title} />;
              case 'expense':
                return (
                  <ExpenseBubble
                    key={item.key}
                    expense={item.expense}
                    isMine={item.expense.paid_by === myMemberId}
                    senderName={nameOf(item.expense.paid_by)}
                    detail={expenseDetail(item.expense)}
                    onOpen={setSelectedExpense}
                    onDelete={isOpen && isAdmin ? setDeleteExpenseTarget : undefined}
                    showSender={showSender}
                    showAvatar={showAvatar}
                  />
                );
              case 'payment': {
                const canDelete = isOpen && (isAdmin || item.payment.recorded_by === myUserId);
                return (
                  <PaymentBubble
                    key={item.key}
                    payment={item.payment}
                    isMine={item.payment.from_member_id === myMemberId}
                    senderName={nameOf(item.payment.from_member_id)}
                    headline={paymentHeadline(item.payment)}
                    onDelete={canDelete ? setDeletePaymentTarget : undefined}
                    showSender={showSender}
                    showAvatar={showAvatar}
                  />
                );
              }
              case 'closed':
                return (
                  <ThreadSystemNotice
                    key={item.key}
                    text={`Chuyến đi đã đóng · ${formatDateVN(new Date(item.closedAt))}`}
                  />
                );
              case 'suggest':
                return (
                  <Fragment key={item.key}>
                    <DragonMessage
                      title="Gợi ý tất toán"
                      text={suggestText}
                      actionLabel="Xem cách tất toán"
                      onAction={() => onOpenInfo('settlement')}
                    />
                  </Fragment>
                );
              default:
                return null;
            }
          })}
        </div>
      </div>

      <TripComposer
        isClosed={!isOpen}
        isPicking={isPicking}
        onCompose={compose}
        onPickImage={(f) => void pickImage(f)}
        closedActionLabel={isAdmin ? 'Mở lại' : undefined}
        onClosedAction={isAdmin ? () => setReopenOpen(true) : undefined}
      />

      <MyBalanceExplanationSheet
        isOpen={explainOpen}
        onOpenChange={setExplainOpen}
        tripName={trip.name}
        explanation={explanation}
      />
      <ExpenseDetailSheet
        expense={selectedExpense}
        onClose={() => setSelectedExpense(null)}
        tripOpen={isOpen}
        canDelete={isAdmin}
        nameOf={nameOf}
        onDeleted={afterMutation}
      />
      <ConfirmDialog
        isOpen={deleteExpenseTarget !== null}
        onOpenChange={(o) => !o && setDeleteExpenseTarget(null)}
        title="Xóa khoản chi"
        description={`Xóa "${deleteExpenseTarget?.title ?? ''}"? Số dư cả nhóm sẽ tính lại.`}
        confirmLabel="Xóa"
        pendingLabel="Đang xóa..."
        onConfirm={async () => {
          if (!deleteExpenseTarget) return;
          try {
            await deleteExpense(deleteExpenseTarget);
            showSuccess('Đã xóa khoản chi', deleteExpenseTarget.title);
            afterMutation();
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
      <ConfirmDialog
        isOpen={deletePaymentTarget !== null}
        onOpenChange={(o) => !o && setDeletePaymentTarget(null)}
        title="Xóa thanh toán"
        description={
          deletePaymentTarget
            ? `Xóa lượt ${nameOf(deletePaymentTarget.from_member_id)} chuyển ${formatVND(deletePaymentTarget.amount)} cho ${nameOf(deletePaymentTarget.to_member_id)}?`
            : ''
        }
        confirmLabel="Xóa"
        pendingLabel="Đang xóa..."
        onConfirm={async () => {
          if (!deletePaymentTarget) return;
          try {
            await removePayment(deletePaymentTarget.id);
            showSuccess('Đã xóa thanh toán');
            afterMutation();
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
      <ConfirmDialog
        isOpen={reopenOpen}
        onOpenChange={setReopenOpen}
        tone="success"
        title="Mở lại chuyến đi?"
        description={`Mở lại "${trip.name}" để tiếp tục ghi khoản chi và thanh toán.`}
        confirmLabel="Mở lại"
        pendingLabel="Đang mở lại..."
        onConfirm={async () => {
          try {
            await toggleTripStatus(trip);
            showSuccess('Đã mở lại chuyến', trip.name);
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
    </div>
  );
}
