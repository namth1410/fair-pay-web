import { toast } from '@heroui/react';

import { getErrorMessage } from './error';

/**
 * API toast giống app (showSuccess/showError/...) — chạy trên Toast của HeroUI v3.
 * `<Toast.Provider />` mount 1 lần ở App root.
 */
type ToastOpts = string | { description?: string; timeout?: number };

function normalize(opts?: ToastOpts): { description?: string; timeout?: number } {
  if (!opts) return {};
  return typeof opts === 'string' ? { description: opts } : opts;
}

export function showSuccess(label: string, opts?: ToastOpts): void {
  toast.success(label, normalize(opts));
}

export function showInfo(label: string, opts?: ToastOpts): void {
  toast.info(label, normalize(opts));
}

export function showWarning(label: string, opts?: ToastOpts): void {
  toast.warning(label, { timeout: 6000, ...normalize(opts) });
}

export function showError(err: unknown, label = 'Lỗi'): void {
  toast.danger(label, { description: getErrorMessage(err), timeout: 6000 });
}

export function showValidationError(label: string, description: string): void {
  toast.danger(label, { description, timeout: 5000 });
}
