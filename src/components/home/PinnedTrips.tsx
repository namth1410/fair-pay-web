import { Button, Checkbox, Spinner } from '@heroui/react';
import { ArrowRightLeft, MapPin, Pin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';

import { MAX_PINNED_TRIPS } from '../../config/constants';
import type { TripWithGroup } from '../../services/trip.service';
import { useTripStore } from '../../stores/trip.store';
import { showError, showValidationError, showWarning } from '../../utils/toast';
import { EmptyState, SectionLabel } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

function PinnedTripCard({ trip }: { trip: TripWithGroup }) {
  const open = trip.status === 'open';
  return (
    <Link
      to={`/trips/${trip.id}`}
      className="group flex min-w-0 flex-1 flex-col gap-2 rounded-2xl border border-border/70 bg-surface p-4 shadow-surface transition-colors hover:border-foreground/20"
    >
      <div className="flex items-center justify-between">
        <Pin className="h-4 w-4 rotate-45 text-muted" />
        <span
          className={`h-2 w-2 rounded-full ${open ? 'bg-money-positive' : 'bg-muted/50'}`}
          title={open ? 'Đang mở' : 'Đã đóng'}
        />
      </div>
      <p className="truncate text-[15px] font-semibold text-foreground">{trip.name}</p>
      <p className="flex min-w-0 items-center gap-1 text-xs text-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{trip.group_name}</span>
      </p>
    </Link>
  );
}

/** "GHIM NHANH" — tối đa 2 chuyến (per-user, đồng bộ với app). */
export function PinnedTripsSection() {
  const pinned = useTripStore((s) => s.pinnedTrips);
  const loaded = useTripStore((s) => s.pinnedLoaded);
  const swapPinned = useTripStore((s) => s.swapPinned);
  const [pickerOpen, setPickerOpen] = useState(false);

  const onSwap = async () => {
    try {
      await swapPinned();
    } catch (e) {
      showValidationError('Không hoán đổi được', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="space-y-3">
      <SectionLabel
        right={
          pinned.length > 0 ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="text-xs font-semibold text-muted hover:text-foreground"
              aria-label="Quản lý chuyến đi đã ghim"
            >
              Quản lý
            </button>
          ) : null
        }
      >
        Ghim nhanh
      </SectionLabel>

      {!loaded ? (
        <div className="h-[104px] animate-pulse rounded-2xl bg-surface-secondary" />
      ) : pinned.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-5 text-center">
          <p className="text-sm font-semibold text-foreground">Chưa ghim chuyến đi nào</p>
          <p className="text-xs text-muted">Truy cập nhanh từ trang chủ</p>
          <Button size="sm" variant="secondary" className="mt-1" onPress={() => setPickerOpen(true)}>
            <Pin className="h-3.5 w-3.5" /> Chọn chuyến để ghim
          </Button>
        </div>
      ) : (
        <div className="flex items-stretch gap-3">
          <PinnedTripCard trip={pinned[0]} />
          {pinned.length > 1 ? (
            <>
              <button
                type="button"
                onClick={() => void onSwap()}
                className="flex w-8 shrink-0 items-center justify-center self-center rounded-full text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
                aria-label="Đổi chỗ 2 chuyến đã ghim"
                title="Đổi chỗ"
              >
                <ArrowRightLeft className="h-4 w-4" />
              </button>
              <PinnedTripCard trip={pinned[1]} />
            </>
          ) : null}
        </div>
      )}

      <PinPickerSheet isOpen={pickerOpen} onOpenChange={setPickerOpen} />
    </section>
  );
}

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
      showWarning('Đã ghim tối đa 2 chuyến đi', 'Bỏ ghim 1 chuyến trước khi thêm chuyến mới.');
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
      description={`Đã ghim ${pinnedIds.size}/${MAX_PINNED_TRIPS} chuyến`}
    >
      {loading && !allTrips ? (
        <div className="flex justify-center py-10">
          <Spinner color="current" className="text-muted" />
        </div>
      ) : sections.length === 0 ? (
        <EmptyState icon={Pin} title="Bạn chưa có chuyến đi nào" />
      ) : (
        <div className="space-y-4">
          {sections.map(([groupName, trips]) => (
            <div key={groupName}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">{groupName}</p>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {trips.map((t) => {
                  const isPinned = pinnedIds.has(t.id);
                  const disabled = !isPinned && atMax;
                  return (
                    <li key={t.id} className={disabled ? 'opacity-50' : ''}>
                      <Checkbox
                        isSelected={isPinned}
                        isDisabled={busyId !== null}
                        onChange={() => void onToggle(t)}
                        className="w-full"
                      >
                        <Checkbox.Content className="flex w-full cursor-pointer items-center gap-3 bg-surface px-3.5 py-3 hover:bg-surface-secondary">
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{t.name}</span>
                          {t.status === 'closed' ? <span className="text-xs text-muted">Đã đóng</span> : null}
                          {busyId === t.id ? <Spinner size="sm" color="current" className="text-muted" /> : null}
                        </Checkbox.Content>
                      </Checkbox>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
