import { Button } from '@heroui/react';
import { ArrowRight, CheckCheck, HandCoins, Pencil, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { GroupMember } from '../../services/group.service';
import type { Payment } from '../../services/payment.service';
import { type BalanceEntry, type SettlementEntry, useTripStore } from '../../stores/trip.store';
import { getErrorMessage } from '../../utils/error';
import { formatDateVN, formatVND, parseMoneyInput } from '../../utils/format';
import { showError, showSuccess, showValidationError, showWarning } from '../../utils/toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { TextInputField } from '../ui/Field';
import { Money } from '../ui/Money';
import { MoneyInput } from '../ui/MoneyInput';
import { ChipPicker, EmptyState, ErrorBox, SectionLabel } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

interface Props {
  settlements: SettlementEntry[];
  payments: Payment[];
  balances: BalanceEntry[];
  activeMembers: GroupMember[];
  myMemberId: string | null;
  myUserId: string | null;
  isAdmin: boolean;
  tripOpen: boolean;
  nameOf: (id: string) => string;
}

export function SettlementTab({
  settlements,
  payments,
  balances,
  activeMembers,
  myMemberId,
  myUserId,
  isAdmin,
  tripOpen,
  nameOf,
}: Props) {
  const addPayment = useTripStore((s) => s.addPayment);
  const addPayments = useTripStore((s) => s.addPayments);
  const removePayment = useTripStore((s) => s.removePayment);

  const [quick, setQuick] = useState<SettlementEntry | null>(null);
  const [settleAll, setSettleAll] = useState(false);
  const [sheet, setSheet] = useState<{ from?: string; to?: string; amount?: number } | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);

  // Gợi ý liên quan tới mình lên đầu (giữ thứ tự gốc còn lại).
  const sorted = useMemo(() => {
    if (!myMemberId) return settlements;
    const mine = settlements.filter((s) => s.from === myMemberId || s.to === myMemberId);
    const others = settlements.filter((s) => s.from !== myMemberId && s.to !== myMemberId);
    return [...mine, ...others];
  }, [settlements, myMemberId]);

  const label = (s: SettlementEntry) => {
    if (s.from === myMemberId) return `Bạn cần trả ${s.toName}`;
    if (s.to === myMemberId) return `${s.fromName} cần trả bạn`;
    return `${s.fromName} → ${s.toName}`;
  };
  const total = settlements.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-6">
      {settlements.length > 0 ? (
        <section className="space-y-3">
          <SectionLabel>Đề xuất quyết toán</SectionLabel>
          <p className="text-xs text-muted">
            {tripOpen ? "Bấm 'Ghi nhận' để xác nhận nhanh • 'Sửa' để đổi số tiền" : 'Gợi ý tối ưu — chỉ tham khảo'}
          </p>
          <ul className="space-y-2">
            {sorted.map((s) => {
              const mine = s.from === myMemberId || s.to === myMemberId;
              return (
                <li
                  key={`${s.from}-${s.to}`}
                  className={`flex flex-wrap items-center gap-3 rounded-2xl border bg-surface p-3 shadow-surface ${
                    mine ? 'border-foreground/25' : 'border-border/70'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{label(s)}</p>
                    <Money
                      value={s.amount}
                      size="md"
                      tone={s.from === myMemberId ? 'danger' : s.to === myMemberId ? 'success' : 'default'}
                    />
                  </div>
                  {tripOpen ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onPress={() => setSheet({ from: s.from, to: s.to, amount: s.amount })}>
                        <Pencil className="h-3.5 w-3.5" /> Sửa
                      </Button>
                      <Button size="sm" onPress={() => setQuick(s)}>
                        Ghi nhận
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {tripOpen && settlements.length > 1 ? (
            <Button fullWidth variant="secondary" onPress={() => setSettleAll(true)}>
              <CheckCheck className="h-4 w-4" /> Quyết toán tất cả
            </Button>
          ) : null}
        </section>
      ) : balances.length > 0 ? (
        <div className="rounded-2xl border border-border/70 bg-surface p-4 text-center text-sm text-muted shadow-surface">
          Cả nhóm đã cân bằng — không cần thanh toán thêm.
        </div>
      ) : null}

      <section className="space-y-3">
        <SectionLabel
          right={
            tripOpen ? (
              <Button size="sm" variant="secondary" onPress={() => setSheet({})}>
                <HandCoins className="h-4 w-4" /> Ghi nhận thanh toán
              </Button>
            ) : null
          }
        >
          Thanh toán thực tế
        </SectionLabel>
        {payments.length === 0 ? (
          <EmptyState icon={HandCoins} title="Chưa có thanh toán nào" className="py-8" />
        ) : (
          <ul className="space-y-2">
            {payments.map((p) => {
              const canDelete = tripOpen && (isAdmin || p.recorded_by === myUserId);
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface p-3 shadow-surface">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                      <span className="truncate">{nameOf(p.from_member_id)}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className="truncate">{nameOf(p.to_member_id)}</span>
                    </p>
                    <p className="truncate text-xs text-muted">
                      {formatDateVN(new Date(p.date))}
                      {p.note ? ` · ${p.note}` : ''}
                    </p>
                  </div>
                  <Money value={p.amount} tone="success" size="md" />
                  {canDelete ? (
                    <Button isIconOnly size="sm" variant="ghost" aria-label="Xóa thanh toán" onPress={() => setDeleting(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        isOpen={quick !== null}
        onOpenChange={(o) => !o && setQuick(null)}
        tone="accent"
        title="Ghi nhận thanh toán"
        description={quick ? `${label(quick)} — ${formatVND(quick.amount)}` : ''}
        confirmLabel="Ghi nhận"
        pendingLabel="Đang ghi..."
        onConfirm={async () => {
          if (!quick) return;
          try {
            await addPayment({ fromMemberId: quick.from, toMemberId: quick.to, amount: quick.amount });
            showSuccess('Đã ghi nhận thanh toán');
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />

      <ConfirmDialog
        isOpen={settleAll}
        onOpenChange={setSettleAll}
        tone="accent"
        title="Quyết toán tất cả"
        description={`Ghi nhận tất cả ${settlements.length} giao dịch (${formatVND(total)})? Số dư mọi người sẽ về 0.`}
        confirmLabel="Ghi nhận tất cả"
        pendingLabel="Đang ghi..."
        onConfirm={async () => {
          const { ok, failed } = await addPayments(
            settlements.map((s) => ({ fromMemberId: s.from, toMemberId: s.to, amount: s.amount })),
          );
          if (failed === 0) showSuccess(`Đã ghi nhận ${ok} thanh toán`);
          else showWarning(`Đã ghi ${ok}/${ok + failed} thanh toán`, `${failed} giao dịch lỗi, thử lại sau`);
        }}
      />

      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa thanh toán"
        description="Xóa ghi nhận thanh toán này?"
        confirmLabel="Xóa"
        pendingLabel="Đang xóa..."
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await removePayment(deleting.id);
            showSuccess('Đã xóa thanh toán');
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />

      <RecordPaymentSheet
        initial={sheet}
        onClose={() => setSheet(null)}
        activeMembers={activeMembers}
        balances={balances}
        onSubmit={async (input) => {
          await addPayment(input);
          showSuccess('Đã ghi nhận thanh toán');
        }}
      />
    </div>
  );
}

function RecordPaymentSheet({
  initial,
  onClose,
  activeMembers,
  balances,
  onSubmit,
}: {
  initial: { from?: string; to?: string; amount?: number } | null;
  onClose: () => void;
  activeMembers: GroupMember[];
  balances: BalanceEntry[];
  onSubmit: (input: { fromMemberId: string; toMemberId: string; amount: number; note?: string }) => Promise<void>;
}) {
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInitial, setLastInitial] = useState<typeof initial>(null);

  // Nạp giá trị mỗi lần mở sheet (state derive từ prop thay vì effect).
  if (initial !== lastInitial) {
    setLastInitial(initial);
    if (initial) {
      setFrom(initial.from ?? null);
      setTo(initial.to ?? null);
      setAmount(initial.amount ? String(initial.amount) : '');
      setNote('');
      setError(null);
    }
  }

  const options = activeMembers.map((m) => ({ value: m.id, label: m.display_name }));
  const balanceOf = (id: string) => balances.find((b) => b.memberId === id)?.balance ?? 0;

  const submit = async () => {
    setError(null);
    const value = parseInt(parseMoneyInput(amount) || '0', 10);
    if (!from || !to) return;
    if (!Number.isFinite(value) || value <= 0) {
      showValidationError('Lỗi', 'Số tiền phải lớn hơn 0');
      return;
    }
    if (from === to) {
      showValidationError('Lỗi', 'Người trả và người nhận không được giống nhau');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ fromMemberId: from, toMemberId: to, amount: value, note: note.trim() || undefined });
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={initial !== null}
      onOpenChange={(o) => !o && onClose()}
      isLocked={busy}
      title="Ghi nhận thanh toán"
      footer={
        <Button
          fullWidth
          isPending={busy}
          isDisabled={!from || !to || !amount || from === to}
          onPress={() => void submit()}
        >
          {busy ? 'Đang ghi...' : 'Ghi nhận'}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Người trả tiền</p>
          <ChipPicker ariaLabel="Người trả tiền" options={options} value={from} onChange={setFrom} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Người nhận tiền</p>
          <ChipPicker ariaLabel="Người nhận tiền" options={options} value={to} onChange={setTo} tone="success" />
        </div>
        <MoneyInput label="Số tiền (VND)" value={amount} onChange={setAmount} size="lg" />
        <TextInputField label="Ghi chú" value={note} onChange={setNote} placeholder="VD: Chuyển khoản Momo" maxLength={200} />

        {from && to && from !== to ? (
          <div className="rounded-xl bg-surface-secondary px-3.5 py-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Số dư hiện tại</p>
            {[from, to].map((id) => (
              <div key={id} className="flex items-center justify-between py-0.5 text-sm">
                <span className="truncate text-foreground">{activeMembers.find((m) => m.id === id)?.display_name}</span>
                <Money value={balanceOf(id)} showSign tone="auto" size="sm" />
              </div>
            ))}
          </div>
        ) : null}
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Sheet>
  );
}
