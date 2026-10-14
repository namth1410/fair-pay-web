import { Button, Dropdown, Label, Skeleton } from '@heroui/react';
import { Copy, EllipsisVertical, Link2, Pencil, Share2, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';

import type { Group, GroupInvitation, GroupMember, JoinRequest } from '../../services/group.service';
import { useGroupStore } from '../../stores/group.store';
import { showError, showSuccess } from '../../utils/toast';
import { Avatar } from '../ui/Avatar';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Pill } from '../ui/Primitives';
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

  return (
    <div className="relative overflow-hidden rounded-2xl bg-foreground p-4 text-background">
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-background/10" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">Mã mời</p>
      <p className="tabular mt-1 text-2xl font-bold tracking-[0.3em]">{code}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            if (await copyText(code)) showSuccess('Đã sao chép mã mời', code);
          }}
          className="flex items-center gap-1.5 rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-background/25"
        >
          <Copy className="h-3.5 w-3.5" /> Sao chép mã
        </button>
        <button
          type="button"
          onClick={async () => {
            if (await copyText(inviteLink(code))) showSuccess('Đã sao chép link mời', 'Gửi link cho bạn bè để tham gia nhóm.');
          }}
          className="flex items-center gap-1.5 rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-background/25"
        >
          <Link2 className="h-3.5 w-3.5" /> Sao chép link
        </button>
        {canShare ? (
          <button
            type="button"
            onClick={() => {
              navigator.share({ title: 'Fair Pay', text: message }).catch(() => {});
            }}
            className="flex items-center gap-1.5 rounded-full bg-background/15 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-background/25"
          >
            <Share2 className="h-3.5 w-3.5" /> Chia sẻ
          </button>
        ) : null}
      </div>
    </div>
  );
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
    <div className="space-y-5">
      <InviteBanner group={group} />

      {isAdmin ? (
        <Button fullWidth variant="secondary" onPress={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4" /> Thêm thành viên
        </Button>
      ) : null}

      {isAdmin && requests.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Yêu cầu tham gia ({requests.length})
          </p>
          <ul className="space-y-2">
            {requests.map((req) => {
              const claim = claimName(req.claim_member_id);
              return (
                <li key={req.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface p-3 shadow-surface">
                  <Avatar seed={req.user_id} label={req.display_name} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{req.display_name}</p>
                    <p className="truncate text-xs text-muted">{claim ? `Muốn thay cho: ${claim}` : 'Đang chờ duyệt'}</p>
                  </div>
                  <Button size="sm" variant="ghost" onPress={() => setRejectTarget(req)}>
                    Từ chối
                  </Button>
                  <Button size="sm" onPress={() => setApproveTarget(req)}>
                    Duyệt
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {isAdmin && invitations.length > 0 ? (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
            Lời mời đang chờ ({invitations.length})
          </p>
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li key={inv.id} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface p-3 shadow-surface">
                <Avatar
                  seed={inv.invited_user_id}
                  label={inv.invited_display_name || inv.invited_email}
                  photoUrl={inv.invited_photo_url}
                  size={40}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {inv.invited_display_name || inv.invited_email}
                  </p>
                  <p className="truncate text-xs text-muted">{inv.invited_email}</p>
                </div>
                <Button size="sm" variant="ghost" onPress={() => setRevokeTarget(inv)}>
                  Thu hồi
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
          Thành viên ({members.length})
        </p>
        {isLoading && members.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-surface">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar seed={m.user_id ?? m.id} label={m.display_name} size={40} />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{m.display_name}</span>
                  {m.is_virtual ? <Pill tone="muted">Ảo</Pill> : null}
                  {m.role === 'admin' ? <Pill tone="accent">Quản trị</Pill> : null}
                </div>
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
