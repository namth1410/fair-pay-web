import { memo } from 'react';
import { Link } from 'react-router';

import { formatShortVND, formatVND } from '../../utils/format';
import { Avatar } from '../ui/Avatar';

// Hàng nhóm kiểu danh sách đoạn chat (giao diện "Hội thoại"): avatar to, tên đậm, dòng
// xem trước + số dư gọn ở cuối. Đường kẻ chỉ chạy dưới phần chữ (không dưới avatar). Khớp
// GroupChatRow của app.
interface GroupChatRowProps {
  id: string;
  name: string;
  avatarUrl?: string | null;
  memberCount: number;
  balance: number;
  /** Đang mở nhóm này ở khung chính (desktop) → tô nền. */
  active?: boolean;
}

export const GroupChatRow = memo(function GroupChatRow({
  id,
  name,
  avatarUrl,
  memberCount,
  balance,
  active = false,
}: GroupChatRowProps) {
  // Quy ước dấu: '+' được nhận (xanh), '-' đang nợ (đỏ), 0 → "Cân bằng".
  let balanceLabel = 'Cân bằng';
  let balanceCls = 'font-medium text-muted';
  let a11yBalance = 'cân bằng';
  if (balance > 0) {
    balanceLabel = `+${formatShortVND(balance)}`;
    balanceCls = 'font-bold text-money-positive';
    a11yBalance = `được nhận ${formatVND(balance)}`;
  } else if (balance < 0) {
    balanceLabel = `-${formatShortVND(balance)}`;
    balanceCls = 'font-bold text-money-negative';
    a11yBalance = `cần trả ${formatVND(-balance)}`;
  }

  return (
    <Link
      to={`/groups/${id}`}
      aria-label={`${name}, ${memberCount} thành viên, ${a11yBalance}`}
      aria-current={active ? 'page' : undefined}
      className={`group flex min-h-[76px] items-center gap-3 pl-4 transition-colors ${
        active ? 'bg-primary-soft' : 'hover:bg-surface-secondary'
      }`}
    >
      <Avatar seed={id} label={name} photoUrl={avatarUrl ?? null} size={54} />
      <span className="flex min-w-0 flex-1 flex-col self-stretch justify-center border-b border-border py-3 pr-4">
        <span className="truncate text-base font-bold leading-[22px] text-foreground">{name}</span>
        <span className="mt-0.5 flex items-center gap-2 text-[13px] leading-[18px]">
          <span className="min-w-0 flex-1 truncate text-muted">{memberCount} thành viên</span>
          <span className={`shrink-0 tabular ${balanceCls}`}>{balanceLabel}</span>
        </span>
      </span>
    </Link>
  );
});
