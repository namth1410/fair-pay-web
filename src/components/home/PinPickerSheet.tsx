import { Spinner } from '@heroui/react';
import { Check, Pin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { MAX_PINNED_TRIPS } from '../../config/constants';
import type { TripWithGroup } from '../../services/trip.service';
import { useTripStore } from '../../stores/trip.store';
import { showError, showWarning } from '../../utils/toast';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

/** Chọn chuyến để ghim / bỏ ghim — nhóm theo tên nhóm. */
export function PinPickerSheet({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (o: boolean) => void }) {
  const allTrips = useTripStore((s) => s.allUserTrips);
  const loading = useTripStore((s) => s.isLoadingAllUserTrips);
  const loadAll = useTripStore((s) => s.loadAllUserTrips);
  const pinnedIds = useTripStore((s) => s.pinnedTripIds);
  const togglePin = useTripStore((s) => s.togglePin);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) void loadAll().catch((e) => showError(e));
  }, [isOpen, loadAll]);

  const sections = useMemo(() => {
    const map = new Map<string, TripWithGroup[]>();
    for (const t of allTrips ?? []) {
      const arr = map.get(t.group_name) ?? [];
      arr.push(t);
      map.set(t.group_name, arr);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi'));
  }, [allTrips]);

  const atMax = pinnedIds.size >= MAX_PINNED_TRIPS;

  const onToggle = async (trip: TripWithGroup) => {
    const isPinned = pinnedIds.has(trip.id);
    if (!isPinned && atMax) {
      showWarning(`Đã ghim tối đa ${MAX_PINNED_TRIPS} chuyến đi`, 'Bỏ ghim 1 chuyến trước khi thêm chuyến mới.');
      return;
    }
    setBusyId(trip.id);
    try {
      await togglePin(trip.id);
    } catch (e) {
      showError(e, 'Không thể thực hiện');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Ghim chuyến đi"
      description={`Đã ghim ${pinnedIds.size}/${MAX_PINNED_TRIPS} chuyến · chuyến mới ghim đứng đầu hàng`}
    >
      {loading && !allTrips ? (
        <div className="flex justify-center py-10">
          <Spinner color="current" className="text-muted" />
        </div>
      ) : sections.length === 0 ? (
        <EmptyState icon={Pin} title="Bạn chưa có chuyến đi nào" />
      ) : (
        <div className="-mx-2 space-y-4">
          {sections.map(([groupName, trips]) => (
            <section key={groupName}>
              <p className="mb-1 px-2 text-[13px] font-bold text-muted">{groupName}</p>
              <ul>
                {trips.map((t) => {
                  const isPinned = pinnedIds.has(t.id);
                  const disabled = !isPinned && atMax;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isPinned}
                        aria-disabled={disabled || undefined}
                        disabled={busyId !== null}
                        onClick={() => void onToggle(t)}
                        className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-secondary ${
                          disabled ? 'opacity-50' : ''
                        }`}
                      >
                        <Avatar seed={t.id} label={t.name} size={40} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold text-foreground">{t.name}</span>
                          {t.status === 'closed' ? <span className="block text-xs text-muted">Đã đóng</span> : null}
                        </span>
                        {busyId === t.id ? (
                          <Spinner size="sm" color="current" className="text-muted" />
                        ) : (
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                              isPinned ? 'border-accent bg-accent text-accent-foreground' : 'border-[color-mix(in_oklab,var(--muted)_60%,transparent)]'
                            }`}
                          >
                            {isPinned ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Sheet>
  );
}
