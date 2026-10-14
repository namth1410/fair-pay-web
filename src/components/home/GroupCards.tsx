import { ChevronRight, Users } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router';

import type { GroupWithMemberCount } from '../../services/group.service';
import { Avatar, GroupCover } from '../ui/Avatar';
import { Money } from '../ui/Money';

function BalanceBadge({ balance }: { balance: number }) {
  if (balance === 0) {
    return <span className="rounded-full bg-surface-secondary px-2.5 py-1 text-xs font-medium text-muted">cân bằng</span>;
  }
  return (
    <span className={`rounded-full px-2.5 py-1 ${balance > 0 ? 'balance-pill-positive' : 'balance-pill-negative'}`}>
      <Money value={balance} showSign tone="auto" size="sm" />
    </span>
  );
}

function ringColor(balance: number): string | undefined {
  if (balance > 0) return 'var(--money-positive)';
  if (balance < 0) return 'var(--money-negative)';
  return undefined;
}

/** Hàng nhóm dạng danh sách (GroupRow của app). */
export const GroupRow = memo(function GroupRow({
  group,
  balance,
}: {
  group: GroupWithMemberCount;
  balance: number;
}) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-surface p-3 shadow-surface transition-colors hover:border-foreground/20"
    >
      <Avatar seed={group.id} label={group.name} photoUrl={group.avatar_url} size={48} palette="color" ring={ringColor(balance)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-foreground">{group.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
          <Users className="h-3.5 w-3.5" />
          {group.member_count} thành viên
        </p>
      </div>
      <BalanceBadge balance={balance} />
      <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
});

/** Thẻ nhóm dạng lưới — ảnh bìa (avatar nhóm hoặc gradient pastel theo id). */
export const GroupTile = memo(function GroupTile({
  group,
  balance,
}: {
  group: GroupWithMemberCount;
  balance: number;
}) {
  return (
    <Link
      to={`/groups/${group.id}`}
      className="group flex flex-col overflow-hidden rounded-3xl border border-border/70 bg-surface shadow-surface transition-all hover:-translate-y-0.5 hover:border-foreground/20"
    >
      <div className="relative aspect-[16/11] overflow-hidden">
        <GroupCover seed={group.id} label={group.name} photoUrl={group.avatar_url} />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/35 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <span className="flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            <Users className="h-3 w-3" />
            {group.member_count}
          </span>
        </div>
      </div>
      <div className="min-w-0 px-3.5 pb-3 pt-2.5">
        <p className="truncate text-[15px] font-semibold text-foreground">{group.name}</p>
        <div className="mt-0.5 h-5">
          {balance === 0 ? (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Đã thanh toán</span>
          ) : (
            <Money value={balance} showSign tone="auto" size="sm" />
          )}
        </div>
      </div>
    </Link>
  );
});
