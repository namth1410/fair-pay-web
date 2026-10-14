import { Button } from '@heroui/react';
import { CircleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo } from 'react';
import { useMatch, useNavigate, useParams, useSearchParams } from 'react-router';

import { GroupTripsPane } from '../components/group/GroupTripsPane';
import { ChatLayout } from '../components/layout/ChatLayout';
import { PageFrame, PageHeader } from '../components/layout/PageHeader';
import { makeNameLookup } from '../components/trip/tripHelpers';
import { TripInfo, type TripInfoTab } from '../components/trip/TripInfo';
import { TripThread } from '../components/trip/TripThread';
import { EmptyState } from '../components/ui/Primitives';
import { Bone } from '../components/ui/Skeleton';
import { useIsWide } from '../hooks/useMediaQuery';
import type { GroupMember } from '../services/group.service';
import { useGroupStore } from '../stores/group.store';
import { useTripStore } from '../stores/trip.store';
import { explainMyTripBalance } from '../utils/explainBalance';
import type { TripExportData } from '../utils/exportHtml';
import { showError } from '../utils/toast';

const NO_MEMBERS: GroupMember[] = [];
const INFO_TABS: TripInfoTab[] = ['balances', 'settlement', 'history', 'manage'];

/**
 * Chuyến đi (giao diện "Hội thoại"). `/trips/:id` = luồng chat; `/trips/:id/info` = Thông tin
 * chuyến — desktop: panel phải cạnh luồng (cột trái là các chuyến của nhóm); điện thoại: trang riêng.
 */
export default function TripPage() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const infoMatch = useMatch('/trips/:tripId/info');
  const infoOpen = infoMatch !== null;
  const wide = useIsWide();

  const trip = useTripStore((s) => (s.currentTripId === tripId ? s.currentTrip : null));
  const loadError = useTripStore((s) => s.currentTripId === tripId && s.currentTripLoadError);
  const expenses = useTripStore((s) => s.expenses);
  const payments = useTripStore((s) => s.payments);
  const allMembers = useTripStore((s) => s.allMembers);
  const balances = useTripStore((s) => s.balances);
  const settlements = useTripStore((s) => s.settlements);
  const currentTripsGroupId = useTripStore((s) => s.currentTripsGroupId);
  const loadTrip = useTripStore((s) => s.loadTrip);
  const loadTrips = useTripStore((s) => s.loadTrips);
  const loadAuditLogs = useTripStore((s) => s.loadAuditLogs);
  const refreshCurrentTrip = useTripStore((s) => s.refreshCurrentTrip);

  const group = useGroupStore((s) => (trip && s.currentGroupId === trip.group_id ? s.currentGroup : null));
  const members = useGroupStore((s) => (trip && s.currentGroupId === trip.group_id ? s.members : NO_MEMBERS));
  const myMemberId = useGroupStore((s) => (trip && s.currentGroupId === trip.group_id ? s.myMemberId : null));
  const openGroup = useGroupStore((s) => s.openGroup);
  const loadBalanceSummary = useGroupStore((s) => s.loadBalanceSummary);

  useEffect(() => {
    void loadTrip(tripId).catch((e) => showError(e, 'Không tải được chuyến đi'));
    void loadAuditLogs(tripId).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId]);

  const tripGroupId = trip?.group_id;
  useEffect(() => {
    if (!tripGroupId) return;
    void openGroup(tripGroupId, { quiet: true }).catch(() => {});
  }, [tripGroupId, openGroup]);

  // Desktop: cột trái liệt kê các chuyến của nhóm → nạp nếu đang giữ danh sách nhóm khác.
  useEffect(() => {
    if (!wide || !tripGroupId || currentTripsGroupId === tripGroupId) return;
    void loadTrips(tripGroupId, { quiet: true }).catch(() => {});
  }, [wide, tripGroupId, currentTripsGroupId, loadTrips]);

  const nameOf = useMemo(() => makeNameLookup(allMembers), [allMembers]);

  const explanation = useMemo(() => {
    if (!myMemberId) return null;
    return explainMyTripBalance(
      myMemberId,
      allMembers.map((m) => ({ id: m.id, displayName: m.displayName })),
      expenses.map((e) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        paidBy: e.paid_by,
        date: e.date,
        splits: e.expense_splits.map((s) => ({ memberId: s.member_id, amount: s.amount })),
      })),
      payments.map((p) => ({
        id: p.id,
        fromMemberId: p.from_member_id,
        toMemberId: p.to_member_id,
        amount: p.amount,
        date: p.date,
      })),
    );
  }, [myMemberId, allMembers, expenses, payments]);

  const buildExportData = (): TripExportData => ({
    tripName: trip?.name ?? 'Chuyến đi',
    groupName: group?.name ?? '',
    generatedAt: new Date().toISOString(),
    status: trip?.status ?? 'open',
    closedAt: trip?.closed_at ?? null,
    members: members.map((m) => ({ id: m.id, displayName: m.display_name, isVirtual: m.is_virtual })),
    expenses: expenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: e.amount,
      paidBy: e.paid_by,
      date: e.date,
      note: e.note,
      splits: e.expense_splits.map((s) => ({ memberId: s.member_id, amount: s.amount })),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      fromMemberId: p.from_member_id,
      toMemberId: p.to_member_id,
      amount: p.amount,
      date: p.date,
      note: p.note,
    })),
    balances,
    settlements,
  });

  const tabParam = searchParams.get('tab') as TripInfoTab | null;
  const infoTab: TripInfoTab = tabParam && INFO_TABS.includes(tabParam) ? tabParam : 'balances';

  const openInfo = useCallback(
    (tab?: string) => {
      // Bấm ⓘ khi panel đang mở (không chọn tab cụ thể) → đóng, như nút bật/tắt.
      if (infoOpen && !tab) {
        navigate(`/trips/${tripId}`, { replace: true });
        return;
      }
      const qs = tab && tab !== 'balances' ? `?tab=${tab}` : '';
      navigate(`/trips/${tripId}/info${qs}`, { replace: infoOpen });
    },
    [infoOpen, navigate, tripId],
  );
  const closeInfo = useCallback(() => navigate(`/trips/${tripId}`, { replace: true }), [navigate, tripId]);
  const setInfoTab = (tab: TripInfoTab) =>
    navigate(`/trips/${tripId}/info${tab === 'balances' ? '' : `?tab=${tab}`}`, { replace: true });

  const afterMutation = () => {
    void refreshCurrentTrip();
    void loadBalanceSummary();
  };

  if (loadError) {
    return (
      <PageFrame header={<PageHeader title="Chuyến đi" back />}>
        <EmptyState
          icon={CircleAlert}
          title="Không mở được chuyến đi"
          subtitle="Chuyến đi có thể đã bị xóa hoặc không còn khả dụng."
          action={<Button onPress={() => navigate('/', { replace: true })}>Về trang Nhóm</Button>}
        />
      </PageFrame>
    );
  }

  if (!trip) {
    const skeleton = <TripThreadSkeleton />;
    if (!wide) return skeleton;
    return <ChatLayout main={skeleton} />;
  }

  const info = (
    <TripInfo
      trip={trip}
      tab={infoTab}
      onTabChange={setInfoTab}
      onBack={`/trips/${trip.id}`}
      nameOf={nameOf}
      buildExportData={buildExportData}
      isPanel={wide}
      onClose={closeInfo}
    />
  );
  const thread = (
    <TripThread
      trip={trip}
      explanation={explanation}
      onOpenInfo={openInfo}
      infoOpen={infoOpen}
      afterMutation={afterMutation}
    />
  );

  if (!wide) return infoOpen ? info : thread;
  return (
    <ChatLayout
      list={<GroupTripsPane groupId={trip.group_id} activeTripId={trip.id} />}
      main={thread}
      aside={infoOpen ? info : undefined}
      onCloseAside={closeInfo}
      asideLabel="Thông tin chuyến"
    />
  );
}

/** Skeleton luồng chuyến đi: header + banner + bong bóng hai phía + ô soạn (khớp app). */
function TripThreadSkeleton() {
  const bubbles: { mine: boolean; w: string }[] = [
    { mine: false, w: '64%' },
    { mine: true, w: '58%' },
    { mine: true, w: '50%' },
    { mine: false, w: '60%' },
  ];
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface" role="progressbar" aria-label="Đang tải chuyến đi" aria-busy="true">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-3">
        <Bone w={40} h={40} r={20} />
        <div className="flex-1 space-y-2">
          <Bone w="40%" h={13} />
          <Bone w="28%" h={10} />
        </div>
      </div>
      <div className="flex min-h-14 shrink-0 items-center gap-2.5 bg-brand-soft px-4 py-2">
        <div className="flex-1 space-y-2">
          <span className="block h-3.5 w-[56%] rounded-md bg-brand-border" />
          <span className="block h-2.5 w-[74%] rounded bg-brand-border" />
        </div>
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col justify-end px-3 py-3 sm:px-5">
        <div className="my-2.5 flex justify-center">
          <Bone w={112} h={24} r={12} />
        </div>
        {bubbles.map((b, i) =>
          b.mine ? (
            <div key={i} className="my-1 flex justify-end pl-14">
              <span className="bone block h-[84px] rounded-[20px] rounded-br-md !bg-primary-soft" style={{ width: b.w }} />
            </div>
          ) : (
            <div key={i} className="my-1 flex items-end gap-2 pr-12">
              <Bone w={28} h={28} r={14} />
              <span className="bone block h-[84px] rounded-[20px] rounded-bl-md !bg-bubble-other" style={{ width: b.w }} />
            </div>
          ),
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 pb-2.5 pt-2.5">
        <Bone w={44} h={44} r={22} />
        <span className="bone block h-11 flex-1 rounded-full" />
        <span className="bone block h-11 w-11 rounded-full !bg-primary-soft" />
      </div>
    </div>
  );
}
