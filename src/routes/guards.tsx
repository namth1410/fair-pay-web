import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { SplashScreen } from '../components/ui/PageSpinner';
import { useAuthStore } from '../stores/auth.store';

/** Chưa đăng nhập → /login?next=<trang đang mở>. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session = useAuthStore((s) => s.session);
  const location = useLocation();

  if (!isInitialized) return <SplashScreen />;
  if (!session) {
    const next = location.pathname + location.search;
    const qs = next && next !== '/' ? `?next=${encodeURIComponent(next)}` : '';
    return <Navigate to={`/login${qs}`} replace />;
  }
  return <>{children}</>;
}

/** Trang auth: đã đăng nhập → về `next` (chỉ nhận path nội bộ) hoặc home. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const session = useAuthStore((s) => s.session);
  const location = useLocation();

  if (!isInitialized) return <SplashScreen />;
  if (session) {
    const next = new URLSearchParams(location.search).get('next');
    const safe = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    return <Navigate to={safe} replace />;
  }
  return <>{children}</>;
}
