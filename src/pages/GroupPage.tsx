import { Button } from '@heroui/react';
import { CircleAlert, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { GroupEditSheet, GroupSettingsTab } from '../components/group/GroupSettings';
import { GroupTripsPane } from '../components/group/GroupTripsPane';
import { MembersTab } from '../components/group/MembersTab';
import { TripsList } from '../components/group/TripsList';
import { ChatLayout } from '../components/layout/ChatLayout';
import { PageFrame, PageHeader } from '../components/layout/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, SegmentedTabs } from '../components/ui/Primitives';
import { Bone, RowsSkeleton } from '../components/ui/Skeleton';
import { useIsWide } from '../hooks/useMediaQuery';
import { useGroupStore } from '../stores/group.store';
import { useTripStore } from '../stores/trip.store';
import { showError } from '../utils/toast';

type GroupTab = 'trips' | 'members' | 'settings';

/**
 * Trang nhóm. Desktop: cột trái = các chuyến (luồng) của nhóm, khung chính = thông tin nhóm
 * (thành viên, mã mời, cài đặt). Điện thoại: hero + 3 tab Chuyến đi / Thành viên / Cài đặt như app.
 */
export default function GroupPage() {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as GroupTab | null;
  const wide = useIsWide();

  const currentGroupId = useGroupStore((s) => s.currentGroupId);
  const group = useGroupStore((s) => (s.currentGroupId === groupId ? s.currentGroup : null));
  const loadError = useGroupStore((s) => s.currentGroupError);
  const members = useGroupStore((s) => s.members);
  const myRole = useGroupStore((s) => s.myRole);
  const pendingRequests = useGroupStore((s) => s.pendingRequests);
  const pendingInvitations = useGroupStore((s) => s.pendingInvitations);
  const openGroup = useGroupStore((s) => s.openGroup);
  const loadTrips = useTripStore((s) => s.loadTrips);
  const loadPinnedTrips = useTripStore((s) => s.loadPinnedTrips);
  const pinnedLoaded = useTripStore((s) => s.pinnedLoaded);
  const tripsCount = useTripStore((s) => (s.currentTripsGroupId === groupId ? s.trips.length : 0));
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    void openGroup(groupId).catch((e) => showError(e, 'Không tải được nhóm'));
    void loadTrips(groupId).catch((e) => showError(e, 'Không tải được chuyến đi'));
    if (!pinnedLoaded) void loadPinnedTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const isAdmin = myRole === 'admin';
  // Desktop: chuyến đi đã nằm ở cột trái → khung chính chỉ còn Thành viên / Cài đặt.
  const defaultTab: GroupTab = wide ? 'members' : 'trips';
  const tab: GroupTab =
    tabParam === 'members' || (tabParam === 'trips' && !wide) || (tabParam === 'settings' && isAdmin)
      ? tabParam
      : defaultTab;
  const setTab = (t: GroupTab) => setSearchParams(t === defaultTab ? {} : { tab: t }, { replace: true });
  const badge = isAdmin ? pendingRequests.length + pendingInvitations.length : 0;

  if (loadError && currentGroupId === groupId) {
    return (
      <PageFrame header={<PageHeader title="Nhóm" back="/" />}>
        <EmptyState
          icon={CircleAlert}
          title="Không mở được nhóm"
          subtitle="Nhóm có thể đã bị xóa hoặc bạn không còn là thành viên."
          action={<Button onPress={() => navigate('/', { replace: true })}>Về trang Nhóm</Button>}
        />
      </PageFrame>
    );
  }

  const tabs = [
    ...(wide ? [] : [{ id: 'trips' as const, label: `Chuyến đi (${tripsCount})` }]),
    { id: 'members' as const, label: `Thành viên (${members.length})`, badge },
    ...(isAdmin ? [{ id: 'settings' as const, label: 'Cài đặt' }] : []),
  ];

  const overview = (
    <PageFrame
      header={wide ? undefined : <PageHeader title={group?.name ?? 'Nhóm'} back="/" />}
      width="full"
      bodyClassName=""
    >
      {group ? (
        <>
          <section className="flex flex-col items-center gap-2 px-4 pb-3 pt-5 text-center">
            <div className="relative">
              <Avatar seed={group.id} label={group.name} photoUrl={group.avatar_url} size={84} />
              {isAdmin ? (
                <button
                  type="button"
                  aria-label="Sửa thông tin nhóm"
                  onClick={() => setEditOpen(true)}
                  className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-accent text-accent-foreground transition-transform hover:scale-105"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              ) : null}
            </div>
            <div className="max-w-full">
              <h2 className="truncate text-xl font-extrabold tracking-[-0.01em] text-foreground">{group.name}</h2>
              <p className="text-[13px] text-muted">
                {members.length} thành viên · {tripsCount} chuyến đi{isAdmin ? ' · bạn là quản trị' : ''}
              </p>
            </div>
          </section>

          <div className="mx-auto w-full max-w-3xl">
            <SegmentedTabs ariaLabel="Mục của nhóm" className="px-4 py-2.5" value={tab} onChange={setTab} tabs={tabs} />
          </div>

          <div className="fade-up mx-auto w-full max-w-3xl" key={tab}>
            {tab === 'trips' ? <TripsList groupId={group.id} isAdmin={isAdmin} /> : null}
            {tab === 'members' ? <MembersTab group={group} isAdmin={isAdmin} /> : null}
            {tab === 'settings' && isAdmin ? (
              <div className="px-4 pt-2">
                <GroupSettingsTab group={group} />
              </div>
            ) : null}
          </div>

          {isAdmin ? <GroupEditSheet group={group} isOpen={editOpen} onOpenChange={setEditOpen} /> : null}
        </>
      ) : (
        <GroupOverviewSkeleton />
      )}
    </PageFrame>
  );

  if (!wide) return overview;
  return <ChatLayout list={<GroupTripsPane groupId={groupId} />} main={overview} />;
}

/** Skeleton thông tin nhóm: avatar lớn + tên + dòng phụ, thanh tab, danh sách (khớp app). */
function GroupOverviewSkeleton() {
  return (
    <div role="progressbar" aria-label="Đang tải nhóm" aria-busy="true">
      <div className="flex flex-col items-center gap-3 px-4 pb-3 pt-5">
        <Bone w={84} h={84} r={42} />
        <Bone w={160} h={22} r={8} />
        <Bone w={210} h={12} />
      </div>
      <div className="flex gap-1 px-4 py-2.5">
        <Bone w={118} h={36} r={18} />
        <Bone w={134} h={36} r={18} />
        <Bone w={76} h={36} r={18} />
      </div>
      <RowsSkeleton count={4} leading="tile" size={52} minHeight={74} />
    </div>
  );
}
