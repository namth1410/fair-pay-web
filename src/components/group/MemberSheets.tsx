import { Button } from '@heroui/react';
import { useEffect, useMemo, useState } from 'react';

import { DISPLAY_NAME_MAX_LENGTH } from '../../config/constants';
import type { GroupMember, JoinRequest } from '../../services/group.service';
import { useGroupStore } from '../../stores/group.store';
import { getErrorMessage } from '../../utils/error';
import { showSuccess } from '../../utils/toast';
import { validateEmail } from '../../utils/validate';
import { TextInputField } from '../ui/Field';
import { ChipPicker, ErrorBox, InfoBox, SegmentedTabs } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

/** Mời bằng email | Thêm thành viên ảo (admin). */
export function AddMemberSheet({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (o: boolean) => void }) {
  const inviteMember = useGroupStore((s) => s.inviteMember);
  const addVirtualMember = useGroupStore((s) => s.addVirtualMember);
  const [tab, setTab] = useState<'email' | 'virtual'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setName('');
      setError(null);
    }
  }, [isOpen]);

  const submit = async () => {
    setError(null);
    if (tab === 'email') {
      const err = validateEmail(email);
      if (err) {
        setError(err);
        return;
      }
      setBusy(true);
      try {
        const normalized = email.trim().toLowerCase();
        await inviteMember(normalized);
        showSuccess('Đã gửi lời mời', normalized);
        onOpenChange(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '';
        setError(msg.includes('already_member') ? 'Người này đã là thành viên của nhóm' : getErrorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await addVirtualMember(trimmed);
      showSuccess('Đã thêm thành viên ảo', trimmed);
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
      title={tab === 'email' ? 'Mời bằng email' : 'Thêm thành viên ảo'}
      size="sm"
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <SegmentedTabs
          ariaLabel="Cách thêm thành viên"
          stretch
          tabs={[
            { id: 'email', label: 'Mời bằng email' },
            { id: 'virtual', label: 'Thành viên ảo' },
          ]}
          value={tab}
          onChange={(t) => {
            setTab(t);
            setError(null);
          }}
        />
        {tab === 'email' ? (
          <>
            <p className="text-sm leading-5 text-muted">
              Người được mời phải có tài khoản Fair Pay. Họ sẽ nhận thông báo và bấm Chấp nhận để vào nhóm.
            </p>
            <TextInputField
              label="Email người được mời"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="ban@email.com"
              autoComplete="off"
              autoFocus
            />
          </>
        ) : (
          <>
            <p className="text-sm leading-5 text-muted">
              Tạo thành viên không cần tài khoản — dùng khi bạn quản lý chi tiêu cho người chưa cài app.
            </p>
            <TextInputField
              label="Tên hiển thị"
              value={name}
              onChange={setName}
              placeholder="VD: Bé Na"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoFocus
            />
          </>
        )}
        <ErrorBox>{error}</ErrorBox>
        <Button
          type="submit"
          fullWidth
          isPending={busy}
          isDisabled={tab === 'email' ? !email.trim() : !name.trim()}
        >
          {tab === 'email' ? (busy ? 'Đang gửi...' : 'Gửi lời mời') : busy ? 'Đang tạo...' : 'Tạo thành viên'}
        </Button>
      </form>
    </Sheet>
  );
}

const NEW_MEMBER = '__new__';

/** Duyệt yêu cầu: thành viên mới hoặc gán vào thành viên ảo (kế thừa số dư/lịch sử). */
export function ApproveJoinRequestSheet({ request, onClose }: { request: JoinRequest | null; onClose: () => void }) {
  const members = useGroupStore((s) => s.members);
  const approveRequest = useGroupStore((s) => s.approveRequest);
  const virtuals = useMemo(() => members.filter((m) => m.is_virtual && !m.left_at), [members]);
  const [choice, setChoice] = useState<string>(NEW_MEMBER);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!request) return;
    const suggested = request.claim_member_id && virtuals.some((v) => v.id === request.claim_member_id);
    setChoice(suggested ? request.claim_member_id! : NEW_MEMBER);
    setError(null);
  }, [request, virtuals]);

  const chosen = virtuals.find((v) => v.id === choice);

  const submit = async () => {
    if (!request) return;
    setBusy(true);
    setError(null);
    try {
      await approveRequest(request.id, choice === NEW_MEMBER ? null : choice);
      showSuccess('Đã duyệt yêu cầu');
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet isOpen={request !== null} onOpenChange={(o) => !o && onClose()} isLocked={busy} title="Duyệt yêu cầu" size="sm">
      {request ? (
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-foreground">{request.display_name} muốn tham gia nhóm</p>
            <p className="mt-1 text-sm leading-5 text-muted">
              Duyệt là thành viên mới, hoặc gán họ vào một thành viên ảo đã có để kế thừa toàn bộ số dư &amp; lịch sử.
            </p>
          </div>
          <ChipPicker
            ariaLabel="Duyệt với tư cách"
            value={choice}
            onChange={setChoice}
            options={[
              { value: NEW_MEMBER, label: 'Thành viên mới' },
              ...virtuals.map((v) => ({ value: v.id, label: v.display_name })),
            ]}
          />
          {chosen ? (
            <InfoBox>
              {request.display_name} sẽ thay thế “{chosen.display_name}” và kế thừa toàn bộ số dư, khoản chi, thanh
              toán đã ghi.
            </InfoBox>
          ) : null}
          <ErrorBox>{error}</ErrorBox>
          <Button fullWidth isPending={busy} onPress={() => void submit()}>
            {busy ? 'Đang duyệt...' : 'Duyệt'}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}

/** Đổi tên thành viên (admin). */
export function RenameMemberSheet({ member, onClose }: { member: GroupMember | null; onClose: () => void }) {
  const renameMember = useGroupStore((s) => s.renameMember);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (member) {
      setName(member.display_name);
      setError(null);
    }
  }, [member]);

  const trimmed = name.trim();
  const changed = !!member && trimmed !== member.display_name;

  const submit = async () => {
    if (!member || !trimmed || !changed) return;
    setBusy(true);
    setError(null);
    try {
      await renameMember(member, trimmed);
      showSuccess('Đã đổi tên thành viên');
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      isOpen={member !== null}
      onOpenChange={(o) => !o && onClose()}
      isLocked={busy}
      title="Đổi tên thành viên"
      description="Tên mới sẽ hiển thị ở danh sách thành viên, các khoản chi và thanh toán liên quan."
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
          label="Tên thành viên"
          value={name}
          onChange={setName}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          autoFocus
          labelEnd={<span className="text-xs text-muted">{trimmed.length}/{DISPLAY_NAME_MAX_LENGTH}</span>}
        />
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" fullWidth isPending={busy} isDisabled={!trimmed || !changed}>
          {busy ? 'Đang lưu...' : 'Lưu tên mới'}
        </Button>
      </form>
    </Sheet>
  );
}
