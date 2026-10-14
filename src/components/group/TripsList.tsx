import { Button, Dropdown, Label } from '@heroui/react';
import { EllipsisVertical, Lock, MapPin, Pin, PinOff, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { MAX_PINNED_TRIPS, TRIP_NAME_MAX_LENGTH } from '../../config/constants';
import type { Trip } from '../../services/trip.service';
import { useTripStore } from '../../stores/trip.store';
import { getErrorMessage } from '../../utils/error';
import { pastelIndex } from '../../utils/seedGradient';
import { showError, showSuccess, showWarning } from '../../utils/toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { TextInputField } from '../ui/Field';
import { EmptyState, ErrorBox } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';
import { RowsSkeleton } from '../ui/Skeleton';

// Hằng rỗng cố định: selector Zustand trả `[]` mới mỗi lần sẽ gây render vô hạn (React #185).
const NO_TRIPS: Trip[] = [];

/**
 * Danh sách chuyến của nhóm như các "luồng" chat (giao diện "Hội thoại", khớp TripsTab của app):
 * ô pastel MapPin + chấm xanh "đang mở", tên đậm, trạng thái + Đóng/Mở lại (quản trị), menu ghim.
 * Cuối danh sách: "Tạo chuyến đi mới" (mọi thành viên đều tạo được).
 */
export function TripsList({
  groupId,
  isAdmin,
  activeTripId,
}: {
  groupId: string;
  isAdmin: boolean;
  /** Chuyến đang mở ở khung chính (desktop) → tô nền. */
  activeTripId?: string;
}) {
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
      showWarning(`Đã ghim tối đa ${MAX_PINNED_TRIPS} chuyến đi`, 'Bỏ ghim 1 chuyến trước khi thêm chuyến mới.');
      return;
    }
    try {
      await togglePin(trip.id);
      showSuccess(isPinned ? 'Đã bỏ ghim' : 'Đã ghim lên trang Nhóm', trip.name);
    } catch (e) {
      showError(e, 'Không thể thực hiện');
    }
  };

  return (
    <div>
      {isLoading && trips.length === 0 ? (
        <RowsSkeleton count={4} leading="tile" size={52} minHeight={74} />
      ) : trips.length === 0 ? (
        <EmptyState icon={MapPin} title="Chưa có chuyến đi nào" subtitle="Tạo chuyến để bắt đầu ghi khoản chi." />
      ) : (
        <ul aria-label="Chuyến đi của nhóm">
          {trips.map((trip) => {
            const isClosed = trip.status !== 'open';
            const isPinned = pinnedIds.has(trip.id);
            const isActive = trip.id === activeTripId;
            return (
              <li
                key={trip.id}
                className={`group relative flex min-h-[74px] items-center transition-colors ${
                  isActive ? 'bg-primary-soft' : 'hover:bg-surface-secondary'
                }`}
              >
                <Link
                  to={`/trips/${trip.id}`}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={`Chuyến ${trip.name}, ${isClosed ? 'đã đóng' : 'đang mở'}${isPinned ? ', đã ghim' : ''}`}
                  className="flex min-w-0 flex-1 items-center gap-3 self-stretch pl-4"
                >
                  <span
                    className={`pastel-${pastelIndex(trip.id)} relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px]`}
                    style={{ background: 'var(--pastel-bg)', color: 'var(--pastel-fg)' }}
                  >
                    <MapPin className="h-[22px] w-[22px]" strokeWidth={2} />
                    {!isClosed ? (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-[2.5px] border-surface bg-money-positive" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col self-stretch justify-center border-b border-border py-3 pr-24">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-base font-bold leading-[22px] text-foreground">{trip.name}</span>
                      {isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 rotate-45 text-muted" strokeWidth={2.2} /> : null}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-[13px] text-muted">
                      {isClosed ? <Lock className="h-3 w-3" strokeWidth={2.4} /> : null}
                      {isClosed ? 'Đã đóng' : 'Đang mở'}
                    </span>
                  </span>
                </Link>

                {/* Hành động nằm ngoài link (không lồng nút trong <a>), canh phải trên hàng. */}
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => setStatusTarget(trip)}
                      aria-label={isClosed ? `Mở lại chuyến ${trip.name}` : `Đóng chuyến ${trip.name}`}
                      className={`rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition-colors hover:bg-surface ${
                        isClosed ? 'text-money-positive' : 'text-money-negative'
                      }`}
                    >
                      {isClosed ? 'Mở lại' : 'Đóng'}
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
                        <Dropdown.Item id="pin" textValue={isPinned ? 'Bỏ ghim' : 'Ghim lên trang Nhóm'}>
                          {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                          <Label>{isPinned ? 'Bỏ ghim' : 'Ghim lên trang Nhóm'}</Label>
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="flex min-h-[64px] w-full items-center gap-3 pl-4 text-left text-accent transition-colors hover:bg-surface-secondary"
      >
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] border-2 border-dashed border-[color-mix(in_oklab,var(--accent)_45%,transparent)]">
          <Plus className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </span>
        <span className="text-[15px] font-bold">Tạo chuyến đi mới</span>
      </button>

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
