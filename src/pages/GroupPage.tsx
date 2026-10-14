import { Button } from '@heroui/react';
import { CircleAlert, Pencil, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { GroupEditSheet, GroupSettingsTab } from '../components/group/GroupSettings';
import { MembersTab } from '../components/group/MembersTab';
import { TripsTab } from '../components/group/TripsTab';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { PageSpinner } from '../components/ui/PageSpinner';
import { EmptyState, SegmentedTabs } from '../components/ui/Primitives';
import { useGroupStore } from '../stores/group.store';
import { useTripStore } from '../stores/trip.store';
import { showError } from '../utils/toast';

type GroupTab = 'trips' | 'members' | 'settings';

export default function GroupPage() {
  const { groupId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as GroupTab | null;

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
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    void openGroup(groupId).catch((e) => showError(e, 'Không tải được nhóm'));
    void loadTrips(groupId).catch((e) => showError(e, 'Không tải được chuyến đi'));
    if (!pinnedLoaded) void loadPinnedTrips();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const isAdmin = myRole === 'admin';
  const tab: GroupTab = tabParam === 'members' || (tabParam === 'settings' && isAdmin) ? tabParam : 'trips';
  const setTab = (t: GroupTab) => setSearchParams(t === 'trips' ? {} : { tab: t }, { replace: true });
  const badge = isAdmin ? pendingRequests.length + pendingInvitations.length : 0;
  const tripsCount = useTripStore((s) => (s.currentTripsGroupId === groupId ? s.trips.length : 0));

  if (loadError && currentGroupId === groupId) {
    return (
      <>
        <PageHeader title="Nhóm" back />
        <EmptyState
          icon={CircleAlert}
          title="Không mở được nhóm"
          subtitle="Nhóm có thể đã bị xóa hoặc bạn không còn là thành viên."
          action={<Button onPress={() => navigate('/', { replace: true })}>Về trang chủ</Button>}
        />
      </>
    );
  }

  if (!group) {
    return (
      <>
        <PageHeader title="Nhóm" back />
        <PageSpinner />
      </>
    );
  }

  return (
    <>
      <PageHeader title={group.name} back="/" />

      <section className="mb-6 flex flex-col items-center text-center">
        <div className="relative">
          <Avatar seed={group.id} label={group.name} photoUrl={group.avatar_url} size={96} palette="color" />
          {isAdmin ? (
            <button
              type="button"
              aria-label="Sửa thông tin nhóm"
              onClick={() => setEditOpen(true)}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-foreground text-background transition-transform hover:scale-105"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <h2 className="mt-3 max-w-full truncate text-xl font-bold tracking-tight text-foreground">{group.name}</h2>
        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
          <Users className="h-4 w-4" /> {members.length} thành viên
          {isAdmin ? ' · Bạn là quản trị viên' : ''}
        </p>
      </section>

      <SegmentedTabs
        ariaLabel="Mục của nhóm"
        stretch
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'trips', label: `Chuyến đi (${tripsCount})` },
          { id: 'members', label: `Thành viên (${members.length})`, badge },
          ...(isAdmin ? [{ id: 'settings' as const, label: 'Cài đặt' }] : []),
        ]}
      />

      <div className="fade-up" key={tab}>
        {tab === 'trips' ? <TripsTab groupId={group.id} isAdmin={isAdmin} /> : null}
        {tab === 'members' ? <MembersTab group={group} isAdmin={isAdmin} /> : null}
        {tab === 'settings' && isAdmin ? <GroupSettingsTab group={group} /> : null}
      </div>

      {isAdmin ? <GroupEditSheet group={group} isOpen={editOpen} onOpenChange={setEditOpen} /> : null}
    </>
  );
}
