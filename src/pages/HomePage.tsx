import { Button, Skeleton } from '@heroui/react';
import { LayoutGrid, List, Mail, Plus, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { InvitationConfirmDialog } from '../components/group/InvitationConfirmDialog';
import { GroupRow, GroupTile } from '../components/home/GroupCards';
import { HeroDebt } from '../components/home/HeroDebt';
import { PinnedTripsSection } from '../components/home/PinnedTrips';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, SectionLabel } from '../components/ui/Primitives';
import { MIN_GROUPS_FOR_CAROUSEL } from '../config/constants';
import type { MyPendingInvitation } from '../services/group.service';
import { useAuthStore } from '../stores/auth.store';
import { useGroupStore } from '../stores/group.store';
import { useNotificationStore } from '../stores/notification.store';
import { useTripStore } from '../stores/trip.store';
import { useUIStore } from '../stores/ui.store';
import { getHomeViewMode, type HomeViewMode, setHomeViewMode } from '../utils/preferences';
import { showError } from '../utils/toast';

// Ribbon "đang chờ duyệt" đã đóng — chỉ trong phiên (sống qua đổi trang, mất khi reload).
const dismissedRibbons = new Set<string>();

function greeting(): string {
  const h = Number(
    new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()),
  );
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export default function HomePage() {
  const profile = useAuthStore((s) => s.profile);
  const groups = useGroupStore((s) => s.groups);
  const groupsLoaded = useGroupStore((s) => s.groupsLoaded);
  const isLoading = useGroupStore((s) => s.isLoadingGroups);
  const balanceSummary = useGroupStore((s) => s.balanceSummary);
  const pendingRequests = useGroupStore((s) => s.myPendingJoinRequests);
  const invitations = useGroupStore((s) => s.myPendingInvitations);
  const loadGroups = useGroupStore((s) => s.loadGroups);
  const loadPinnedTrips = useTripStore((s) => s.loadPinnedTrips);
  const refreshUnreadCount = useNotificationStore((s) => s.refreshUnreadCount);
  const openCreateJoin = useUIStore((s) => s.openCreateJoin);

  const [viewMode, setViewMode] = useState<HomeViewMode>(() => getHomeViewMode());
  const [, forceRender] = useState(0);
  const [activeInvitation, setActiveInvitation] = useState<MyPendingInvitation | null>(null);

  useEffect(() => {
    void loadGroups({ quiet: groupsLoaded }).catch((e) => showError(e, 'Không tải được nhóm'));
    void loadPinnedTrips();
    void refreshUnreadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canToggle = groups.length >= MIN_GROUPS_FOR_CAROUSEL;
  const effectiveMode: HomeViewMode = canToggle ? viewMode : 'list';
  const ribbons = pendingRequests.filter((r) => !dismissedRibbons.has(r.request_id));
  const displayName = profile?.display_name?.trim();

  return (
    <div className="space-y-7 pt-6 lg:pt-10">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{greeting()}{displayName ? ',' : ''}</p>
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{displayName || 'Fair Pay'}</h1>
        </div>
        {profile ? (
          <Avatar
            seed={profile.display_name || profile.email}
            label={profile.display_name}
            photoUrl={profile.photo_url}
            size={44}
            className="lg:hidden"
          />
        ) : null}
      </header>

      {groups.length > 0 || !groupsLoaded ? <HeroDebt total={balanceSummary.total} loading={!groupsLoaded} /> : null}

      {ribbons.length > 0 ? (
        <div className="space-y-2">
          {ribbons.map((r) => (
            <div
              key={r.request_id}
              className="flex items-center gap-3 rounded-2xl border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning)_10%,var(--surface))] px-4 py-3"
            >
              <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-warning" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]">
                  Đang chờ duyệt
                </p>
                <p className="truncate text-sm text-foreground">Yêu cầu vào “{r.group_name}” đã được gửi</p>
              </div>
              <button
                type="button"
                aria-label="Đóng thông báo"
                onClick={() => {
                  dismissedRibbons.add(r.request_id);
                  forceRender((n) => n + 1);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-secondary hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {invitations.length > 0 ? (
        <section className="space-y-2">
          {invitations.map((inv) => (
            <button
              key={inv.invitation_id}
              type="button"
              onClick={() => setActiveInvitation(inv)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-surface px-4 py-3 text-left shadow-surface transition-colors hover:border-foreground/20"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-secondary">
                <Mail className="h-5 w-5 text-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                  Lời mời vào nhóm “{inv.group_name}”
                </span>
                <span className="block truncate text-xs text-muted">do {inv.inviter_name || 'quản trị viên'} mời · bấm để trả lời</span>
              </span>
            </button>
          ))}
        </section>
      ) : null}

      {groups.length > 0 ? <PinnedTripsSection /> : null}

      <section className="space-y-3">
        <SectionLabel
          count={groupsLoaded ? groups.length : undefined}
          right={
            <div className="flex items-center gap-1">
              {canToggle ? (
                <div className="flex rounded-full bg-surface-secondary p-0.5" role="radiogroup" aria-label="Kiểu hiển thị">
                  {(
                    [
                      { id: 'grid', icon: LayoutGrid, label: 'Lưới' },
                      { id: 'list', icon: List, label: 'Danh sách' },
                    ] as const
                  ).map(({ id, icon: Icon, label }) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={viewMode === id}
                      aria-label={label}
                      title={label}
                      onClick={() => {
                        setViewMode(id);
                        setHomeViewMode(id);
                      }}
                      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                        viewMode === id ? 'bg-surface text-foreground shadow-surface' : 'text-muted'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                aria-label="Thêm nhóm mới"
                title="Tạo nhóm hoặc nhập mã mời"
                onClick={() => openCreateJoin('create')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background transition-transform active:scale-95"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          }
        >
          Nhóm của bạn
        </SectionLabel>

        {isLoading && groups.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[74px] rounded-2xl" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa có nhóm nào"
            subtitle="Tạo nhóm mới hoặc nhập mã mời để bắt đầu"
            action={
              <div className="flex gap-2">
                <Button onPress={() => openCreateJoin('create')}>Tạo nhóm</Button>
                <Button variant="secondary" onPress={() => openCreateJoin('join')}>
                  Nhập mã mời
                </Button>
              </div>
            }
          />
        ) : effectiveMode === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {groups.map((g) => (
              <GroupTile key={g.id} group={g} balance={balanceSummary.groupBalances[g.id] ?? 0} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((g) => (
              <GroupRow key={g.id} group={g} balance={balanceSummary.groupBalances[g.id] ?? 0} />
            ))}
          </div>
        )}
      </section>

      <InvitationConfirmDialog invitation={activeInvitation} onClose={() => setActiveInvitation(null)} />
    </div>
  );
}
