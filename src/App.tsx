import { Toast } from '@heroui/react';
import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, Outlet, RouterProvider } from 'react-router';

import { GlobalOverlays } from './components/common/GlobalOverlays';
import { AppShell } from './components/layout/AppShell';
import { PageSpinner, SplashScreen } from './components/ui/PageSpinner';
import { PublicOnly, RequireAuth } from './routes/guards';
import { useAuthStore } from './stores/auth.store';

const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const GroupPage = lazy(() => import('./pages/GroupPage'));
const TripPage = lazy(() => import('./pages/TripPage'));
const ExpenseFormPage = lazy(() => import('./pages/ExpenseFormPage'));
const PresetsPage = lazy(() => import('./pages/PresetsPage'));
const PresetFormPage = lazy(() => import('./pages/PresetFormPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function AuthenticatedLayout() {
  return (
    <RequireAuth>
      <AppShell />
      <GlobalOverlays />
    </RequireAuth>
  );
}

function PublicLayout() {
  return (
    <PublicOnly>
      <Suspense fallback={<SplashScreen />}>
        <Outlet />
      </Suspense>
    </PublicOnly>
  );
}

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  {
    // Đặt lại mật khẩu: link email tạo session tạm → KHÔNG redirect về home.
    path: '/reset-password',
    element: (
      <Suspense fallback={<SplashScreen />}>
        <ResetPasswordPage />
      </Suspense>
    ),
  },
  {
    element: <AuthenticatedLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/presets', element: <PresetsPage /> },
      { path: '/presets/new', element: <PresetFormPage /> },
      { path: '/presets/:presetId', element: <PresetFormPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/groups/:groupId', element: <GroupPage /> },
      { path: '/trips/:tripId', element: <TripPage /> },
      { path: '/trips/:tripId/expenses/new', element: <ExpenseFormPage /> },
      { path: '/trips/:tripId/expenses/:expenseId/edit', element: <ExpenseFormPage /> },
      { path: '/expenses/new', element: <ExpenseFormPage /> },
      { path: '/join/:code', element: <JoinPage /> },
      { path: '/join', element: <JoinPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  const initialize = useAuthStore((s) => s.initialize);
  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <>
      <Toast.Provider placement="top" maxVisibleToasts={3} width={420} />
      <Suspense fallback={<PageSpinner />}>
        <RouterProvider router={router} />
      </Suspense>
    </>
  );
}
