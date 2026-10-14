import { Button } from '@heroui/react';
import { Camera, ChevronRight, ImageMinus, Images, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { GROUP_NAME_MAX_LENGTH } from '../../config/constants';
import type { Group } from '../../services/group.service';
import type { Trip } from '../../services/trip.service';
import { useGroupStore } from '../../stores/group.store';
import { useTripStore } from '../../stores/trip.store';
import { getErrorMessage } from '../../utils/error';
import { formatBytes, type ProcessedImage, processImageFile } from '../../utils/imageProcessing';
import { showError, showSuccess } from '../../utils/toast';
import { Avatar } from '../ui/Avatar';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { TextInputField } from '../ui/Field';
import { ErrorBox, Panel } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

// Hằng rỗng cố định: selector Zustand trả `[]` mới mỗi lần sẽ gây render vô hạn (React #185).
const NO_TRIPS: Trip[] = [];

/** Tab "Cài đặt" của nhóm (admin). */
export function GroupSettingsTab({ group }: { group: Group }) {
  const members = useGroupStore((s) => s.members);
  const trips = useTripStore((s) => (s.currentTripsGroupId === group.id ? s.trips : NO_TRIPS));
  const removeGroup = useGroupStore((s) => s.removeGroup);
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const stats = [
    { label: 'Tổng thành viên', value: members.length },
    { label: 'Thành viên ảo', value: members.filter((m) => m.is_virtual).length },
    { label: 'Tổng chuyến đi', value: trips.length },
  ];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setEditOpen(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-surface p-4 text-left shadow-surface transition-colors hover:border-foreground/20"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
          <Pencil className="h-5 w-5 text-foreground" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Sửa thông tin nhóm</span>
          <span className="block text-xs text-muted">Đổi tên và ảnh đại diện</span>
        </span>
        <ChevronRight className="h-4 w-4 text-muted" />
      </button>

      <Panel className="grid grid-cols-3 divide-x divide-border">
        {stats.map((s) => (
          <div key={s.label} className="px-3 py-4 text-center">
            <p className="tabular text-2xl font-bold text-foreground">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </Panel>

      <Button fullWidth variant="danger-soft" onPress={() => setDeleteOpen(true)}>
        <Trash2 className="h-4 w-4" /> Xóa nhóm
      </Button>

      <GroupEditSheet group={group} isOpen={editOpen} onOpenChange={setEditOpen} />
      <ConfirmDialog
        isOpen={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Xóa nhóm"
        description={`Bạn có chắc muốn xóa nhóm "${group.name}"?`}
        confirmLabel="Xóa"
        pendingLabel="Đang xóa..."
        onConfirm={async () => {
          try {
            await removeGroup(group.id);
            showSuccess('Đã xóa nhóm', group.name);
            navigate('/', { replace: true });
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
    </div>
  );
}

type AvatarDraft = { kind: 'keep' } | { kind: 'new'; image: ProcessedImage } | { kind: 'remove' };

/** Sửa tên + ảnh nhóm (admin). Ảnh: cắt vuông, ≤ 2MB, upload R2 qua edge function. */
export function GroupEditSheet({
  group,
  isOpen,
  onOpenChange,
}: {
  group: Group;
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const renameGroup = useGroupStore((s) => s.renameGroup);
  const saveAvatar = useGroupStore((s) => s.saveAvatar);
  const removeAvatar = useGroupStore((s) => s.removeAvatar);

  const [name, setName] = useState(group.name);
  const [draft, setDraft] = useState<AvatarDraft>({ kind: 'keep' });
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setName(group.name);
    setDraft({ kind: 'keep' });
    setNameError(null);
    setPhotoError(null);
  }, [isOpen, group.name]);

  // Dọn object URL xem trước.
  useEffect(() => {
    return () => {
      if (draft.kind === 'new') URL.revokeObjectURL(draft.image.previewUrl);
    };
  }, [draft]);

  const nameChanged = name.trim() !== group.name;
  const photoChanged = draft.kind !== 'keep';
  const dirty = nameChanged || photoChanged;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setProcessing(true);
    setPhotoError(null);
    try {
      setDraft({ kind: 'new', image: await processImageFile(file) });
    } catch (e) {
      setPhotoError(getErrorMessage(e));
    } finally {
      setProcessing(false);
      if (libraryRef.current) libraryRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };

  const save = async () => {
    setSaving(true);
    setNameError(null);
    setPhotoError(null);
    const tasks: Promise<'name' | 'photo'>[] = [];
    if (nameChanged) tasks.push(renameGroup(name).then(() => 'name' as const));
    if (draft.kind === 'new') tasks.push(saveAvatar({ blob: draft.image.blob, sizeBytes: draft.image.sizeBytes }).then(() => 'photo' as const));
    if (draft.kind === 'remove') tasks.push(removeAvatar().then(() => 'photo' as const));

    const results = await Promise.allSettled(tasks);
    setSaving(false);
    const failedName = nameChanged && results.some((r, i) => r.status === 'rejected' && i === 0);
    const photoIndex = nameChanged ? 1 : 0;
    const failedPhoto = photoChanged && results[photoIndex]?.status === 'rejected';

    if (!failedName && !failedPhoto) {
      showSuccess('Đã lưu thay đổi');
      onOpenChange(false);
      return;
    }
    if (failedName) {
      const r = results[0] as PromiseRejectedResult;
      setNameError(getErrorMessage(r.reason));
    }
    if (failedPhoto) {
      const r = results[photoIndex] as PromiseRejectedResult;
      const err = r.reason as Error & { retryAfter?: number };
      setPhotoError(
        err?.retryAfter
          ? `Vượt giới hạn đổi avatar. Thử lại sau ${formatRetry(err.retryAfter)}`
          : getErrorMessage(err),
      );
    }
    if (nameChanged && !failedName) showSuccess('Đã đổi tên nhóm');
    if (photoChanged && !failedPhoto) {
      showSuccess('Đã cập nhật ảnh nhóm');
      setDraft({ kind: 'keep' });
    }
  };

  const requestClose = () => {
    if (saving || processing) return;
    if (dirty) setConfirmDiscard(true);
    else onOpenChange(false);
  };

  const previewUrl = draft.kind === 'new' ? draft.image.previewUrl : draft.kind === 'remove' ? null : group.avatar_url;

  return (
    <>
      <Sheet
        isOpen={isOpen}
        onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}
        isLocked={saving || processing}
        title="Sửa nhóm"
        footer={
          <Button fullWidth isPending={saving} isDisabled={!dirty || processing || !name.trim()} onPress={() => void save()}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        }
      >
        <div className="space-y-5">
          <TextInputField
            label="Tên nhóm"
            value={name}
            onChange={setName}
            maxLength={GROUP_NAME_MAX_LENGTH}
            error={nameError}
          />

          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">Ảnh nhóm</p>
            <div className="flex items-center gap-4">
              <div className={draft.kind === 'remove' ? 'opacity-40' : ''}>
                <Avatar seed={group.id} label={name || group.name} photoUrl={previewUrl} size={draft.kind === 'new' ? 96 : 72} palette="color" />
              </div>
              <div className="min-w-0 text-sm text-muted">
                {draft.kind === 'new'
                  ? `${draft.image.width}×${draft.image.height} • ${formatBytes(draft.image.sizeBytes)}`
                  : draft.kind === 'remove'
                    ? 'Ảnh sẽ bị xóa khi lưu'
                    : group.avatar_url
                      ? 'Đang dùng ảnh tùy chỉnh'
                      : 'Đang dùng avatar mặc định'}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {draft.kind === 'keep' ? (
                <>
                  <Button size="sm" variant="secondary" isDisabled={processing} onPress={() => libraryRef.current?.click()}>
                    <Images className="h-4 w-4" /> {processing ? 'Đang xử lý ảnh...' : 'Thư viện'}
                  </Button>
                  <Button size="sm" variant="secondary" isDisabled={processing} onPress={() => cameraRef.current?.click()}>
                    <Camera className="h-4 w-4" /> Chụp ảnh
                  </Button>
                  {group.avatar_url ? (
                    <Button size="sm" variant="ghost" onPress={() => setDraft({ kind: 'remove' })}>
                      <ImageMinus className="h-4 w-4" /> Xóa ảnh
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button size="sm" variant="secondary" onPress={() => setDraft({ kind: 'keep' })}>
                  <RotateCcw className="h-4 w-4" /> {draft.kind === 'new' ? 'Chọn ảnh khác' : 'Hoàn tác'}
                </Button>
              )}
            </div>
            <ErrorBox>{photoError}</ErrorBox>
          </div>
        </div>
        <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
      </Sheet>
      <ConfirmDialog
        isOpen={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        tone="warning"
        title="Thay đổi chưa lưu"
        description="Bạn đã thay đổi nhưng chưa lưu. Thoát mà không lưu?"
        cancelLabel="Ở lại"
        confirmLabel="Thoát"
        onConfirm={() => onOpenChange(false)}
      />
    </>
  );
}

function formatRetry(seconds: number): string {
  if (seconds < 60) return `${seconds} giây`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} phút`;
  if (seconds < 86400) return `${Math.ceil(seconds / 3600)} giờ`;
  return `${Math.ceil(seconds / 86400)} ngày`;
}
