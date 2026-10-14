import { create } from 'zustand';

import { getAuthUserId } from '../services/auth.helper';
import {
  addVirtualMember,
  approveJoinRequest,
  type BalanceSummary,
  createGroup,
  deleteGroup,
  fetchGroupById,
  fetchGroupMembers,
  fetchMyGroups,
  fetchMyPendingInvitations,
  fetchMyPendingJoinRequests,
  fetchPendingInvitations,
  fetchPendingJoinRequests,
  fetchUserBalanceSummary,
  type Group,
  type GroupInvitation,
  type GroupMember,
  type GroupWithMemberCount,
  inviteMemberByEmail,
  joinGroupByCode,
  type JoinRequest,
  type MyPendingInvitation,
  type MyPendingJoinRequest,
  rejectJoinRequest,
  rememberMyRole,
  removeGroupAvatar,
  removeMember,
  renameMember,
  respondToInvitation,
  revokeInvitation,
  saveGroupAvatar,
  updateGroupName,
} from '../services/group.service';

interface GroupState {
  // Home
  groups: GroupWithMemberCount[];
  groupsLoaded: boolean;
  isLoadingGroups: boolean;
  balanceSummary: BalanceSummary;
  myPendingJoinRequests: MyPendingJoinRequest[];
  myPendingInvitations: MyPendingInvitation[];

  // Group detail
  currentGroupId: string | null;
  currentGroup: Group | null;
  currentGroupError: boolean;
  members: GroupMember[];
  myMemberId: string | null;
  myRole: 'admin' | 'member' | null;
  isLoadingMembers: boolean;
  pendingRequests: JoinRequest[];
  pendingInvitations: GroupInvitation[];

  loadGroups: (opts?: { quiet?: boolean }) => Promise<void>;
  loadBalanceSummary: () => Promise<void>;
  loadMyPendingJoinRequests: () => Promise<void>;
  loadMyPendingInvitations: () => Promise<void>;

  openGroup: (groupId: string, opts?: { quiet?: boolean }) => Promise<void>;
  loadMembers: (groupId: string) => Promise<void>;
  loadAdminExtras: (groupId: string) => Promise<void>;

  createGroup: (name: string) => Promise<Group>;
  joinByCode: (code: string, claimMemberId?: string | null) => Promise<void>;
  respondToInvitation: (invitationId: string, action: 'accept' | 'decline') => Promise<{ group_id: string; group_name: string }>;

  approveRequest: (requestId: string, adoptMemberId?: string | null) => Promise<void>;
  rejectRequest: (requestId: string) => Promise<void>;
  inviteMember: (email: string) => Promise<void>;
  revokeInvite: (invitationId: string) => Promise<void>;
  addVirtualMember: (name: string) => Promise<void>;
  renameMember: (member: GroupMember, name: string) => Promise<void>;
  kickMember: (member: GroupMember) => Promise<void>;
  renameGroup: (name: string) => Promise<void>;
  saveAvatar: (image: { blob: Blob; sizeBytes: number }) => Promise<void>;
  removeAvatar: () => Promise<void>;
  removeGroup: (groupId: string) => Promise<void>;

  reset: () => void;
}

const initialState = {
  groups: [] as GroupWithMemberCount[],
  groupsLoaded: false,
  isLoadingGroups: false,
  balanceSummary: { total: 0, groupBalances: {} } as BalanceSummary,
  myPendingJoinRequests: [] as MyPendingJoinRequest[],
  myPendingInvitations: [] as MyPendingInvitation[],
  currentGroupId: null as string | null,
  currentGroup: null as Group | null,
  currentGroupError: false,
  members: [] as GroupMember[],
  myMemberId: null as string | null,
  myRole: null as 'admin' | 'member' | null,
  isLoadingMembers: false,
  pendingRequests: [] as JoinRequest[],
  pendingInvitations: [] as GroupInvitation[],
};

export const useGroupStore = create<GroupState>((set, get) => ({
  ...initialState,

  loadGroups: async (opts) => {
    if (!opts?.quiet) set({ isLoadingGroups: true });
    try {
      const groups = await fetchMyGroups();
      set({ groups, groupsLoaded: true });
    } finally {
      if (!opts?.quiet) set({ isLoadingGroups: false });
    }
    // Phần phụ chạy nền — không chặn danh sách nhóm.
    void get().loadBalanceSummary();
    void get().loadMyPendingJoinRequests();
    void get().loadMyPendingInvitations();
  },

  loadBalanceSummary: async () => {
    try {
      set({ balanceSummary: await fetchUserBalanceSummary() });
    } catch (e) {
      if (__DEV__) console.warn('[group] balance summary failed', e);
    }
  },

  loadMyPendingJoinRequests: async () => {
    try {
      set({ myPendingJoinRequests: await fetchMyPendingJoinRequests() });
    } catch (e) {
      if (__DEV__) console.warn('[group] my pending requests failed', e);
    }
  },

  loadMyPendingInvitations: async () => {
    try {
      set({ myPendingInvitations: await fetchMyPendingInvitations() });
    } catch (e) {
      if (__DEV__) console.warn('[group] my pending invitations failed', e);
    }
  },

  openGroup: async (groupId, opts) => {
    const switching = get().currentGroupId !== groupId;
    set({
      currentGroupId: groupId,
      currentGroupError: false,
      ...(switching && {
        currentGroup: null,
        members: [],
        myMemberId: null,
        myRole: null,
        pendingRequests: [],
        pendingInvitations: [],
      }),
    });
    try {
      const [group] = await Promise.all([fetchGroupById(groupId), get().loadMembers(groupId)]);
      if (get().currentGroupId !== groupId) return;
      if (!group) {
        set({ currentGroupError: true });
        return;
      }
      set({ currentGroup: group });
      if (get().myRole === 'admin') void get().loadAdminExtras(groupId);
    } catch (e) {
      if (get().currentGroupId === groupId && !opts?.quiet) set({ currentGroupError: true });
      throw e;
    }
  },

  loadMembers: async (groupId) => {
    set({ isLoadingMembers: true });
    try {
      const [members, userId] = await Promise.all([fetchGroupMembers(groupId), getAuthUserId()]);
      if (get().currentGroupId !== groupId) return;
      const me = members.find((m) => m.user_id === userId) ?? null;
      rememberMyRole(groupId, me?.role ?? null);
      set({ members, myMemberId: me?.id ?? null, myRole: me?.role ?? null });
    } finally {
      set({ isLoadingMembers: false });
    }
  },

  loadAdminExtras: async (groupId) => {
    try {
      const [pendingRequests, pendingInvitations] = await Promise.all([
        fetchPendingJoinRequests(groupId),
        fetchPendingInvitations(groupId),
      ]);
      if (get().currentGroupId !== groupId) return;
      set({ pendingRequests, pendingInvitations });
    } catch (e) {
      if (__DEV__) console.warn('[group] admin extras failed', e);
    }
  },

  createGroup: async (name) => {
    const group = await createGroup(name);
    await get().loadGroups({ quiet: true });
    return group;
  },

  joinByCode: async (code, claimMemberId) => {
    await joinGroupByCode(code, claimMemberId);
    await get().loadMyPendingJoinRequests();
  },

  respondToInvitation: async (invitationId, action) => {
    const res = await respondToInvitation(invitationId, action);
    set((s) => ({
      myPendingInvitations: s.myPendingInvitations.filter((i) => i.invitation_id !== invitationId),
    }));
    if (action === 'accept') await get().loadGroups({ quiet: true });
    return res;
  },

  approveRequest: async (requestId, adoptMemberId) => {
    const groupId = get().currentGroupId;
    const group = get().currentGroup;
    if (!groupId || !group) return;
    await approveJoinRequest(requestId, groupId, group.name, adoptMemberId);
    await Promise.all([get().loadMembers(groupId), get().loadAdminExtras(groupId)]);
    void get().loadGroups({ quiet: true });
  },

  rejectRequest: async (requestId) => {
    const groupId = get().currentGroupId;
    const group = get().currentGroup;
    if (!groupId || !group) return;
    await rejectJoinRequest(requestId, groupId, group.name);
    await get().loadAdminExtras(groupId);
  },

  inviteMember: async (email) => {
    const groupId = get().currentGroupId;
    if (!groupId) return;
    await inviteMemberByEmail(groupId, email);
    await get().loadAdminExtras(groupId);
  },

  revokeInvite: async (invitationId) => {
    const groupId = get().currentGroupId;
    if (!groupId) return;
    const prev = get().pendingInvitations;
    set({ pendingInvitations: prev.filter((i) => i.id !== invitationId) });
    try {
      await revokeInvitation(invitationId);
    } catch (e) {
      set({ pendingInvitations: prev });
      throw e;
    }
  },

  addVirtualMember: async (name) => {
    const groupId = get().currentGroupId;
    if (!groupId) return;
    await addVirtualMember(groupId, name);
    await get().loadMembers(groupId);
    void get().loadGroups({ quiet: true });
  },

  renameMember: async (member, name) => {
    await renameMember(member, name);
    await get().loadMembers(member.group_id);
  },

  kickMember: async (member) => {
    await removeMember(member);
    await get().loadMembers(member.group_id);
    void get().loadGroups({ quiet: true });
  },

  renameGroup: async (name) => {
    const group = get().currentGroup;
    if (!group) return;
    if (name.trim() === group.name) return;
    // Version mới nhất từ server (avatar commit cũng bump version của groups).
    const fresh = await fetchGroupById(group.id);
    const row = await updateGroupName(group.id, name, fresh?.version ?? group.version ?? 1);
    set((s) => ({
      currentGroup: s.currentGroup ? { ...s.currentGroup, name: row.name, version: row.version } : s.currentGroup,
      groups: s.groups.map((g) => (g.id === group.id ? { ...g, name: row.name } : g)),
    }));
  },

  saveAvatar: async (image) => {
    const group = get().currentGroup;
    if (!group) return;
    const url = await saveGroupAvatar(group.id, image);
    set((s) => ({
      currentGroup: s.currentGroup ? { ...s.currentGroup, avatar_url: url } : s.currentGroup,
      groups: s.groups.map((g) => (g.id === group.id ? { ...g, avatar_url: url } : g)),
    }));
  },

  removeAvatar: async () => {
    const group = get().currentGroup;
    if (!group) return;
    await removeGroupAvatar(group.id);
    set((s) => ({
      currentGroup: s.currentGroup ? { ...s.currentGroup, avatar_url: null } : s.currentGroup,
      groups: s.groups.map((g) => (g.id === group.id ? { ...g, avatar_url: null } : g)),
    }));
  },

  removeGroup: async (groupId) => {
    await deleteGroup(groupId);
    set((s) => ({ groups: s.groups.filter((g) => g.id !== groupId) }));
    void get().loadGroups({ quiet: true });
  },

  reset: () => set({ ...initialState }),
}));
