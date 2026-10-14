import { Button, Checkbox, Skeleton, Spinner } from '@heroui/react';
import {
  Bell,
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
import { HeaderIconButton, PageHeader } from '../components/layout/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { ChipPicker, EmptyState } from '../components/ui/Primitives';
import { Sheet } from '../components/ui/Sheet';
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
  return (
    <li
      className={`group relative flex items-start gap-3 rounded-2xl px-3 py-3 transition-colors ${
        unread ? 'bg-surface shadow-surface' : 'hover:bg-surface/60'
      }`}
    >
      <button type="button" onClick={() => onOpen(n)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
        <span className="relative shrink-0">
          {n.actor_id ? (
            <Avatar seed={n.actor_id} label={n.actor_name ?? '?'} photoUrl={n.actor_photo_url} size={40} />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-secondary">
              <Icon className="h-5 w-5 text-foreground" />
            </span>
          )}
          {n.actor_id ? (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-foreground text-background">
              <Icon className="h-2.5 w-2.5" />
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`line-clamp-2 text-sm leading-5 text-foreground ${unread ? 'font-semibold' : ''}`}>{n.title}</span>
          {n.body ? <span className="line-clamp-2 text-xs text-muted">{n.body}</span> : null}
          <span className="mt-0.5 block truncate text-xs text-muted">
            {n.group_name ? `${n.group_name} · ` : ''}
            {relativeTime(n.created_at)}
          </span>
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-1 self-center">
        {unread ? <span className="h-2 w-2 rounded-full bg-danger" aria-label="Chưa đọc" /> : null}
        <button
          type="button"
          aria-label="Xóa thông báo"
          onClick={() => onDelete(n)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted opacity-100 transition-opacity hover:bg-surface-secondary hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </span>
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
    <>
      <PageHeader
        title="Thông báo"
        right={
          <HeaderIconButton
            label="Đánh dấu tất cả đã đọc"
            disabled={unreadCount === 0}
            onClick={() => {
              void markAllRead()
                .then(() => showSuccess('Đã đánh dấu tất cả đã đọc'))
                .catch((e) => showError(e));
            }}
          >
            <CheckCheck className="h-5 w-5" />
          </HeaderIconButton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
              ? 'border-foreground bg-surface-secondary text-foreground'
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
            className="text-xs font-semibold text-muted hover:text-foreground"
          >
            Bỏ lọc
          </button>
        ) : null}
      </div>

      {isRefreshing && items.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="Chưa có thông báo nào" subtitle="Hoạt động trong nhóm sẽ xuất hiện ở đây." />
      ) : (
        <div className="space-y-5">
          {sections.map(([title, list]) => (
            <section key={title}>
              <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{title}</p>
              <ul className="space-y-1">
                {list.map((n) => (
                  <NotificationRow key={n.id} n={n} onOpen={(x) => void open(x)} onDelete={(x) => void remove(x.id)} />
                ))}
              </ul>
            </section>
          ))}
          <div ref={sentinelRef} className="flex h-10 items-center justify-center">
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
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {groups.map((g) => {
              const selected = filter.groupIds.includes(g.id);
              return (
                <li key={g.id}>
                  <Checkbox
                    isSelected={selected}
                    onChange={() =>
                      void setFilter({
                        groupIds: selected ? filter.groupIds.filter((id) => id !== g.id) : [...filter.groupIds, g.id],
                      })
                    }
                    className="w-full"
                  >
                    <Checkbox.Content className="flex w-full cursor-pointer items-center gap-3 bg-surface px-3.5 py-3 hover:bg-surface-secondary">
                      <Avatar seed={g.id} label={g.name} photoUrl={g.avatar_url} size={36} palette="color" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">{g.name}</span>
                        <span className="block text-xs text-muted">{g.member_count} thành viên</span>
                      </span>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox>
                </li>
              );
            })}
          </ul>
        )}
      </Sheet>

      <InvitationConfirmDialog invitation={invitation} onClose={() => setInvitation(null)} />
    </>
  );
}
