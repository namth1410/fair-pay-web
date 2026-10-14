import { FileDown, X } from 'lucide-react';
import { useState } from 'react';

import type { GroupMember } from '../../services/group.service';
import type { Trip } from '../../services/trip.service';
import { useAuthStore } from '../../stores/auth.store';
import { useGroupStore } from '../../stores/group.store';
import { useTripStore } from '../../stores/trip.store';
import type { TripExportData } from '../../utils/exportHtml';
import { HeaderIconButton } from '../layout/LargeTitleHeader';
import { PageHeader } from '../layout/PageHeader';
import { SegmentedTabs } from '../ui/Primitives';
import { BalancesTab } from './BalancesTab';
import { ExportSheet } from './ExportSheet';
import { HistoryTab } from './HistoryTab';
import { ManagementTab } from './ManagementTab';
import { SettlementTab } from './SettlementTab';

export type TripInfoTab = 'balances' | 'settlement' | 'history' | 'manage';

const TABS: { id: TripInfoTab; label: string }[] = [
  { id: 'balances', label: 'Số dư' },
  { id: 'settlement', label: 'Quyết toán' },
  { id: 'history', label: 'Lịch sử' },
  { id: 'manage', label: 'Quản lý' },
];

const NO_MEMBERS: GroupMember[] = [];

/**
 * "Thông tin chuyến" (nút ⓘ ở luồng): Số dư / Quyết toán / Lịch sử / Quản lý + xuất PDF. Desktop
 * là panel phải cạnh luồng; điện thoại là trang riêng (khớp màn trips/[id]/info của app).
 */
export function TripInfo({
  trip,
  tab,
  onTabChange,
  onBack,
  nameOf,
  buildExportData,
  isPanel,
  onClose,
}: {
  trip: Trip;
  tab: TripInfoTab;
  onTabChange: (tab: TripInfoTab) => void;
  /** Điện thoại: nút quay lại về luồng. */
  onBack: string;
  nameOf: (id: string) => string;
  buildExportData: () => TripExportData;
  /** true = panel phải trên desktop (không có nút quay lại). */
  isPanel: boolean;
  /** Panel: đóng về luồng. */
  onClose?: () => void;
}) {
  const balances = useTripStore((s) => s.balances);
  const settlements = useTripStore((s) => s.settlements);
  const payments = useTripStore((s) => s.payments);
  const auditLogs = useTripStore((s) => s.auditLogs);
  const isLoadingAudit = useTripStore((s) => s.isLoadingAudit);
  const members = useGroupStore((s) => (s.currentGroupId === trip.group_id ? s.members : NO_MEMBERS));
  const myMemberId = useGroupStore((s) => (s.currentGroupId === trip.group_id ? s.myMemberId : null));
  const isAdmin = useGroupStore((s) => s.currentGroupId === trip.group_id && s.myRole === 'admin');
  const myUserId = useAuthStore((s) => s.profile?.id ?? null);
  const [exportOpen, setExportOpen] = useState(false);
  const tripOpen = trip.status === 'open';

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PageHeader
        back={isPanel ? undefined : onBack}
        title={isPanel ? 'Thông tin chuyến' : trip.name}
        subtitle={isPanel ? trip.name : 'Thông tin chuyến'}
        right={
          <>
            <HeaderIconButton icon={FileDown} label="Xuất PDF diễn giải" onClick={() => setExportOpen(true)} variant="ghost" />
            {isPanel && onClose ? <HeaderIconButton icon={X} label="Đóng thông tin chuyến" onClick={onClose} variant="ghost" /> : null}
          </>
        }
      />
      <div className="shrink-0 bg-surface px-4 pb-2.5 pt-1.5">
        <SegmentedTabs ariaLabel="Mục thông tin chuyến" value={tab} onChange={onTabChange} tabs={TABS} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="fade-up mx-auto w-full max-w-3xl px-4 pb-10 pt-3" key={tab}>
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
      </div>

      <ExportSheet isOpen={exportOpen} onOpenChange={setExportOpen} members={members} buildData={buildExportData} />
    </div>
  );
}
