import { Spinner } from '@heroui/react';

export function PageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted">
      <Spinner color="current" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}

/** Màn chờ toàn trang lúc khởi động (trước khi biết đã đăng nhập hay chưa). */
export function SplashScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Spinner color="current" className="text-muted" />
    </div>
  );
}
