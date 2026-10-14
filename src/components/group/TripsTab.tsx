import { Button, Dropdown, Label, Skeleton } from '@heroui/react';
import { EllipsisVertical, MapPin, Pin, PinOff, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { MAX_PINNED_TRIPS, TRIP_NAME_MAX_LENGTH } from '../../config/constants';
import type { Trip } from '../../services/trip.service';
import { useTripStore } from '../../stores/trip.store';
import { getErrorMessage } from '../../utils/error';
import { showError, showSuccess, showWarning } from '../../utils/toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { TextInputField } from '../ui/Field';
import { EmptyState, ErrorBox } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

// Hằng rỗng cố định: selector Zustand trả `[]` mới mỗi lần sẽ gây render vô hạn (React #185).
const NO_TRIPS: Trip[] = [];

export function TripsTab({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
  const trips = useTripStore((s) => (s.currentTripsGroupId === groupId ? s.trips : NO_TRIPS));
  const isLoading = useTripStore((s) => s.isLoadingTrips);
  const pinnedIds = useTripStore((s) => s.pinnedTripIds);
  const togglePin = useTripStore((s) => s.togglePin);
  const toggleTripStatus = useTripStore((s) => s.toggleTripStatus);

  const [createOpen, setCreateOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Trip | null>(null);

  const onTogglePin = async (trip: Trip) => {
    const isPinned = pinnedIds.has(trip.id);
    if (!isPinned && pinnedIds.size >= MAX_PINNED_TRIPS) {
      showWarning('Đã ghim tối đa 2 chuyến đi', 'Bỏ ghim 1 chuyến trước khi thêm chuyến mới.');
      return;
    }
    try {
      await togglePin(trip.id);
      showSuccess(isPinned ? 'Đã bỏ ghim' : 'Đã ghim chuyến đi', trip.name);
    } catch (e) {
      showError(e, 'Không thể thực hiện');
    }
  };

  return (
    <div className="space-y-3">
      <Button fullWidth variant="secondary" onPress={() => setCreateOpen(true)}>
        <Plus className="h-4 w-4" /> Tạo chuyến
      </Button>

      {isLoading && trips.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[68px] rounded-2xl" />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState icon={MapPin} title="Chưa có chuyến đi nào" subtitle="Tạo chuyến để bắt đầu ghi khoản chi." />
      ) : (
        <ul className="space-y-2">
          {trips.map((trip) => {
            const isOpen = trip.status === 'open';
            const isPinned = pinnedIds.has(trip.id);
            return (
              <li
                key={trip.id}
                className="flex items-center gap-2 rounded-2xl border border-border/70 bg-surface p-2 pl-3 shadow-surface"
              >
                <Link to={`/trips/${trip.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-1">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      isOpen ? 'bg-[color-mix(in_oklab,var(--money-positive)_14%,transparent)] text-money-positive' : 'bg-surface-secondary text-muted'
                    }`}
                  >
                    <MapPin className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-foreground">{trip.name}</span>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      {isPinned ? <Pin className="h-3 w-3 rotate-45" /> : null}
                      {isOpen ? 'Đang mở' : 'Đã đóng'}
                    </span>
                  </span>
                </Link>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setStatusTarget(trip)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      isOpen ? 'text-money-negative hover:bg-[color-mix(in_oklab,var(--money-negative)_10%,transparent)]' : 'text-money-positive hover:bg-[color-mix(in_oklab,var(--money-positive)_10%,transparent)]'
                    }`}
                  >
                    {isOpen ? 'Đóng' : 'Mở lại'}
                  </button>
                ) : null}
                <Dropdown>
                  <Button isIconOnly variant="ghost" size="sm" aria-label={`Tùy chọn cho ${trip.name}`}>
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                  <Dropdown.Popover placement="bottom end">
                    <Dropdown.Menu
                      onAction={(key) => {
                        if (key === 'pin') void onTogglePin(trip);
                      }}
                    >
                      <Dropdown.Item id="pin" textValue={isPinned ? 'Bỏ ghim' : 'Ghim lên trang chủ'}>
                        {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                        <Label>{isPinned ? 'Bỏ ghim' : 'Ghim lên trang chủ'}</Label>
                      </Dropdown.Item>
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              </li>
            );
          })}
        </ul>
      )}

      <CreateTripSheet groupId={groupId} isOpen={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        isOpen={statusTarget !== null}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        tone={statusTarget?.status === 'open' ? 'danger' : 'success'}
        title={statusTarget?.status === 'open' ? 'Đóng chuyến đi?' : 'Mở lại chuyến đi?'}
        description={
          statusTarget?.status === 'open'
            ? `Đóng chuyến "${statusTarget?.name}"? Bạn vẫn có thể mở lại sau.`
            : `Mở lại chuyến "${statusTarget?.name}" để tiếp tục ghi chi phí.`
        }
        confirmLabel={statusTarget?.status === 'open' ? 'Đóng chuyến' : 'Mở lại'}
        pendingLabel="Đang xử lý..."
        onConfirm={async () => {
          if (!statusTarget) return;
          try {
            await toggleTripStatus(statusTarget);
            showSuccess(statusTarget.status === 'open' ? 'Đã đóng chuyến' : 'Đã mở lại chuyến', statusTarget.name);
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
    </div>
  );
}

export function CreateTripSheet({
  groupId,
  isOpen,
  onOpenChange,
  onCreated,
}: {
  groupId: string;
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (trip: Trip) => void;
}) {
  const addTrip = useTripStore((s) => s.addTrip);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const trip = await addTrip(groupId, trimmed);
      showSuccess('Đã tạo chuyến đi', trimmed);
      setName('');
      onOpenChange(false);
      onCreated?.(trip);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(o) => {
        if (!o) {
          setName('');
          setError(null);
        }
        onOpenChange(o);
      }}
      isLocked={busy}
      title="Tạo chuyến đi mới"
      description="Đặt tên gợi nhớ để dễ tìm trong danh sách (VD: địa điểm + thời gian)."
      size="sm"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <TextInputField
          label="Tên chuyến"
          value={name}
          onChange={setName}
          placeholder="VD: Đà Lạt 10/2026"
          maxLength={TRIP_NAME_MAX_LENGTH}
          autoFocus
          labelEnd={<span className="text-xs text-muted">{name.trim().length}/{TRIP_NAME_MAX_LENGTH}</span>}
        />
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" fullWidth isPending={busy} isDisabled={!name.trim()}>
          {busy ? 'Đang tạo...' : 'Tạo chuyến'}
        </Button>
      </form>
    </Sheet>
  );
}
