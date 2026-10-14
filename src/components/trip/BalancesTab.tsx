import { ArrowDownLeft, ArrowUpRight, Scale } from 'lucide-react';

import type { MyBalanceExplanation } from '../../utils/explainBalance';
import { formatVND } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { Money } from '../ui/Money';
import { EmptyState } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';
import type { BalanceEntry } from '../../stores/trip.store';

function balanceCaption(balance: number): string {
  if (balance > 0) return 'Được nhận';
  if (balance < 0) return 'Đang nợ';
  return 'Cân bằng';
}

/**
 * Số dư từng người dạng 1 thẻ danh sách (giao diện "Hội thoại", khớp BalancesTab của app).
 * Dấu theo quy ước: số dư CÓ DẤU vào <Money showSign> — '+' được nhận, '-' đang nợ, 0 cân bằng.
 */
export function BalancesTab({ balances, myMemberId }: { balances: BalanceEntry[]; myMemberId: string | null }) {
  if (balances.length === 0) {
    return <EmptyState icon={Scale} title="Thêm khoản chi để xem số dư" />;
  }
  const sorted = [...balances].sort((a, b) => b.balance - a.balance);
  return (
    <ul className="rounded-[18px] border border-border bg-surface px-3.5">
      {sorted.map((b, i) => (
        <li
          key={b.memberId}
          className={`flex min-h-[60px] items-center gap-3 py-2.5 ${i < sorted.length - 1 ? 'border-b border-border' : ''}`}
        >
          <Avatar seed={b.memberId} label={b.memberName} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-foreground">
              {b.memberName}
              {b.memberId === myMemberId ? <span className="font-normal text-muted"> (bạn)</span> : null}
            </p>
            <p className="text-xs text-muted">{balanceCaption(b.balance)}</p>
          </div>
          {b.balance === 0 ? (
            <span className="text-sm text-muted">—</span>
          ) : (
            <Money value={b.balance} showSign tone="auto" size="md" />
          )}
        </li>
      ))}
    </ul>
  );
}

/** "Cách tính số dư của bạn" — từng dòng ảnh hưởng tới số dư. */
export function MyBalanceExplanationSheet({
  isOpen,
  onOpenChange,
  tripName,
  explanation,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  tripName: string;
  explanation: MyBalanceExplanation | null;
}) {
  const lines = explanation?.lines ?? [];
  const total = explanation?.totalBalance ?? 0;

  const detail = (l: MyBalanceExplanation['lines'][number]) => {
    switch (l.kind) {
      case 'expense_paid_only':
        return `Bạn trả ${formatVND(l.amount)} · bạn không chịu phần nào`;
      case 'expense_paid_and_split':
        return `Bạn trả ${formatVND(l.amount)} · bạn chịu ${formatVND(l.myShare ?? 0)}`;
      case 'expense_split_only':
        return `${l.counterpartName ?? '?'} trả ${formatVND(l.amount)} · bạn chịu ${formatVND(l.myShare ?? 0)}`;
      case 'payment_sent':
        return `Trừ trực tiếp vào số bạn còn nợ ${l.counterpartName ?? '?'}`;
      case 'payment_received':
        return `Trừ trực tiếp vào số ${l.counterpartName ?? '?'} còn nợ bạn`;
    }
  };

  const title = (l: MyBalanceExplanation['lines'][number]) => {
    if (l.kind === 'payment_sent') return `Bạn thanh toán ${l.counterpartName ?? '?'}`;
    if (l.kind === 'payment_received') return `${l.counterpartName ?? '?'} thanh toán cho bạn`;
    return l.title;
  };

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title="Cách tính số dư của bạn" description={tripName}>
      {lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          Bạn chưa liên quan đến khoản chi hay thanh toán nào trong chuyến đi này.
        </p>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y divide-border rounded-xl border border-border">
            {lines.map((l, i) => {
              const up = l.delta >= 0;
              return (
                <li key={i} className="flex items-start gap-3 px-3.5 py-3">
                  <span
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      up ? 'balance-pill-positive' : 'balance-pill-negative'
                    }`}
                  >
                    {up ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{title(l)}</p>
                    <p className="text-xs leading-5 text-muted">{detail(l)}</p>
                  </div>
                  <Money value={l.delta} showSign tone="auto" size="sm" className="shrink-0" />
                </li>
              );
            })}
          </ul>
          <div className="flex items-center justify-between rounded-xl bg-surface-secondary px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              {total > 0 ? 'Bạn được nợ' : total < 0 ? 'Bạn đang nợ' : 'Đã cân bằng'}
            </span>
            <Money value={Math.abs(total)} size="lg" tone={total > 0 ? 'success' : total < 0 ? 'danger' : 'default'} />
          </div>
        </div>
      )}
    </Sheet>
  );
}
