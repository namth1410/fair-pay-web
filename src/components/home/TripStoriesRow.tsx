import { Plus } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';

import { useHorizontalWheel } from '../../hooks/useHorizontalWheel';
import { useTripStore } from '../../stores/trip.store';
import { Avatar } from '../ui/Avatar';

// Hàng "story" chuyến ghim kiểu app nhắn tin (khớp TripStoriesRow của app): mỗi chuyến 1 vòng
// tròn (viền xanh = đang mở, xám = đã đóng). Ghim tối đa MAX_PINNED_TRIPS nên hàng cuộn ngang;
// ô "Ghim/Sửa ghim" đứng ĐẦU hàng để luôn bấm được, chuyến vừa ghim nằm ngay sau nó.
export function TripStoriesRow({ onPinPress, activeTripId }: { onPinPress: () => void; activeTripId?: string }) {
  const pinned = useTripStore((s) => s.pinnedTrips);
  const rowRef = useRef<HTMLDivElement>(null);

  useHorizontalWheel(rowRef);

  return (
    <div ref={rowRef} className="scrollbar-none flex gap-1.5 overflow-x-auto px-3 pb-1" aria-label="Chuyến đi đã ghim">
      <button
        type="button"
        onClick={onPinPress}
        aria-label={pinned.length === 0 ? 'Ghim chuyến đi' : 'Sửa chuyến đi đã ghim'}
        className="group flex w-[74px] shrink-0 flex-col items-center gap-1.5"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-[color-mix(in_oklab,var(--muted)_70%,transparent)] text-muted transition-colors group-hover:border-accent group-hover:text-accent">
          <Plus className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </span>
        <span className="w-full truncate text-center text-xs font-medium text-muted">
          {pinned.length === 0 ? 'Ghim chuyến' : 'Sửa ghim'}
        </span>
      </button>

      {pinned.map((trip) => {
        const isClosed = trip.status === 'closed';
        const isActive = trip.id === activeTripId;
        return (
          <Link
            key={trip.id}
            to={`/trips/${trip.id}`}
            aria-label={`Chuyến ${trip.name}, nhóm ${trip.group_name}, ${isClosed ? 'đã đóng' : 'đang mở'}`}
            aria-current={isActive ? 'page' : undefined}
            className="group flex w-[74px] shrink-0 flex-col items-center gap-1.5"
          >
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full border-[3px] transition-transform group-hover:scale-[1.04] ${
                isClosed ? 'border-border' : 'border-accent'
              }`}
            >
              <Avatar seed={trip.id} label={trip.name} size={52} />
            </span>
            <span
              className={`w-full truncate text-center text-xs font-semibold ${isActive ? 'text-accent' : 'text-foreground'}`}
            >
              {trip.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
