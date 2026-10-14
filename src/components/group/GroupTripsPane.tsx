import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router';

import { useGroupStore } from '../../stores/group.store';
import { useTripStore } from '../../stores/trip.store';
import { Avatar } from '../ui/Avatar';
import { Bone } from '../ui/Skeleton';
import { TripsList } from './TripsList';

/**
 * Cột danh sách trên desktop khi đang ở trong 1 nhóm (kiểu "topic" của Telegram): nút về danh
 * sách nhóm + tên nhóm (bấm → thông tin nhóm) + các chuyến như luồng chat.
 */
export function GroupTripsPane({ groupId, activeTripId }: { groupId: string; activeTripId?: string }) {
  const group = useGroupStore((s) => (s.currentGroupId === groupId ? s.currentGroup : null));
  const memberCount = useGroupStore((s) => (s.currentGroupId === groupId ? s.members.length : 0));
  const isAdmin = useGroupStore((s) => s.currentGroupId === groupId && s.myRole === 'admin');
  const tripsCount = useTripStore((s) => (s.currentTripsGroupId === groupId ? s.trips.length : 0));
  const onOverview = !activeTripId;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-[66px] shrink-0 items-center gap-1 border-b border-border px-2">
        <Link
          to="/"
          aria-label="Về danh sách nhóm"
          title="Về danh sách nhóm"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-secondary"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        {group ? (
          <Link
            to={`/groups/${groupId}`}
            aria-label={`Thông tin nhóm ${group.name}`}
            aria-current={onOverview ? 'page' : undefined}
            className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1 transition-colors ${
              onOverview ? 'bg-primary-soft' : 'hover:bg-surface-secondary'
            }`}
          >
            <Avatar seed={group.id} label={group.name} photoUrl={group.avatar_url} size={40} />
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-bold leading-tight text-foreground">{group.name}</span>
              <span className="block truncate text-xs text-muted">
                {memberCount} thành viên · {tripsCount} chuyến đi
              </span>
            </span>
          </Link>
        ) : (
          <div className="flex flex-1 items-center gap-2.5 px-1.5">
            <Bone w={40} h={40} r={20} />
            <div className="flex-1 space-y-2">
              <Bone w="60%" h={13} />
              <Bone w="40%" h={10} />
            </div>
          </div>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <TripsList groupId={groupId} isAdmin={isAdmin} activeTripId={activeTripId} />
      </div>
    </div>
  );
}
