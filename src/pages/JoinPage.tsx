import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router';

import { useUIStore } from '../stores/ui.store';

/**
 * Link mời `/join/<mã>` (chia sẻ từ tab Thành viên): mở sheet "Tham gia nhóm" với
 * mã điền sẵn rồi về trang chủ. Chưa đăng nhập → RequireAuth đưa qua /login?next=…
 */
export default function JoinPage() {
  const { code = '' } = useParams();
  const openCreateJoin = useUIStore((s) => s.openCreateJoin);

  useEffect(() => {
    openCreateJoin('join', decodeURIComponent(code).trim());
  }, [code, openCreateJoin]);

  return <Navigate to="/" replace />;
}
