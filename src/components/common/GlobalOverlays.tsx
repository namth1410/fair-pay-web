import { useEffect } from 'react';

import { useForegroundRefresh, useNotificationRealtime } from '../../hooks/useRealtime';
import { useNotificationStore } from '../../stores/notification.store';
import { CreateJoinSheet } from './CreateJoinSheet';
import { QuickAddSheet } from './QuickAddSheet';
import { WelcomeDialog } from './WelcomeDialog';

/** Overlay + kết nối nền dùng chung cho mọi trang đã đăng nhập. */
export function GlobalOverlays() {
  useNotificationRealtime();
  useForegroundRefresh();

  const refreshUnreadCount = useNotificationStore((s) => s.refreshUnreadCount);
  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  return (
    <>
      <CreateJoinSheet />
      <QuickAddSheet />
      <WelcomeDialog />
    </>
  );
}
