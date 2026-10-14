import { DISPLAY_NAME_MAX_LENGTH, GROUP_NAME_MAX_LENGTH } from '../config/constants';
import { supabase } from '../config/supabase';
import { validateEmail, validateName } from '../utils/validate';
import { logAction } from './audit.service';
import { getAuthUserId, requireAuthUserId } from './auth.helper';
import { invokeEdgeFunction, uploadToPresignedUrl } from './edgeFunctions';
import { notifyJoinResolved } from './notification.service';

// Bản web gọi thẳng Supabase (không local-first). Hợp đồng RPC giữ nguyên như app
// native — xem src/services/group.service.ts bên repo fair-pay.

export interface BalanceSummary {
  /** Tổng số dư qua tất cả nhóm (chỉ chuyến đang mở): dương = được nợ, âm = đang nợ */
  total: number;
  /** Số dư của user trong từng group (groupId → balance) */
  groupBalances: Record<string, number>;
}

export interface Group {
  id: string;
  name: string;
  avatar_url: string | null;
  created_by: string;
  invite_code: string;
  created_at: string;
  deleted_at: string | null;
  version?: number;
  updated_at?: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  role: 'admin' | 'member';
  is_virtual: boolean;
  joined_at: string;
  left_at: string | null;
  version?: number;
}

export interface JoinRequest {
  id: string;
  group_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  display_name: string;
  /** Gợi ý slot thành viên ảo người join tự nhận (admin xác nhận khi duyệt). */
  claim_member_id: string | null;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export type JoinResult = { type: 'pending'; group: Group; requestId: string };

/** Thành viên ảo có thể nhận (claim) khi join — trả từ preview_join_by_code. */
export interface ClaimableMember {
  id: string;
  display_name: string;
}

export interface JoinPreview {
  group: Group;
  claimableMembers: ClaimableMember[];
}

export interface GroupWithMemberCount extends Group {
  member_count: number;
}

export interface MyPendingJoinRequest {
  request_id: string;
  group_id: string;
  group_name: string;
  created_at: string;
}

export interface GroupInvitation {
  id: string;
  group_id: string;
  invited_email: string;
  invited_user_id: string;
  invited_by: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  created_at: string;
  responded_at: string | null;
  invited_display_name?: string;
  invited_photo_url?: string | null;
}

export interface MyPendingInvitation {
  invitation_id: string;
  group_id: string;
  group_name: string;
  group_avatar_url: string | null;
  inviter_name: string;
  created_at: string;
}

export type Role = 'admin' | 'member';

// ── Role check (UX fail-fast; server is_admin()/is_member() mới là chốt thật) ──

const roleCache = new Map<string, Role | null>();

/** Ghi nhận role của user hiện tại khi đã tải danh sách thành viên. */
export function rememberMyRole(groupId: string, role: Role | null): void {
  roleCache.set(groupId, role);
}

export function clearRoleCache(): void {
  roleCache.clear();
}

async function getMyRole(groupId: string): Promise<Role | null> {
  if (roleCache.has(groupId)) return roleCache.get(groupId) ?? null;
  const userId = await getAuthUserId();
  if (!userId) return null;
  const { data, error } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .is('left_at', null)
    .maybeSingle();
  if (error) throw error;
  const role = (data?.role as Role | undefined) ?? null;
  roleCache.set(groupId, role);
  return role;
}

export async function assertRole(groupId: string, allowed: Role[]): Promise<void> {
  const userId = await getAuthUserId();
  if (!userId) throw new Error('Chưa đăng nhập');
  const role = await getMyRole(groupId);
  if (!role || !allowed.includes(role)) {
    throw new Error('Bạn không có quyền thực hiện hành động này');
  }
}

// ── Groups ─────────────────────────────────────────────────────────────────

/** Nhóm của user hiện tại + member_count — 1 RPC (get_my_groups). */
export async function fetchMyGroups(): Promise<GroupWithMemberCount[]> {
  const { data, error } = await supabase.rpc('get_my_groups');
  if (error) throw error;
  return ((data ?? []) as GroupWithMemberCount[]).map((g) => ({
    ...g,
    member_count: Number(g.member_count ?? 0),
  }));
}

/** 1 nhóm theo id (RLS: chỉ member/creator đọc được). */
export async function fetchGroupById(groupId: string): Promise<Group | null> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  return (data as Group | null) ?? null;
}

/** Tạo nhóm — người tạo thành admin. RPC atomic create_group. */
export async function createGroup(name: string): Promise<Group> {
  const nameErr = validateName(name, 'Tên nhóm');
  if (nameErr) throw new Error(nameErr);
  const trimmed = name.trim();
  if (trimmed.length > GROUP_NAME_MAX_LENGTH) {
    throw new Error(`Tên nhóm không được quá ${GROUP_NAME_MAX_LENGTH} ký tự`);
  }
  await requireAuthUserId();

  const { data, error } = await supabase.rpc('create_group', {
    p_id: crypto.randomUUID(),
    p_name: trimmed,
    p_admin_member_id: crypto.randomUUID(),
    p_client_request_id: crypto.randomUUID(),
    p_client_created_at: new Date().toISOString(),
  });
  if (error) throw error;
  return data as Group;
}

/** Đổi tên nhóm (admin) — P3 optimistic concurrency theo version đang hiển thị. */
export async function updateGroupName(
  groupId: string,
  name: string,
  baseVersion: number,
): Promise<{ version: number; name: string; avatar_url: string | null }> {
  await assertRole(groupId, ['admin']);
  const nameErr = validateName(name, 'Tên nhóm');
  if (nameErr) throw new Error(nameErr);

  const { data, error } = await supabase.rpc('update_group', {
    p_group_id: groupId,
    p_name: name.trim(),
    p_avatar_url: null,
    p_base_version: baseVersion,
    p_client_request_id: crypto.randomUUID(),
    p_client_created_at: new Date().toISOString(),
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as {
    version: number;
    name: string;
    avatar_url: string | null;
  };
  return row;
}

/** Xóa mềm nhóm (admin). */
export async function deleteGroup(groupId: string): Promise<void> {
  await assertRole(groupId, ['admin']);
  const { error } = await supabase
    .from('groups')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', groupId)
    .is('deleted_at', null);
  if (error) throw error;
}

// ── Join by code ───────────────────────────────────────────────────────────

/**
 * Preview nhóm + danh sách thành viên ảo có thể nhận (claim) theo mã mời.
 * KHÔNG tạo join request.
 */
export async function previewJoinByCode(code: string): Promise<JoinPreview> {
  const { data, error } = await supabase.rpc('preview_join_by_code', {
    p_code: code.trim(),
  });
  if (error) throw error;
  const payload = data as { group: Group; claimable_members: ClaimableMember[] | null };
  return { group: payload.group, claimableMembers: payload.claimable_members ?? [] };
}

/** BR-09: tạo join request (mọi trường hợp đều cần admin duyệt). */
export async function joinGroupByCode(
  code: string,
  claimMemberId?: string | null,
): Promise<JoinResult> {
  const { data, error } = await supabase.rpc('request_join_by_code', {
    p_code: code.trim(),
    p_claim_member_id: claimMemberId ?? null,
  });
  if (error) throw error;
  const payload = data as { request_id: string; requester_name: string; group: Group };
  return { type: 'pending', group: payload.group, requestId: payload.request_id };
}

/** Yêu cầu tham gia đang chờ của chính user (ribbon "ĐANG CHỜ DUYỆT" ở Home). */
export async function fetchMyPendingJoinRequests(): Promise<MyPendingJoinRequest[]> {
  const { data, error } = await supabase.rpc('get_my_pending_join_requests');
  if (error) throw error;
  return (data as MyPendingJoinRequest[] | null) ?? [];
}

/** F-23: join requests đang chờ của 1 nhóm (admin). */
export async function fetchPendingJoinRequests(groupId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as JoinRequest[] | null) ?? [];
}

/**
 * F-23: Admin duyệt join request.
 * - `adoptMemberId` rỗng → thêm thành viên mới (approve_join_request).
 * - có giá trị → gán requester vào slot thành viên ảo (kế thừa số dư/lịch sử).
 */
export async function approveJoinRequest(
  requestId: string,
  groupId: string,
  groupName: string,
  adoptMemberId?: string | null,
): Promise<void> {
  if (adoptMemberId) {
    const { error } = await supabase.rpc('approve_join_request_as_adoption', {
      p_request_id: requestId,
      p_group_id: groupId,
      p_group_name: groupName,
      p_member_id: adoptMemberId,
    });
    if (error) throw error;
    return;
  }
  const { error } = await supabase.rpc('approve_join_request', {
    p_request_id: requestId,
    p_group_id: groupId,
    p_group_name: groupName,
  });
  if (error) throw error;
}

/** F-23: Admin từ chối join request (+ audit + notify requester). */
export async function rejectJoinRequest(
  requestId: string,
  groupId: string,
  groupName: string,
): Promise<void> {
  await assertRole(groupId, ['admin']);
  const reviewerId = await requireAuthUserId();

  // Lấy requester TRƯỚC khi đổi status (để notify). Filter group_id chống
  // cross-tenant reject.
  const { data: req } = await supabase
    .from('join_requests')
    .select('user_id')
    .eq('id', requestId)
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .maybeSingle();

  const { error } = await supabase
    .from('join_requests')
    .update({
      status: 'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('group_id', groupId)
    .eq('status', 'pending');
  if (error) throw error;

  await logAction({ groupId, action: 'member.join_rejected', targetId: requestId });
  if (req?.user_id) {
    await notifyJoinResolved('member.join_rejected', {
      groupId,
      groupName,
      reviewerId,
      requesterUserId: req.user_id as string,
    });
  }
}

// ── Members ────────────────────────────────────────────────────────────────

/** Thành viên đang hoạt động (left_at IS NULL) — admin trước, rồi theo ngày vào. */
export async function fetchGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .is('left_at', null)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as GroupMember[]).map((m) => ({ ...m, is_virtual: !!m.is_virtual }));
}

/** Toàn bộ thành viên kể cả đã rời (hiển thị tên trong lịch sử/khoản chi cũ). */
export async function fetchAllGroupMembers(groupId: string): Promise<GroupMember[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('role', { ascending: true })
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as GroupMember[]).map((m) => ({ ...m, is_virtual: !!m.is_virtual }));
}

/** Thành viên ảo (admin). Cho phép trùng display_name. */
export async function addVirtualMember(
  groupId: string,
  displayName: string,
): Promise<GroupMember> {
  await assertRole(groupId, ['admin']);
  const trimmed = displayName.trim();
  const nameErr = validateName(trimmed, 'Tên thành viên');
  if (nameErr) throw new Error(nameErr);
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Tên thành viên không được quá ${DISPLAY_NAME_MAX_LENGTH} ký tự`);
  }

  const { data, error } = await supabase
    .rpc('add_virtual_member', {
      p_id: crypto.randomUUID(),
      p_group_id: groupId,
      p_display_name: trimmed,
      p_client_request_id: crypto.randomUUID(),
      p_client_created_at: new Date().toISOString(),
    })
    .single();
  if (error) throw error;
  const m = data as GroupMember;
  return { ...m, is_virtual: true };
}

/** Xóa mềm thành viên (admin; không xóa được admin). */
export async function removeMember(member: GroupMember): Promise<void> {
  if (member.role === 'admin') {
    throw new Error('Admin không thể rời/bị xóa khỏi nhóm. Hãy xóa nhóm thay thế.');
  }
  await assertRole(member.group_id, ['admin']);
  const { error } = await supabase.rpc('remove_member', {
    p_member_id: member.id,
    p_client_request_id: crypto.randomUUID(),
    p_client_created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Đổi tên thành viên (admin) — P3 theo version đang hiển thị. */
export async function renameMember(member: GroupMember, newDisplayName: string): Promise<void> {
  if (member.left_at) throw new Error('Không thể đổi tên thành viên đã rời nhóm');
  await assertRole(member.group_id, ['admin']);

  const trimmed = newDisplayName.trim();
  const nameErr = validateName(trimmed, 'Tên thành viên');
  if (nameErr) throw new Error(nameErr);
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(`Tên thành viên không được quá ${DISPLAY_NAME_MAX_LENGTH} ký tự`);
  }
  if (trimmed === member.display_name) return;

  let baseVersion = member.version;
  if (baseVersion == null) {
    const { data } = await supabase
      .from('group_members')
      .select('version')
      .eq('id', member.id)
      .maybeSingle();
    baseVersion = (data?.version as number | undefined) ?? 1;
  }

  const { error } = await supabase.rpc('update_member_display_name', {
    p_member_id: member.id,
    p_display_name: trimmed,
    p_base_version: baseVersion,
    p_client_request_id: crypto.randomUUID(),
    p_client_created_at: new Date().toISOString(),
  });
  if (error) throw error;
}

// ── Invitations (admin mời qua email → user chấp nhận/từ chối) ─────────────

export async function inviteMemberByEmail(
  groupId: string,
  email: string,
): Promise<{ invitation_id: string; invited_user_id: string; invited_name: string }> {
  const emailErr = validateEmail(email);
  if (emailErr) throw new Error(emailErr);
  const { data, error } = await supabase.rpc('invite_member_by_email', {
    p_group_id: groupId,
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw error;
  return data as { invitation_id: string; invited_user_id: string; invited_name: string };
}

export async function respondToInvitation(
  invitationId: string,
  action: 'accept' | 'decline',
): Promise<{ group_id: string; group_name: string; status: string }> {
  const { data, error } = await supabase.rpc('respond_to_invitation', {
    p_invitation_id: invitationId,
    p_action: action,
  });
  if (error) throw error;
  return data as { group_id: string; group_name: string; status: string };
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_invitation', { p_invitation_id: invitationId });
  if (error) throw error;
}

export async function fetchPendingInvitations(groupId: string): Promise<GroupInvitation[]> {
  const { data, error } = await supabase.rpc('get_pending_invitations_for_group', {
    p_group_id: groupId,
  });
  if (error) throw error;
  return (data as GroupInvitation[] | null) ?? [];
}

export async function fetchMyPendingInvitations(): Promise<MyPendingInvitation[]> {
  const { data, error } = await supabase.rpc('get_my_pending_invitations');
  if (error) throw error;
  return (data as MyPendingInvitation[] | null) ?? [];
}

// ── Balance summary ────────────────────────────────────────────────────────

/** F-22 / BR-10: số dư user trên mọi chuyến đang mở — 1 RPC tổng hợp server-side. */
export async function fetchUserBalanceSummary(): Promise<BalanceSummary> {
  const { data, error } = await supabase.rpc('get_user_balance_summary');
  if (error) throw error;
  const rows = (data as { group_id: string; balance: number | string }[] | null) ?? [];
  const groupBalances: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    const b = Number(r.balance) || 0;
    groupBalances[r.group_id] = b;
    total += b;
  }
  return { total, groupBalances };
}

// ── Group avatar (R2 qua Edge Functions) ───────────────────────────────────

export async function saveGroupAvatar(
  groupId: string,
  image: { blob: Blob; sizeBytes: number },
): Promise<string> {
  await assertRole(groupId, ['admin']);
  const presign = await invokeEdgeFunction<{ uploadUrl: string; fileKey: string }>(
    'group-avatar-presign',
    { groupId, sizeBytes: image.sizeBytes },
  );
  await uploadToPresignedUrl(presign.uploadUrl, image.blob);
  const result = await invokeEdgeFunction<{ avatar_url: string }>('group-avatar-commit', {
    groupId,
    fileKey: presign.fileKey,
  });
  return result.avatar_url;
}

export async function removeGroupAvatar(groupId: string): Promise<void> {
  await assertRole(groupId, ['admin']);
  await invokeEdgeFunction('group-avatar-remove', { groupId });
}
