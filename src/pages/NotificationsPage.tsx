import { Button, Spinner } from '@heroui/react';
import {
  Bell,
  Check,
  CheckCheck,
  CircleCheck,
  CircleX,
  CreditCard,
  Filter,
  PencilLine,
  Receipt,
  Sparkles,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { InvitationConfirmDialog } from '../components/group/InvitationConfirmDialog';
import { HeaderIconButton, TabPage } from '../components/layout/LargeTitleHeader';
import { Avatar } from '../components/ui/Avatar';
import { ChipPicker, EmptyState } from '../components/ui/Primitives';
import { Sheet } from '../components/ui/Sheet';
import { RowsSkeleton } from '../components/ui/Skeleton';
import { fetchMyPendingInvitations, type MyPendingInvitation } from '../services/group.service';
import type { Notification } from '../services/notification.service';
import { useGroupStore } from '../stores/group.store';
import { useNotificationStore } from '../stores/notification.store';
import { showError, showSuccess, showWarning } from '../utils/toast';

function iconFor(type: string): LucideIcon {
  if (type.startsWith('expense.created')) return Receipt;
  if (type.startsWith('expense.edited')) return PencilLine;
  if (type.startsWith('expense.deleted')) return Trash2;
  if (type.startsWith('payment.')) return CreditCard;
  switch (type) {
    case 'member.join_requested':
    case 'member.invite_received':
      return UserPlus;
    case 'member.join_approved':
    case 'member.invite_accepted':
      return CircleCheck;
    case 'member.join_rejected':
    case 'member.invite_declined':
      return CircleX;
    case 'member.invite_revoked':
    case 'trip.closed':
      return UserMinus;
    case 'member.role_change':
      return Users;
    case 'trip.reminder_settle':
      return Sparkles;
    default:
      return Bell;
  }
}

function relativeTime(iso: string): string {
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function sectionOf(iso: string): string {
  const d = new Date(iso);
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const t = d.getTime();
  if (t >= startToday.getTime()) return 'Hôm nay';
  if (t >= startToday.getTime() - 86400_000) return 'Hôm qua';
  if (t >= startToday.getTime() - 7 * 86400_000) return 'Tuần này';
  return 'Cũ hơn';
}

function NotificationRow({
  n,
  onOpen,
  onDelete,
}: {
  n: Notification;
  onOpen: (n: Notification) => void;
  onDelete: (n: Notification) => void;
}) {
  const Icon = iconFor(n.type);
  const unread = !n.read_at;
  // Kiểu danh sách chat (khớp NotificationRow của app): nền phẳng; chưa đọc = chữ đậm + giờ xanh + chấm xanh.
  return (
    <li className="group relative flex items-center transition-colors hover:bg-surface-secondary">
      <button type="button" onClick={() => onOpen(n)} className="flex min-w-0 flex-1 items-center gap-3 self-stretch pl-4 text-left">
        <span className="relative h-[50px] w-[50px] shrink-0">
          {n.actor_id ? (
            <Avatar seed={n.actor_id} label={n.actor_name ?? '?'} photoUrl={n.actor_photo_url} size={48} />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-accent">
              <Icon className="h-[22px] w-[22px]" />
            </span>
          )}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface text-muted">
            <Icon className="h-3 w-3" />
          </span>
        </span>
        <span className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch border-b border-border py-[13px] pr-12">
          <span className="min-w-0 flex-1">
            <span className={`line-clamp-2 text-[15px] leading-5 ${unread ? 'font-bold text-foreground' : 'text-[color-mix(in_oklab,var(--foreground)_78%,transparent)]'}`}>
              {n.title}
            </span>
            {n.body ? <span className="line-clamp-2 text-xs text-muted">{n.body}</span> : null}
            <span className="mt-[3px] flex gap-1 text-xs">
              {n.group_name ? <span className="min-w-0 truncate text-muted">{n.group_name} ·</span> : null}
              <span className={`shrink-0 ${unread ? 'font-semibold text-accent' : 'text-muted'}`}>{relativeTime(n.created_at)}</span>
            </span>
          </span>
          {unread ? <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-label="Chưa đọc" /> : null}
        </span>
      </button>
      <button
        type="button"
        aria-label="Xóa thông báo"
        onClick={() => onDelete(n)}
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-muted opacity-100 shadow-surface transition-opacity hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const hasMore = useNotificationStore((s) => s.hasMore);
  const isRefreshing = useNotificationStore((s) => s.isRefreshing);
  const isLoadingMore = useNotificationStore((s) => s.isLoadingMore);
  const lastRefreshAt = useNotificationStore((s) => s.lastRefreshAt);
  const filter = useNotificationStore((s) => s.filter);
  const refresh = useNotificationStore((s) => s.refresh);
  const loadMore = useNotificationStore((s) => s.loadMore);
  const setFilter = useNotificationStore((s) => s.setFilter);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const remove = useNotificationStore((s) => s.remove);
  const refreshUnreadCount = useNotificationStore((s) => s.refreshUnreadCount);
  const groups = useGroupStore((s) => s.groups);
  const groupsLoaded = useGroupStore((s) => s.groupsLoaded);
  const loadGroups = useGroupStore((s) => s.loadGroups);
  const myInvitations = useGroupStore((s) => s.myPendingInvitations);

  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [invitation, setInvitation] = useState<MyPendingInvitation | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (Date.now() - lastRefreshAt < 30_000) void refreshUnreadCount();
    else void refresh().catch((e) => showError(e));
    if (!groupsLoaded) void loadGroups({ quiet: true }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cuộn vô hạn.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadMore().catch(() => {});
    });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, items.length]);

  const sections = useMemo(() => {
    const order = ['Hôm nay', 'Hôm qua', 'Tuần này', 'Cũ hơn'];
    const map = new Map<string, Notification[]>();
    for (const n of items) {
      const key = sectionOf(n.created_at);
      const arr = map.get(key) ?? [];
      arr.push(n);
      map.set(key, arr);
    }
    return order.filter((k) => map.has(k)).map((k) => [k, map.get(k)!] as const);
  }, [items]);

  const open = async (n: Notification) => {
    if (!n.read_at) void markRead([n.id]);
    if (n.type === 'member.invite_received') {
      const invId = (n.data?.invitation_id as string | undefined) ?? null;
      let inv = myInvitations.find((i) => i.invitation_id === invId) ?? null;
      if (!inv) {
        const list = await fetchMyPendingInvitations().catch(() => []);
        inv = list.find((i) => i.invitation_id === invId) ?? list.find((i) => i.group_id === n.group_id) ?? null;
      }
      if (inv) setInvitation(inv);
      else showWarning('Lời mời không còn hiệu lực', 'Có thể đã bị thu hồi hoặc bạn đã trả lời ở thiết bị khác.');
      return;
    }
    const tripId = (n.data?.trip_id as string | undefined) ?? n.trip_id;
    if (tripId && n.type !== 'trip.deleted') navigate(`/trips/${tripId}`);
    else if (n.group_id) navigate(`/groups/${n.group_id}`);
  };

  const groupChipLabel =
    filter.groupIds.length === 0
      ? 'Theo nhóm'
      : filter.groupIds.length === 1
        ? groups.find((g) => g.id === filter.groupIds[0])?.name ?? '1 nhóm'
        : `${filter.groupIds.length} nhóm`;

  return (
    <TabPage
      title="Thông báo"
      right={
        <HeaderIconButton
          icon={CheckCheck}
          label="Đánh dấu tất cả đã đọc"
          disabled={unreadCount === 0}
          onClick={() => {
            void markAllRead()
              .then(() => showSuccess('Đã đánh dấu tất cả đã đọc'))
              .catch((e) => showError(e));
          }}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2">
        <ChipPicker
          ariaLabel="Lọc thông báo"
          value={filter.scope}
          onChange={(scope) => void setFilter({ scope }).catch((e) => showError(e))}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'unread', label: unreadCount > 0 ? `Chưa đọc (${unreadCount})` : 'Chưa đọc' },
          ]}
        />
        <button
          type="button"
          onClick={() => setGroupSheetOpen(true)}
          className={`flex max-w-[60%] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            filter.groupIds.length
              ? 'border-accent bg-primary-soft text-accent'
              : 'border-border text-muted hover:text-foreground'
          }`}
        >
          <Filter className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{groupChipLabel}</span>
        </button>
        {filter.groupIds.length ? (
          <button
            type="button"
            onClick={() => void setFilter({ groupIds: [] })}
            className="text-xs font-semibold text-accent hover:underline"
          >
            Bỏ lọc
          </button>
        ) : null}
      </div>

      {isRefreshing && items.length === 0 ? (
        <RowsSkeleton count={8} size={48} minHeight={72} />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="Chưa có thông báo nào" subtitle="Hoạt động trong nhóm sẽ xuất hiện ở đây." />
      ) : (
        <div>
          {sections.map(([title, list]) => (
            <section key={title}>
              <p className="px-4 pb-1 pt-4 text-[13px] font-bold text-muted">{title}</p>
              <ul>
                {list.map((n) => (
                  <NotificationRow key={n.id} n={n} onOpen={(x) => void open(x)} onDelete={(x) => void remove(x.id)} />
                ))}
              </ul>
            </section>
          ))}
          <div ref={sentinelRef} className="flex h-12 items-center justify-center">
            {isLoadingMore ? <Spinner size="sm" color="current" className="text-muted" /> : null}
            {!hasMore && items.length > 10 ? <span className="text-xs text-muted">Đã hiển thị tất cả</span> : null}
          </div>
        </div>
      )}

      <Sheet
        isOpen={groupSheetOpen}
        onOpenChange={setGroupSheetOpen}
        title="Lọc theo nhóm"
        description="Chọn nhiều nhóm để xem cùng lúc"
        footer={
          filter.groupIds.length ? (
            <Button variant="ghost" onPress={() => void setFilter({ groupIds: [] })}>
              Bỏ chọn tất cả
            </Button>
          ) : null
        }
      >
        {groups.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Bạn chưa có nhóm nào.</p>
        ) : (
          <ul className="-mx-2">
            {groups.map((g) => {
              const selected = filter.groupIds.includes(g.id);
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() =>
                      void setFilter({
                        groupIds: selected ? filter.groupIds.filter((id) => id !== g.id) : [...filter.groupIds, g.id],
                      })
                    }
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-secondary"
                  >
                    <Avatar seed={g.id} label={g.name} photoUrl={g.avatar_url} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-foreground">{g.name}</span>
                      <span className="block text-xs text-muted">{g.member_count} thành viên</span>
                    </span>
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        selected ? 'border-accent bg-accent text-accent-foreground' : 'border-[color-mix(in_oklab,var(--muted)_60%,transparent)]'
                      }`}
                    >
                      {selected ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>

      <InvitationConfirmDialog invitation={invitation} onClose={() => setInvitation(null)} />
    </TabPage>
  );
}
