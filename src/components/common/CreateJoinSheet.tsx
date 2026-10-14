import { Button } from '@heroui/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

import { GROUP_NAME_MAX_LENGTH } from '../../config/constants';
import { type JoinPreview, previewJoinByCode } from '../../services/group.service';
import { useGroupStore } from '../../stores/group.store';
import { useUIStore } from '../../stores/ui.store';
import { getErrorMessage } from '../../utils/error';
import { showSuccess } from '../../utils/toast';
import { TextInputField } from '../ui/Field';
import { ChipPicker, ErrorBox, SegmentedTabs } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

const NEW_MEMBER = '__new__';

/** Tạo nhóm mới / tham gia bằng mã mời (+ nhận lại thành viên ảo) — như CreateJoinSheet app. */
export function CreateJoinSheet() {
  const isOpen = useUIStore((s) => s.createJoinOpen);
  const initialMode = useUIStore((s) => s.createJoinMode);
  const initialCode = useUIStore((s) => s.createJoinCode);
  const close = useUIStore((s) => s.closeCreateJoin);
  const createGroup = useGroupStore((s) => s.createGroup);
  const joinByCode = useGroupStore((s) => s.joinByCode);
  const navigate = useNavigate();

  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<JoinPreview | null>(null);
  const [claimId, setClaimId] = useState<string>(NEW_MEMBER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset mỗi lần mở.
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setName('');
    setCode(initialCode);
    setPreview(null);
    setClaimId(NEW_MEMBER);
    setError(null);
    setBusy(false);
  }, [isOpen, initialMode, initialCode]);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const group = await createGroup(trimmed);
      close();
      showSuccess('Đã tạo nhóm', trimmed);
      navigate(`/groups/${group.id}`);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async (claim: string | null) => {
    await joinByCode(code.trim(), claim);
    close();
    showSuccess('Đã gửi yêu cầu tham gia', 'Chờ quản trị viên nhóm duyệt nhé.');
    navigate('/');
  };

  const handleCheckCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const p = await previewJoinByCode(trimmed);
      if (p.claimableMembers.length === 0) {
        await doJoin(null);
        return;
      }
      setPreview(p);
      setClaimId(NEW_MEMBER);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleJoinWithClaim = async () => {
    setBusy(true);
    setError(null);
    try {
      await doJoin(claimId === NEW_MEMBER ? null : claimId);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const identityStep = mode === 'join' && preview !== null;

  return (
    <Sheet
      isOpen={isOpen}
      onOpenChange={(o) => !o && close()}
      isLocked={busy}
      title={mode === 'create' ? 'Tạo nhóm mới' : 'Tham gia nhóm'}
      size="sm"
    >
      <div className="space-y-4">
        {!identityStep ? (
          <SegmentedTabs
            ariaLabel="Chọn tạo hoặc tham gia nhóm"
            stretch
            tabs={[
              { id: 'create', label: 'Tạo nhóm' },
              { id: 'join', label: 'Nhập mã mời' },
            ]}
            value={mode}
            onChange={(m) => {
              setMode(m);
              setError(null);
            }}
          />
        ) : null}

        {mode === 'create' ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreate();
            }}
          >
            <p className="text-sm text-muted">Đặt tên nhóm để bắt đầu chia sẻ chi tiêu với mọi người.</p>
            <TextInputField
              label="Tên nhóm mới"
              value={name}
              onChange={setName}
              placeholder="VD: Hội bạn cấp 3"
              maxLength={GROUP_NAME_MAX_LENGTH}
              autoFocus
            />
            <ErrorBox>{error}</ErrorBox>
            <Button type="submit" fullWidth isPending={busy} isDisabled={!name.trim()}>
              {busy ? 'Đang tạo...' : 'Tạo nhóm'}
            </Button>
          </form>
        ) : !identityStep ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void handleCheckCode();
            }}
          >
            <p className="text-sm text-muted">Nhập mã 6 ký tự được người quản trị chia sẻ.</p>
            <TextInputField
              label="Mã mời (6 ký tự)"
              value={code}
              onChange={(v) => setCode(v.replace(/\s/g, ''))}
              placeholder="vd: a1b2c3"
              maxLength={12}
              autoComplete="off"
              autoFocus
              inputClassName="tracking-[0.2em] font-semibold"
            />
            <ErrorBox>{error}</ErrorBox>
            <Button type="submit" fullWidth isPending={busy} isDisabled={!code.trim()}>
              {busy ? 'Đang kiểm tra...' : 'Tiếp tục'}
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-base font-semibold text-foreground">Tham gia nhóm “{preview.group.name}”</p>
              <p className="mt-1 text-sm leading-5 text-muted">
                Bạn là ai trong nhóm này? Chọn thành viên đã được tạo sẵn cho bạn để nhận lại số dư &amp; lịch sử,
                hoặc tham gia với tư cách thành viên mới.
              </p>
            </div>
            <ChipPicker
              ariaLabel="Chọn danh tính trong nhóm"
              value={claimId}
              onChange={setClaimId}
              options={[
                { value: NEW_MEMBER, label: 'Tôi là thành viên mới' },
                ...preview.claimableMembers.map((m) => ({ value: m.id, label: m.display_name })),
              ]}
            />
            <ErrorBox>{error}</ErrorBox>
            <div className="flex gap-2">
              <Button variant="ghost" isDisabled={busy} onPress={() => setPreview(null)}>
                Quay lại
              </Button>
              <Button className="flex-1" isPending={busy} onPress={() => void handleJoinWithClaim()}>
                {busy ? 'Đang gửi...' : 'Tham gia'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
