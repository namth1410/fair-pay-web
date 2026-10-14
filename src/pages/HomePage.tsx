import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';
import { useEffect } from 'react';

import { GroupsPane } from '../components/home/GroupsPane';
import { ChatLayout } from '../components/layout/ChatLayout';
import { useIsWide } from '../hooks/useMediaQuery';
import { useGroupStore } from '../stores/group.store';
import { useNotificationStore } from '../stores/notification.store';
import { useTripStore } from '../stores/trip.store';
import { useUIStore } from '../stores/ui.store';
import { showError } from '../utils/toast';

/**
 * Trang Nhóm. Điện thoại: danh sách nhóm kiểu đoạn chat (như app). Desktop: cột danh sách +
 * khung chính chào mừng — chọn nhóm thì cột danh sách chuyển sang các chuyến của nhóm.
 */
export default function HomePage() {
  const groupsLoaded = useGroupStore((s) => s.groupsLoaded);
  const loadGroups = useGroupStore((s) => s.loadGroups);
  const loadPinnedTrips = useTripStore((s) => s.loadPinnedTrips);
  const refreshUnreadCount = useNotificationStore((s) => s.refreshUnreadCount);
  const wide = useIsWide();

  useEffect(() => {
    void loadGroups({ quiet: groupsLoaded }).catch((e) => showError(e, 'Không tải được nhóm'));
    void loadPinnedTrips();
    void refreshUnreadCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!wide) return <GroupsPane />;
  return <ChatLayout list={<GroupsPane />} main={<HomeWelcome />} />;
}

/** Khung chính khi chưa chọn nhóm (desktop). */
function HomeWelcome() {
  const setQuickAddOpen = useUIStore((s) => s.setQuickAddOpen);
  const openCreateJoin = useUIStore((s) => s.openCreateJoin);

  return (
    <div className="flex h-full flex-col items-center justify-center bg-background px-8 text-center">
      <img src="/mascot.webp" alt="" draggable={false} className="h-40 w-40 select-none object-contain" />
      <h2 className="mt-5 text-2xl font-extrabold tracking-[-0.02em] text-foreground">Chọn một nhóm để bắt đầu</h2>
      <p className="mt-2 max-w-sm text-[15px] leading-6 text-muted">
        Mỗi nhóm như một cuộc trò chuyện: chuyến đi là các luồng, mỗi khoản chi là một tin nhắn.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onPress={() => setQuickAddOpen(true)}>
          <Plus className="h-4 w-4" strokeWidth={2.4} /> Thêm khoản chi
        </Button>
        <Button variant="secondary" onPress={() => openCreateJoin('create')}>
          Tạo nhóm / nhập mã mời
        </Button>
      </div>
    </div>
  );
}
