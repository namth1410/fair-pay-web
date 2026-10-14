import { Button, Dropdown, Label } from '@heroui/react';
import { Copy, EllipsisVertical, Link2, Pencil, Share2, Trash2, UserPlus } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import type { Group, GroupInvitation, GroupMember, JoinRequest } from '../../services/group.service';
import { useGroupStore } from '../../stores/group.store';
import { showError, showSuccess } from '../../utils/toast';
import { Avatar } from '../ui/Avatar';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Pill } from '../ui/Primitives';
import { RowsSkeleton } from '../ui/Skeleton';
import { AddMemberSheet, ApproveJoinRequestSheet, RenameMemberSheet } from './MemberSheets';

function inviteLink(code: string): string {
  return `${window.location.origin}/join/${encodeURIComponent(code)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function InviteBanner({ group }: { group: Group }) {
  const code = group.invite_code;
  const message = `Tham gia nhóm "${group.name}" trên Fair Pay!\nMã mời: ${code}\n${inviteLink(code)}`;
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const pill =
    'flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-accent shadow-surface transition-colors hover:bg-primary-soft';

  return (
    <div className="mx-4 rounded-[20px] border border-brand-border bg-brand-soft p-4">
      <p className="text-[13px] font-bold text-muted">Mã mời vào nhóm</p>
      <p className="tabular mt-1 text-[26px] font-extrabold tracking-[0.28em] text-primary-strong">{code}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            if (await copyText(code)) showSuccess('Đã sao chép mã mời', code);
          }}
          className={pill}
        >
          <Copy className="h-3.5 w-3.5" /> Sao chép mã
        </button>
        <button
          type="button"
          onClick={async () => {
            if (await copyText(inviteLink(code))) showSuccess('Đã sao chép link mời', 'Gửi link cho bạn bè để tham gia nhóm.');
          }}
          className={pill}
        >
          <Link2 className="h-3.5 w-3.5" /> Sao chép link
        </button>
        {canShare ? (
          <button
            type="button"
            onClick={() => {
              navigator.share({ title: 'Fair Pay', text: message }).catch(() => {});
            }}
            className={pill}
          >
            <Share2 className="h-3.5 w-3.5" /> Chia sẻ
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Tiêu đề mục nhỏ kiểu app (chữ thường, đậm, xám). */
function SectionTitle({ children }: { children: ReactNode }) {
  return <p className="px-4 pb-1 pt-5 text-[13px] font-bold text-muted">{children}</p>;
}

export function MembersTab({ group, isAdmin }: { group: Group; isAdmin: boolean }) {
  const members = useGroupStore((s) => s.members);
  const isLoading = useGroupStore((s) => s.isLoadingMembers);
  const requests = useGroupStore((s) => s.pendingRequests);
  const invitations = useGroupStore((s) => s.pendingInvitations);
  const rejectRequest = useGroupStore((s) => s.rejectRequest);
  const revokeInvite = useGroupStore((s) => s.revokeInvite);
  const kickMember = useGroupStore((s) => s.kickMember);

  const [addOpen, setAddOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<JoinRequest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<JoinRequest | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<GroupInvitation | null>(null);
  const [renameTarget, setRenameTarget] = useState<GroupMember | null>(null);
  const [removeTarget, setRemoveTarget] = useState<GroupMember | null>(null);

  const claimName = (id: string | null) => (id ? members.find((m) => m.id === id)?.display_name : undefined);

  return (
    <div className="pb-4 pt-1">
      <InviteBanner group={group} />

      {isAdmin ? (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-2 flex min-h-[60px] w-full items-center gap-3 pl-4 text-left text-accent transition-colors hover:bg-surface-secondary"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft">
            <UserPlus className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-bold">Thêm thành viên</span>
        </button>
      ) : null}

      {isAdmin && requests.length > 0 ? (
        <section>
          <SectionTitle>Yêu cầu tham gia ({requests.length})</SectionTitle>
          <ul>
            {requests.map((req) => {
              const claim = claimName(req.claim_member_id);
              return (
                <li key={req.id} className="flex min-h-[64px] items-center gap-3 pl-4">
                  <Avatar seed={req.user_id} label={req.display_name} size={44} />
                  <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch border-b border-border py-2.5 pr-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-foreground">{req.display_name}</p>
                      <p className="truncate text-xs text-muted">{claim ? `Muốn thay cho: ${claim}` : 'Đang chờ duyệt'}</p>
                    </div>
                    <Button size="sm" variant="ghost" onPress={() => setRejectTarget(req)}>
                      Từ chối
                    </Button>
                    <Button size="sm" onPress={() => setApproveTarget(req)}>
                      Duyệt
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {isAdmin && invitations.length > 0 ? (
        <section>
          <SectionTitle>Lời mời đang chờ ({invitations.length})</SectionTitle>
          <ul>
            {invitations.map((inv) => (
              <li key={inv.id} className="flex min-h-[64px] items-center gap-3 pl-4">
                <Avatar
                  seed={inv.invited_user_id}
                  label={inv.invited_display_name || inv.invited_email}
                  photoUrl={inv.invited_photo_url}
                  size={44}
                />
                <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch border-b border-border py-2.5 pr-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foreground">
                      {inv.invited_display_name || inv.invited_email}
                    </p>
                    <p className="truncate text-xs text-muted">{inv.invited_email}</p>
                  </div>
                  <Button size="sm" variant="ghost" onPress={() => setRevokeTarget(inv)}>
                    Thu hồi
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionTitle>Thành viên ({members.length})</SectionTitle>
        {isLoading && members.length === 0 ? (
          <RowsSkeleton count={4} size={44} minHeight={64} />
        ) : (
          <ul>
            {members.map((m) => (
              <li key={m.id} className="flex min-h-[64px] items-center gap-3 pl-4">
                <Avatar seed={m.user_id ?? m.id} label={m.display_name} size={44} />
                <div className="flex min-w-0 flex-1 items-center gap-2 self-stretch border-b border-border py-2.5 pr-3">
                  <span className="truncate text-[15px] font-semibold text-foreground">{m.display_name}</span>
                  {m.is_virtual ? <Pill tone="muted">Ảo</Pill> : null}
                  {m.role === 'admin' ? <Pill tone="success">Quản trị</Pill> : null}
                  <span className="flex-1" />
                  {isAdmin && m.role !== 'admin' ? (
                    <Dropdown>
                      <Button isIconOnly size="sm" variant="ghost" aria-label={`Tùy chọn cho ${m.display_name}`}>
                        <EllipsisVertical className="h-4 w-4" />
                      </Button>
                      <Dropdown.Popover placement="bottom end">
                        <Dropdown.Menu
                          onAction={(key) => {
                            if (key === 'rename') setRenameTarget(m);
                            if (key === 'remove') setRemoveTarget(m);
                          }}
                        >
                          <Dropdown.Item id="rename" textValue="Đổi tên">
                            <Pencil className="h-4 w-4" />
                            <Label>Đổi tên</Label>
                          </Dropdown.Item>
                          <Dropdown.Item id="remove" textValue="Xóa khỏi nhóm" variant="danger">
                            <Trash2 className="h-4 w-4" />
                            <Label>Xóa khỏi nhóm</Label>
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddMemberSheet isOpen={addOpen} onOpenChange={setAddOpen} />
      <ApproveJoinRequestSheet request={approveTarget} onClose={() => setApproveTarget(null)} />
      <RenameMemberSheet member={renameTarget} onClose={() => setRenameTarget(null)} />

      <ConfirmDialog
        isOpen={rejectTarget !== null}
        onOpenChange={(o) => !o && setRejectTarget(null)}
        title="Từ chối"
        description={`Từ chối ${rejectTarget?.display_name ?? ''}?`}
        confirmLabel="Từ chối"
        pendingLabel="Đang xử lý..."
        onConfirm={async () => {
          if (!rejectTarget) return;
          try {
            await rejectRequest(rejectTarget.id);
            showSuccess('Đã từ chối yêu cầu');
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
      <ConfirmDialog
        isOpen={revokeTarget !== null}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title="Thu hồi lời mời"
        description={`Thu hồi lời mời gửi tới ${revokeTarget?.invited_display_name || revokeTarget?.invited_email || ''}?`}
        confirmLabel="Thu hồi"
        pendingLabel="Đang thu hồi..."
        onConfirm={async () => {
          if (!revokeTarget) return;
          try {
            await revokeInvite(revokeTarget.id);
            showSuccess('Đã thu hồi lời mời');
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
      <ConfirmDialog
        isOpen={removeTarget !== null}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title="Xóa thành viên"
        description={`Xóa ${removeTarget?.display_name ?? ''} khỏi nhóm?`}
        confirmLabel="Xóa"
        pendingLabel="Đang xóa..."
        onConfirm={async () => {
          if (!removeTarget) return;
          try {
            await kickMember(removeTarget);
            showSuccess('Đã xóa thành viên');
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
    </div>
  );
}
