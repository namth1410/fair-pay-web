import { ArrowRight, Trash2 } from 'lucide-react';
import { memo, type ReactNode } from 'react';

import type { ExpenseWithSplits } from '../../../services/expense.service';
import type { Payment } from '../../../services/payment.service';
import { formatVND } from '../../../utils/format';
import { Avatar } from '../../ui/Avatar';

// Bong bóng tin trong luồng chuyến đi (giao diện "Hội thoại", khớp ExpenseBubble/PaymentBubble
// của app). Người "gửi" = người TRẢ tiền / người CHUYỂN; tin của mình nằm bên phải màu thương hiệu.
// Trên web: bấm khoản chi → xem chi tiết; nút xoá hiện khi rê chuột (thay cho nhấn giữ của app).

interface RowProps {
  isMine: boolean;
  senderSeed: string;
  senderName: string;
  showSender: boolean;
  showAvatar: boolean;
  children: ReactNode;
}

/** Khung hàng: tin của mình canh phải; của người khác có avatar 28px + tên ở tin đầu cụm. */
function BubbleRow({ isMine, senderSeed, senderName, showSender, showAvatar, children }: RowProps) {
  if (isMine) {
    return <div className="group/row my-1 flex justify-end pl-14">{children}</div>;
  }
  return (
    <div className="group/row my-1 flex items-end gap-2 pr-12">
      {showAvatar ? <Avatar seed={senderSeed} label={senderName} size={28} /> : <span className="w-7 shrink-0" />}
      <div className="flex min-w-0 shrink flex-col items-start">
        {showSender ? <span className="mb-[3px] ml-3 text-xs font-semibold text-muted">{senderName}</span> : null}
        {children}
      </div>
    </div>
  );
}

/** Nút xoá nhỏ cạnh bong bóng — chỉ hiện khi rê chuột / focus (luồng còn mở). */
function DeleteHandle({ label, onClick, side }: { label: string; onClick: () => void; side: 'left' | 'right' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 shrink-0 items-center justify-center self-center rounded-full text-muted opacity-0 transition-opacity hover:bg-danger-tint hover:text-danger focus-visible:opacity-100 group-hover/row:opacity-100 ${
        side === 'left' ? 'order-first mr-1' : 'ml-1'
      }`}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export const ExpenseBubble = memo(function ExpenseBubble({
  expense,
  isMine,
  senderName,
  detail,
  onOpen,
  onDelete,
  showSender = true,
  showAvatar = true,
}: {
  expense: ExpenseWithSplits;
  isMine: boolean;
  senderName: string;
  /** Dòng phụ dưới số tiền (cách chia, phần của bạn, người ghi...). */
  detail: string;
  onOpen: (expense: ExpenseWithSplits) => void;
  onDelete?: (expense: ExpenseWithSplits) => void;
  showSender?: boolean;
  showAvatar?: boolean;
}) {
  const fg = isMine ? 'text-on-bubble-mine' : 'text-foreground';
  const sub = isMine ? 'text-on-bubble-mine-muted' : 'text-muted';

  return (
    <BubbleRow
      isMine={isMine}
      senderSeed={expense.paid_by}
      senderName={senderName}
      showSender={showSender}
      showAvatar={showAvatar}
    >
      <div className="flex max-w-full items-center">
        <button
          type="button"
          onClick={() => onOpen(expense)}
          aria-label={`${isMine ? 'Bạn' : senderName} trả ${formatVND(expense.amount)} cho ${expense.title}. ${detail}`}
          className={`min-w-0 max-w-[460px] rounded-[20px] px-3.5 pb-[11px] pt-2.5 text-left transition-[filter] hover:brightness-[0.97] ${
            isMine ? 'rounded-br-md bg-bubble-mine' : 'rounded-bl-md bg-bubble-other'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span className="min-w-0">
              <span className={`line-clamp-2 block text-[15px] font-semibold leading-5 ${fg}`}>{expense.title}</span>
              <span className={`tabular mt-[3px] block text-[22px] font-extrabold leading-7 tracking-[-0.02em] ${fg}`}>
                {formatVND(expense.amount)}
              </span>
            </span>
            {expense.image_url ? (
              <img
                src={expense.image_url}
                alt=""
                className="h-[52px] w-[52px] shrink-0 rounded-xl object-cover"
                loading="lazy"
              />
            ) : null}
          </span>
          <span className={`mt-0.5 block text-xs leading-4 ${sub}`}>{detail}</span>
        </button>
        {onDelete ? (
          <DeleteHandle label={`Xoá khoản chi ${expense.title}`} onClick={() => onDelete(expense)} side={isMine ? 'left' : 'right'} />
        ) : null}
      </div>
    </BubbleRow>
  );
});

export const PaymentBubble = memo(function PaymentBubble({
  payment,
  isMine,
  senderName,
  headline,
  onDelete,
  showSender = true,
  showAvatar = true,
}: {
  payment: Payment;
  isMine: boolean;
  senderName: string;
  headline: string;
  onDelete?: (payment: Payment) => void;
  showSender?: boolean;
  showAvatar?: boolean;
}) {
  return (
    <BubbleRow
      isMine={isMine}
      senderSeed={payment.from_member_id}
      senderName={senderName}
      showSender={showSender}
      showAvatar={showAvatar}
    >
      <div className="flex max-w-full items-center">
        <div
          role="note"
          aria-label={`${isMine ? 'Bạn' : senderName}: ${headline} ${formatVND(payment.amount)}`}
          className={`min-w-0 max-w-[460px] rounded-[20px] border-[1.5px] border-brand-border bg-brand-soft px-3.5 pb-[11px] pt-2.5 ${
            isMine ? 'rounded-br-md' : 'rounded-bl-md'
          }`}
        >
          <span className="flex items-center gap-1.5 text-[13px] font-bold text-money-positive">
            <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2.4} />
            {headline}
          </span>
          <span className="tabular mt-[3px] block text-[22px] font-extrabold leading-7 tracking-[-0.02em] text-foreground">
            {formatVND(payment.amount)}
          </span>
          {payment.note ? <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{payment.note}</span> : null}
        </div>
        {onDelete ? (
          <DeleteHandle label="Xoá thanh toán" onClick={() => onDelete(payment)} side={isMine ? 'left' : 'right'} />
        ) : null}
      </div>
    </BubbleRow>
  );
});
