import { Button, Skeleton } from '@heroui/react';
import { CircleAlert, FileDown, Info, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';

import { HeaderIconButton, PageHeader } from '../components/layout/PageHeader';
import { BalancesTab, MyBalanceExplanationSheet } from '../components/trip/BalancesTab';
import { ExpensesTab } from '../components/trip/ExpensesTab';
import { ExportSheet } from '../components/trip/ExportSheet';
import { HistoryTab } from '../components/trip/HistoryTab';
import { ManagementTab } from '../components/trip/ManagementTab';
import { SettlementTab } from '../components/trip/SettlementTab';
import { makeNameLookup } from '../components/trip/tripHelpers';
import { Money } from '../components/ui/Money';
import { EmptyState, Pill, SegmentedTabs } from '../components/ui/Primitives';
import type { GroupMember } from '../services/group.service';
import { useAuthStore } from '../stores/auth.store';
import { useGroupStore } from '../stores/group.store';
import { useTripStore } from '../stores/trip.store';
import { explainMyTripBalance } from '../utils/explainBalance';
import type { TripExportData } from '../utils/exportHtml';
import { formatDateVN } from '../utils/format';
import { showError } from '../utils/toast';

// Hằng rỗng cố định: selector Zustand trả `[]` mới mỗi lần sẽ gây render vô hạn (React #185).
const NO_MEMBERS: GroupMember[] = [];

type TripTab = 'expenses' | 'balances' | 'settlement' | 'history' | 'manage';
const TABS: { id: TripTab; label: string }[] = [
  { id: 'expenses', label: 'Chi phí' },
  { id: 'balances', label: 'Số dư' },
  { id: 'settlement', label: 'Quyết toán' },
  { id: 'history', label: 'Lịch sử' },
  { id: 'manage', label: 'Quản lý' },
];

export default function TripPage() {
  const { tripId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as TripTab | null;
  const tab: TripTab = TABS.some((t) => t.id === tabParam) ? (tabParam as TripTab) : 'expenses';

  const trip = useTripStore((s) => (s.currentTripId === tripId ? s.currentTrip : null));
  const loadError = useTripStore((s) => s.currentTripId === tripId && s.currentTripLoadError);
  const isLoadingTrip = useTripStore((s) => s.isLoadingTrip);
  const expenses = useTripStore((s) => s.expenses);
  const payments = useTripStore((s) => s.payments);
  const allMembers = useTripStore((s) => s.allMembers);
  const balances = useTripStore((s) => s.balances);
  const settlements = useTripStore((s) => s.settlements);
  const auditLogs = useTripStore((s) => s.auditLogs);
  const isLoadingAudit = useTripStore((s) => s.isLoadingAudit);
  const loadTrip = useTripStore((s) => s.loadTrip);
  const loadAuditLogs = useTripStore((s) => s.loadAuditLogs);
  const refreshCurrentTrip = useTripStore((s) => s.refreshCurrentTrip);

  const group = useGroupStore((s) => (trip && s.currentGroupId === trip.group_id ? s.currentGroup : null));
  const members = useGroupStore((s) => (trip && s.currentGroupId === trip.group_id ? s.members : NO_MEMBERS));
  const myMemberId = useGroupStore((s) => (trip && s.currentGroupId === trip.group_id ? s.myMemberId : null));
  const myRole = useGroupStore((s) => (trip && s.currentGroupId === trip.group_id ? s.myRole : null));
  const openGroup = useGroupStore((s) => s.openGroup);
  const loadBalanceSummary = useGroupStore((s) => s.loadBalanceSummary);
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);

  const [explainOpen, setExplainOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

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

  const nameOf = useMemo(() => makeNameLookup(allMembers), [allMembers]);
  const isAdmin = myRole === 'admin';
  const tripOpen = trip?.status === 'open';
  const totalSpent = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);

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

  const setTab = (t: TripTab) => setSearchParams(t === 'expenses' ? {} : { tab: t }, { replace: true });
  const afterMutation = () => {
    void refreshCurrentTrip();
    void loadBalanceSummary();
  };

  if (loadError) {
    return (
      <>
        <PageHeader title="Chuyến đi" back />
        <EmptyState
          icon={CircleAlert}
          title="Không mở được chuyến đi"
          subtitle="Chuyến đi có thể đã bị xóa hoặc không còn khả dụng."
          action={<Button onPress={() => navigate('/', { replace: true })}>Về trang chủ</Button>}
        />
      </>
    );
  }

  if (!trip) {
    return (
      <>
        <PageHeader title="Chuyến đi" back />
        <div className="space-y-4">
          <Skeleton className="h-44 rounded-3xl" />
          <Skeleton className="h-11 rounded-2xl" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[78px] rounded-2xl" />
          ))}
        </div>
      </>
    );
  }

  const myTotal = explanation?.totalBalance ?? 0;
  const showMine = !!myMemberId && (explanation?.lines.length ?? 0) > 0;
  const heroTint =
    showMine && myTotal > 0
      ? 'from-[color-mix(in_oklab,var(--money-positive)_14%,var(--surface))]'
      : showMine && myTotal < 0
        ? 'from-[color-mix(in_oklab,var(--money-negative)_12%,var(--surface))]'
        : 'from-surface-secondary';

  return (
    <>
      <PageHeader
        title={trip.name}
        subtitle={group?.name}
        back={`/groups/${trip.group_id}`}
        right={
          <HeaderIconButton label="Xuất PDF diễn giải" onClick={() => setExportOpen(true)}>
            <FileDown className="h-5 w-5" />
          </HeaderIconButton>
        }
      />

      <section
        className={`relative mb-5 overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br ${heroTint} to-surface p-5 shadow-surface`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {group ? (
              <Link
                to={`/groups/${trip.group_id}`}
                className="flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{group.name}</span>
              </Link>
            ) : null}
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Tổng chi</p>
            <Money value={totalSpent} size="hero" className={isLoadingTrip ? 'opacity-60' : ''} />
          </div>
          {!tripOpen ? (
            <Pill tone="success">
              Đã hoàn thành{trip.closed_at ? ` · ${formatDateVN(new Date(trip.closed_at))}` : ''}
            </Pill>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted">
          {expenses.length} khoản · {payments.length} thanh toán · {members.length} người
        </p>
        {showMine ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-surface/70 px-4 py-3 backdrop-blur">
            <span className="text-sm font-medium text-foreground">
              {myTotal > 0 ? 'Bạn được nợ' : myTotal < 0 ? 'Bạn đang nợ' : 'Bạn đã cân bằng'}
            </span>
            <span className="flex items-center gap-1">
              <Money
                value={Math.abs(myTotal)}
                size="lg"
                tone={myTotal > 0 ? 'success' : myTotal < 0 ? 'danger' : 'muted'}
              />
              <button
                type="button"
                aria-label="Xem cách tính số dư của bạn"
                title="Xem cách tính số dư của bạn"
                onClick={() => setExplainOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-surface-secondary hover:text-foreground"
              >
                <Info className="h-4 w-4" />
              </button>
            </span>
          </div>
        ) : null}
      </section>

      <SegmentedTabs ariaLabel="Mục của chuyến đi" className="mb-4" value={tab} onChange={setTab} tabs={TABS} />

      <div className="fade-up" key={tab}>
        {tab === 'expenses' ? (
          <ExpensesTab
            expenses={expenses}
            isLoading={isLoadingTrip}
            tripOpen={tripOpen}
            tripId={trip.id}
            nameOf={nameOf}
            canDelete={isAdmin}
            onDeleted={afterMutation}
          />
        ) : null}
        {tab === 'balances' ? <BalancesTab balances={balances} myMemberId={myMemberId} /> : null}
        {tab === 'settlement' ? (
          <SettlementTab
            settlements={settlements}
            payments={payments}
            balances={balances}
            activeMembers={members}
            myMemberId={myMemberId}
            myUserId={myUserId}
            isAdmin={isAdmin}
            tripOpen={tripOpen}
            nameOf={nameOf}
          />
        ) : null}
        {tab === 'history' ? <HistoryTab logs={auditLogs} isLoading={isLoadingAudit} nameOf={nameOf} /> : null}
        {tab === 'manage' ? <ManagementTab trip={trip} isAdmin={isAdmin} /> : null}
      </div>

      <MyBalanceExplanationSheet
        isOpen={explainOpen}
        onOpenChange={setExplainOpen}
        tripName={trip.name}
        explanation={explanation}
      />
      <ExportSheet isOpen={exportOpen} onOpenChange={setExportOpen} members={members} buildData={buildExportData} />
    </>
  );
}
