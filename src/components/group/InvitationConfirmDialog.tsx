import { Button, Modal } from '@heroui/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import type { MyPendingInvitation } from '../../services/group.service';
import { useGroupStore } from '../../stores/group.store';
import { showError, showInfo, showSuccess, showWarning } from '../../utils/toast';
import { Avatar } from '../ui/Avatar';

/** Chấp nhận / từ chối lời mời vào nhóm. */
export function InvitationConfirmDialog({
  invitation,
  onClose,
}: {
  invitation: MyPendingInvitation | null;
  onClose: () => void;
}) {
  const respond = useGroupStore((s) => s.respondToInvitation);
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'accept' | 'decline' | null>(null);

  const act = async (action: 'accept' | 'decline') => {
    if (!invitation) return;
    setBusy(action);
    try {
      const res = await respond(invitation.invitation_id, action);
      onClose();
      if (action === 'accept') {
        showSuccess(`Đã vào nhóm ${res.group_name ?? invitation.group_name}`);
        navigate(`/groups/${res.group_id ?? invitation.group_id}`);
      } else {
        showInfo('Đã từ chối lời mời');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('invitation_not_pending') || msg.includes('invitation_not_found')) {
        showWarning('Lời mời đã được xử lý', 'Có thể đã bị thu hồi hoặc trả lời ở thiết bị khác.');
        void useGroupStore.getState().loadMyPendingInvitations();
        onClose();
      } else {
        showError(e);
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal.Backdrop
      isOpen={invitation !== null}
      onOpenChange={(o) => !o && !busy && onClose()}
      isDismissable={!busy}
    >
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>Lời mời tham gia nhóm</Modal.Heading>
          </Modal.Header>
          {invitation ? (
            <Modal.Body className="flex flex-col items-center gap-2 py-2 text-center">
              <Avatar
                seed={invitation.group_id}
                label={invitation.group_name}
                photoUrl={invitation.group_avatar_url}
                size={56}
              />
              <p className="text-base font-semibold text-foreground">{invitation.group_name}</p>
              <p className="text-sm text-muted">do {invitation.inviter_name || 'quản trị viên'} mời</p>
              <p className="mt-2 text-sm text-foreground">Bạn có muốn tham gia nhóm này không?</p>
            </Modal.Body>
          ) : null}
          <Modal.Footer>
            <Button variant="ghost" isDisabled={busy !== null} isPending={busy === 'decline'} onPress={() => void act('decline')}>
              Từ chối
            </Button>
            <Button isDisabled={busy !== null} isPending={busy === 'accept'} onPress={() => void act('accept')}>
              {busy === 'accept' ? 'Đang xử lý...' : 'Chấp nhận'}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
