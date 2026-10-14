import { Bell, MessagesSquare, Plus, UserRound, Zap } from 'lucide-react';
import { type ReactNode, Suspense } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { useNotificationStore } from '../../stores/notification.store';
import { useUIStore } from '../../stores/ui.store';
import { PageSpinner } from '../ui/PageSpinner';

const NAV = [
  { to: '/', label: 'Nhóm', icon: MessagesSquare, end: true },
  { to: '/presets', label: 'Preset', icon: Zap, end: false },
  { to: '/notifications', label: 'Thông báo', icon: Bell, end: false },
  { to: '/settings', label: 'Cài đặt', icon: UserRound, end: false },
] as const;

/** Mục 'Nhóm' sáng cả khi đang trong 1 nhóm / chuyến / form khoản chi (cùng luồng). */
function isGroupsArea(pathname: string): boolean {
  return pathname === '/' || /^\/(groups|trips|expenses|join)(\/|$)/.test(pathname);
}

/** Trang có thanh tab dưới đáy trên điện thoại (giống AppDock của app). */
const TAB_PATHS = ['/', '/presets', '/notifications', '/settings'];

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-2 -top-1.5 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-danger-foreground ring-2 ring-[var(--rail-bg,var(--surface))]">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function NavIcon({ icon: Icon, badge }: { icon: (typeof NAV)[number]['icon']; badge: number }) {
  return (
    <span className="relative">
      <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
      <Badge count={badge} />
    </span>
  );
}

/** Thanh icon dọc bên trái (≥ md): logo rồng → nút thêm khoản chi → các mục chính. */
function IconRail() {
  const unread = useNotificationStore((s) => s.unreadCount);
  const setQuickAddOpen = useUIStore((s) => s.setQuickAddOpen);
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Điều hướng chính"
      className="hidden w-[76px] shrink-0 flex-col items-center border-r border-border bg-background py-4 [--rail-bg:var(--background)] md:flex"
    >
      <NavLink to="/" aria-label="Fair Pay — trang chủ" className="mb-4 block">
        <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-brand-soft">
          <img src="/dragon-receipt.png" alt="" className="mt-2 h-[62px] w-[62px] max-w-none object-cover" draggable={false} />
        </span>
      </NavLink>

      <button
        type="button"
        aria-label="Thêm khoản chi"
        title="Thêm khoản chi"
        onClick={() => setQuickAddOpen(true)}
        className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-sm transition-transform active:scale-95"
      >
        <Plus className="h-6 w-6" strokeWidth={2.4} />
      </button>

      <div className="flex flex-col items-center gap-1.5">
        {NAV.map(({ to, label, icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex w-[64px] flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold transition-colors ${
                (to === '/' ? isGroupsArea(pathname) : isActive)
                  ? 'bg-primary-soft text-accent'
                  : 'text-muted hover:bg-surface-secondary hover:text-foreground'
              }`
            }
          >
            <NavIcon icon={icon} badge={to === '/notifications' ? unread : 0} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function TabLink({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold ${
          isActive ? 'text-accent' : 'text-muted'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

/** Thanh tab phẳng dưới đáy (< md) — y như AppDock của app: 4 mục + nút + ở giữa. */
function MobileTabBar() {
  const unread = useNotificationStore((s) => s.unreadCount);
  const quickAddOpen = useUIStore((s) => s.quickAddOpen);
  const setQuickAddOpen = useUIStore((s) => s.setQuickAddOpen);
  const [home, presets, notifications, settings] = NAV;

  return (
    <nav
      aria-label="Điều hướng chính"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-xl [--rail-bg:var(--surface)] md:hidden"
    >
      <div className="mx-auto flex h-16 max-w-lg items-start">
        <TabLink to={home.to} end>
          <NavIcon icon={home.icon} badge={0} />
          {home.label}
        </TabLink>
        <TabLink to={presets.to}>
          <NavIcon icon={presets.icon} badge={0} />
          {presets.label}
        </TabLink>
        <div className="flex flex-1 justify-center pt-1.5">
          <button
            type="button"
            aria-label="Thêm khoản chi mới"
            onClick={() => setQuickAddOpen(true)}
            className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition-transform active:scale-95"
          >
            <Plus
              className={`h-6 w-6 transition-transform duration-200 ${quickAddOpen ? 'rotate-45' : ''}`}
              strokeWidth={2.4}
            />
          </button>
        </div>
        <TabLink to={notifications.to}>
          <NavIcon icon={notifications.icon} badge={unread} />
          {notifications.label}
        </TabLink>
        <TabLink to={settings.to}>
          <NavIcon icon={settings.icon} badge={0} />
          {settings.label}
        </TabLink>
      </div>
    </nav>
  );
}

/**
 * Khung trang đã đăng nhập (giao diện "Hội thoại"): thanh icon trái (≥ md) + vùng nội dung
 * cao đúng màn hình (mỗi vùng con tự cuộn) + thanh tab đáy trên điện thoại.
 */
export function AppShell() {
  const { pathname } = useLocation();
  const isTabPage = TAB_PATHS.includes(pathname);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <IconRail />
      <div
        className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${
          isTabPage ? 'pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0' : ''
        }`}
      >
        <Suspense fallback={<PageSpinner />}>
          <Outlet />
        </Suspense>
      </div>
      {isTabPage ? <MobileTabBar /> : null}
    </div>
  );
}
