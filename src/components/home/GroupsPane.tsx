import { Button } from '@heroui/react';
import { Mail, SquarePen, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { MyPendingInvitation } from '../../services/group.service';
import { useGroupStore } from '../../stores/group.store';
import { useUIStore } from '../../stores/ui.store';
import { InvitationConfirmDialog } from '../group/InvitationConfirmDialog';
import { HeaderIconButton, LargeTitleHeader } from '../layout/LargeTitleHeader';
import { EmptyState } from '../ui/Primitives';
import { Bone, RowsSkeleton } from '../ui/Skeleton';
import { DragonSummaryBubble } from './DragonSummaryBubble';
import { GroupChatRow } from './GroupChatRow';
import { PinPickerSheet } from './PinPickerSheet';
import { TripStoriesRow } from './TripStoriesRow';

// Ribbon "đang chờ duyệt" đã đóng — chỉ trong phiên (sống qua đổi trang, mất khi reload).
const dismissedRibbons = new Set<string>();

/**
 * Danh sách nhóm kiểu đoạn chat (giao diện "Hội thoại"): tiêu đề lớn "Nhóm", hàng story chuyến
 * ghim, rồng tổng kết số dư, rồi các nhóm. Là cả trang Nhóm trên điện thoại và cột danh sách
 * trên desktop.
 */
export function GroupsPane({ activeGroupId }: { activeGroupId?: string }) {
  const groups = useGroupStore((s) => s.groups);
  const groupsLoaded = useGroupStore((s) => s.groupsLoaded);
  const isLoading = useGroupStore((s) => s.isLoadingGroups);
  const balanceSummary = useGroupStore((s) => s.balanceSummary);
  const pendingRequests = useGroupStore((s) => s.myPendingJoinRequests);
  const invitations = useGroupStore((s) => s.myPendingInvitations);
  const openCreateJoin = useUIStore((s) => s.openCreateJoin);

  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [activeInvitation, setActiveInvitation] = useState<MyPendingInvitation | null>(null);
  const [, forceRender] = useState(0);

  // Tổng được nhận / đang nợ tính trên các nhóm đang hiện — câu tổng kết của rồng luôn khớp
  // danh sách bên dưới.
  const { owed, owing } = useMemo(() => {
    let pos = 0;
    let neg = 0;
    for (const g of groups) {
      const b = balanceSummary.groupBalances[g.id] ?? 0;
      if (b > 0) pos += b;
      else if (b < 0) neg += -b;
    }
    return { owed: pos, owing: neg };
  }, [groups, balanceSummary.groupBalances]);

  const ribbons = pendingRequests.filter((r) => !dismissedRibbons.has(r.request_id));
  const showSkeleton = (isLoading || !groupsLoaded) && groups.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <LargeTitleHeader
        title="Nhóm"
        right={
          <HeaderIconButton icon={SquarePen} label="Tạo nhóm hoặc nhập mã mời" onClick={() => openCreateJoin('create')} />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {showSkeleton ? (
          <HomeSkeleton />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa có nhóm nào"
            subtitle="Tạo nhóm mới hoặc nhập mã mời để bắt đầu"
            className="pt-16"
            action={
              <div className="flex gap-2">
                <Button onPress={() => openCreateJoin('create')}>Tạo nhóm</Button>
                <Button variant="secondary" onPress={() => openCreateJoin('join')}>
                  Nhập mã mời
                </Button>
              </div>
            }
          />
        ) : (
          <>
            <div className="pt-0.5">
              <TripStoriesRow onPinPress={() => setPinPickerOpen(true)} />
            </div>

            {ribbons.length > 0 ? (
              <div className="mt-3 space-y-1.5 px-4">
                {ribbons.map((r) => (
                  <div
                    key={r.request_id}
                    className="flex items-center gap-2.5 rounded-2xl bg-[color-mix(in_oklab,var(--warning)_14%,var(--surface))] py-2 pl-3.5 pr-1.5"
                  >
                    <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-warning" />
                    <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                      Đang chờ duyệt vào <b>“{r.group_name}”</b>
                    </p>
                    <button
                      type="button"
                      aria-label="Đóng thông báo"
                      onClick={() => {
                        dismissedRibbons.add(r.request_id);
                        forceRender((n) => n + 1);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-secondary hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="mb-2 mt-[18px]">
              <DragonSummaryBubble owed={owed} owing={owing} groupCount={groups.length} />
            </div>

            {invitations.length > 0 ? (
              <ul className="mt-1">
                {invitations.map((inv) => (
                  <li key={inv.invitation_id}>
                    <button
                      type="button"
                      onClick={() => setActiveInvitation(inv)}
                      className="flex min-h-[76px] w-full items-center gap-3 pl-4 text-left transition-colors hover:bg-surface-secondary"
                    >
                      <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-accent">
                        <Mail className="h-6 w-6" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col self-stretch justify-center border-b border-border py-3 pr-4">
                        <span className="truncate text-base font-bold text-foreground">Lời mời vào “{inv.group_name}”</span>
                        <span className="mt-0.5 truncate text-[13px] text-accent">
                          {inv.inviter_name || 'Quản trị viên'} mời bạn · bấm để trả lời
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <ul className="mt-1" aria-label="Nhóm của bạn">
              {groups.map((g) => (
                <li key={g.id} className="fade-up">
                  <GroupChatRow
                    id={g.id}
                    name={g.name}
                    avatarUrl={g.avatar_url}
                    memberCount={g.member_count}
                    balance={balanceSummary.groupBalances[g.id] ?? 0}
                    active={g.id === activeGroupId}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <PinPickerSheet isOpen={pinPickerOpen} onOpenChange={setPinPickerOpen} />
      <InvitationConfirmDialog invitation={activeInvitation} onClose={() => setActiveInvitation(null)} />
    </div>
  );
}

/** Skeleton danh sách nhóm: hàng story + bong bóng rồng + dòng nhóm (khớp HomeSkeleton của app). */
function HomeSkeleton() {
  return (
    <div role="progressbar" aria-label="Đang tải nhóm" aria-busy="true" className="pt-0.5">
      <div className="flex gap-1.5 overflow-hidden px-3">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex w-[74px] shrink-0 flex-col items-center gap-1.5">
            <Bone w={64} h={64} r={32} />
            <Bone w={46} h={10} r={5} className="mt-[3px]" />
          </div>
        ))}
      </div>
      <div className="mx-4 mb-2 mt-[18px] flex items-end gap-2">
        <Bone w={40} h={40} r={20} />
        <div className="flex-1 rounded-[20px] rounded-bl-md bg-bubble-other px-3.5 pb-4 pt-3.5">
          <Bone w="32%" h={10} r={5} />
          <Bone w="92%" h={13} className="mt-2.5" />
          <Bone w="64%" h={13} className="mt-2.5" />
          <Bone w="48%" h={22} r={8} className="mt-3.5" />
        </div>
      </div>
      <div className="mt-1">
        <RowsSkeleton count={5} />
      </div>
    </div>
  );
}
