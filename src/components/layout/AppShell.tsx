import { Bell, Bookmark, House, Plus, Settings } from 'lucide-react';
import { type ReactNode, Suspense, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { useAuthStore } from '../../stores/auth.store';
import { useNotificationStore } from '../../stores/notification.store';
import { useUIStore } from '../../stores/ui.store';
import { Wordmark } from '../brand/Wordmark';
import { Avatar } from '../ui/Avatar';
import { PageSpinner } from '../ui/PageSpinner';

const NAV = [
  { to: '/', label: 'Trang chủ', icon: House, end: true },
  { to: '/presets', label: 'Preset khoản chi', icon: Bookmark, end: false },
  { to: '/notifications', label: 'Thông báo', icon: Bell, end: false },
  { to: '/settings', label: 'Cài đặt', icon: Settings, end: false },
] as const;

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1 min-w-[18px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[18px] text-danger-foreground ring-2 ring-background">
      {count > 9 ? '9+' : count}
    </span>
  );
}

function Sidebar() {
  const profile = useAuthStore((s) => s.profile);
  const unread = useNotificationStore((s) => s.unreadCount);
  const setQuickAddOpen = useUIStore((s) => s.setQuickAddOpen);

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-surface/60 px-4 py-6 backdrop-blur-xl lg:flex">
      <NavLink to="/" className="mb-8 px-3">
        <Wordmark size="sm" />
      </NavLink>

      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        className="mb-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-foreground shadow-sm transition-transform active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} />
        Thêm khoản chi
      </button>

      <nav className="flex flex-col gap-1" aria-label="Điều hướng chính">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-surface-secondary text-foreground'
                  : 'text-muted hover:bg-surface-secondary/60 hover:text-foreground'
              }`
            }
          >
            <span className="relative">
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
              {to === '/notifications' ? <Badge count={unread} /> : null}
            </span>
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        {profile ? (
          <NavLink
            to="/settings"
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-secondary/60"
          >
            <Avatar seed={profile.display_name || profile.email} label={profile.display_name} photoUrl={profile.photo_url} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{profile.display_name}</span>
              <span className="block truncate text-xs text-muted">{profile.email}</span>
            </span>
          </NavLink>
        ) : null}
      </div>
    </aside>
  );
}

function DockLink({ to, label, end, children }: { to: string; label: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={label}
      className={({ isActive }) =>
        `relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
          isActive ? 'bg-foreground text-background' : 'text-muted hover:text-foreground'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

/** Thanh điều hướng nổi dưới đáy (mobile) — mô phỏng AppDock của app. */
function MobileDock() {
  const unread = useNotificationStore((s) => s.unreadCount);
  const quickAddOpen = useUIStore((s) => s.quickAddOpen);
  const setQuickAddOpen = useUIStore((s) => s.setQuickAddOpen);
  const { pathname } = useLocation();
  const isTabPage = ['/', '/presets', '/notifications', '/settings'].includes(pathname);
  if (!isTabPage) return null;

  return (
    <nav
      aria-label="Điều hướng chính"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-3 lg:hidden"
    >
      <div className="mb-[env(safe-area-inset-bottom)] flex items-center gap-1 rounded-full border border-border bg-surface/85 p-1.5 shadow-overlay backdrop-blur-xl">
        <DockLink to="/" label="Trang chủ" end>
          <House className="h-5 w-5" />
        </DockLink>
        <DockLink to="/presets" label="Preset khoản chi">
          <Bookmark className="h-5 w-5" />
        </DockLink>
        <button
          type="button"
          aria-label="Thêm khoản chi mới"
          onClick={() => setQuickAddOpen(true)}
          className="mx-1 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition-transform active:scale-95"
        >
          <Plus
            className={`h-6 w-6 transition-transform duration-200 ${quickAddOpen ? 'rotate-45' : ''}`}
            strokeWidth={2.5}
          />
        </button>
        <DockLink to="/notifications" label={`Thông báo, ${unread} chưa đọc`}>
          <span className="relative">
            <Bell className="h-5 w-5" />
            <Badge count={unread} />
          </span>
        </DockLink>
        <DockLink to="/settings" label="Cài đặt">
          <Settings className="h-5 w-5" />
        </DockLink>
      </div>
    </nav>
  );
}

/** Khung trang đã đăng nhập: sidebar (desktop) + dock (mobile) + nội dung. */
export function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-3xl px-4 pb-32 sm:px-6 lg:max-w-4xl lg:px-10 lg:pb-16">
          <Suspense fallback={<PageSpinner />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
      <MobileDock />
    </div>
  );
}
