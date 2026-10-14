import { Button } from '@heroui/react';
import { ChevronRight, CircleCheck, LockKeyhole, PencilLine, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useNavigate } from 'react-router';

import { TRIP_NAME_MAX_LENGTH } from '../../config/constants';
import type { Trip } from '../../services/trip.service';
import { useTripStore } from '../../stores/trip.store';
import { getErrorMessage } from '../../utils/error';
import { showError, showSuccess } from '../../utils/toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { TextInputField } from '../ui/Field';
import { ErrorBox, InfoBox } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

function ActionCard({
  icon,
  title,
  subtitle,
  onPress,
  disabled,
  danger,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPress}
      className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-surface p-4 text-left shadow-surface transition-colors enabled:hover:border-accent disabled:cursor-default"
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
          danger ? 'bg-[color-mix(in_oklab,var(--danger)_12%,transparent)] text-danger' : 'bg-surface-secondary text-foreground'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-semibold ${danger ? 'text-danger' : 'text-foreground'}`}>{title}</span>
        <span className="block text-xs leading-5 text-muted">{subtitle}</span>
      </span>
      {!disabled ? <ChevronRight className="h-4 w-4 shrink-0 text-muted" /> : null}
    </button>
  );
}

type Dialog = 'close' | 'reopen' | 'reset' | 'delete' | null;

export function ManagementTab({ trip, isAdmin }: { trip: Trip; isAdmin: boolean }) {
  const toggleTripStatus = useTripStore((s) => s.toggleTripStatus);
  const clearTrip = useTripStore((s) => s.clearTrip);
  const deleteTrip = useTripStore((s) => s.deleteTrip);
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const isOpen = trip.status === 'open';

  const run = (fn: () => Promise<void>, success: string) => async () => {
    try {
      await fn();
      showSuccess(success);
    } catch (e) {
      showError(e);
      throw e;
    }
  };

  return (
    <div className="space-y-3">
      {!isAdmin ? (
        <InfoBox className="flex items-start gap-2">
          <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
          Chỉ admin mới quản lý được chuyến đi. Bạn vẫn xem được các thông tin khác.
        </InfoBox>
      ) : null}

      <ActionCard
        icon={<PencilLine className="h-5 w-5" />}
        title="Đổi tên chuyến đi"
        subtitle={`Hiện tại: ${trip.name}`}
        disabled={!isAdmin}
        onPress={() => setRenameOpen(true)}
      />
      {isOpen ? (
        <ActionCard
          icon={<CircleCheck className="h-5 w-5" />}
          title="Hoàn thành chuyến đi"
          subtitle="Đóng chuyến đi, không cho thêm chi phí hay thanh toán"
          disabled={!isAdmin}
          onPress={() => setDialog('close')}
        />
      ) : (
        <ActionCard
          icon={<Undo2 className="h-5 w-5" />}
          title="Mở lại chuyến đi"
          subtitle="Tiếp tục thêm chi phí và thanh toán cho chuyến đi"
          disabled={!isAdmin}
          onPress={() => setDialog('reopen')}
        />
      )}
      <ActionCard
        icon={<RotateCcw className="h-5 w-5" />}
        title="Reset chuyến đi"
        subtitle="Xóa toàn bộ khoản chi và thanh toán, giữ lại thành viên"
        disabled={!isAdmin}
        onPress={() => setDialog('reset')}
      />

      <p className="pt-3 text-[13px] font-bold text-danger">Nguy hiểm</p>
      <ActionCard
        icon={<Trash2 className="h-5 w-5" />}
        title="Xóa chuyến đi"
        subtitle="Ẩn chuyến đi khỏi danh sách nhóm. Không thể hoàn tác từ giao diện."
        disabled={!isAdmin}
        danger
        onPress={() => setDialog('delete')}
      />

      <RenameTripSheet trip={trip} isOpen={renameOpen} onOpenChange={setRenameOpen} />

      <ConfirmDialog
        isOpen={dialog === 'close'}
        onOpenChange={(o) => !o && setDialog(null)}
        tone="success"
        title="Hoàn thành chuyến đi?"
        description="Chuyến đi sẽ được đóng. Bạn có thể mở lại bất cứ lúc nào."
        confirmLabel="Hoàn thành"
        pendingLabel="Đang đóng..."
        onConfirm={run(() => toggleTripStatus(trip), 'Đã hoàn thành chuyến đi')}
      />
      <ConfirmDialog
        isOpen={dialog === 'reopen'}
        onOpenChange={(o) => !o && setDialog(null)}
        tone="accent"
        title="Mở lại chuyến đi?"
        description="Sau khi mở lại, bạn có thể thêm khoản chi và thanh toán mới vào chuyến đi này."
        confirmLabel="Mở lại"
        pendingLabel="Đang mở..."
        onConfirm={run(() => toggleTripStatus(trip), 'Đã mở lại chuyến đi')}
      />
      <ConfirmDialog
        isOpen={dialog === 'reset'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Reset chuyến đi?"
        description={`Toàn bộ khoản chi và thanh toán sẽ bị xóa. Thành viên trong chuyến đi vẫn được giữ nguyên.${
          isOpen ? '' : ' Chuyến đi đang đóng sẽ được mở lại.'
        }`}
        confirmLabel="Reset"
        pendingLabel="Đang reset..."
        onConfirm={run(() => clearTrip(trip), 'Đã reset chuyến đi')}
      />
      <ConfirmDialog
        isOpen={dialog === 'delete'}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Xóa chuyến đi?"
        description="Chuyến đi cùng tất cả khoản chi, thanh toán sẽ bị ẩn khỏi danh sách. Bạn không thể tự khôi phục lại."
        confirmLabel="Xóa"
        pendingLabel="Đang xóa..."
        onConfirm={run(async () => {
          await deleteTrip(trip);
          navigate(`/groups/${trip.group_id}`, { replace: true });
        }, 'Đã xóa chuyến đi')}
      />
    </div>
  );
}

function RenameTripSheet({
  trip,
  isOpen,
  onOpenChange,
}: {
  trip: Trip;
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const renameTrip = useTripStore((s) => s.renameTrip);
  const [name, setName] = useState(trip.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(false);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setName(trip.name);
      setError(null);
    }
  }

  const trimmed = name.trim();
  const submit = async () => {
    if (!trimmed || trimmed === trip.name) return;
    setBusy(true);
    setError(null);
    try {
      await renameTrip(trip, trimmed);
      showSuccess('Đã đổi tên chuyến đi');
      onOpenChange(false);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isLocked={busy}
      title="Đổi tên chuyến đi"
      description="Tên mới sẽ hiển thị ở danh sách nhóm và mọi nơi liên quan đến chuyến đi."
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
          label="Tên chuyến đi"
          value={name}
          onChange={setName}
          maxLength={TRIP_NAME_MAX_LENGTH}
          autoFocus
          labelEnd={<span className="text-xs text-muted">{trimmed.length}/{TRIP_NAME_MAX_LENGTH}</span>}
        />
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" fullWidth isPending={busy} isDisabled={!trimmed || trimmed === trip.name}>
          {busy ? 'Đang lưu...' : 'Lưu tên mới'}
        </Button>
      </form>
    </Sheet>
  );
}
