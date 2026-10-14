import { useEffect, useRef, useState } from 'react';

import { GOOGLE_WEB_CLIENT_ID } from '../../config/constants';
import { useAuthStore } from '../../stores/auth.store';
import { getErrorMessage } from '../../utils/error';

/**
 * Đăng nhập Google bằng Google Identity Services (GIS): Google trả ID token ngay
 * trên trang → `supabase.auth.signInWithIdToken` — CÙNG cơ chế với app native
 * (không cần redirect OAuth). Yêu cầu: origin của web nằm trong "Authorized
 * JavaScript origins" của Web Client ID trên Google Cloud Console.
 */

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleId {
  initialize: (config: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
  cancel: () => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Không tải được Google Sign-In'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

interface Props {
  onError?: (message: string) => void;
  onBusyChange?: (busy: boolean) => void;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
}

export function GoogleSignInButton({ onError, onBusyChange, text = 'continue_with' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const signInWithGoogleIdToken = useAuthStore((s) => s.signInWithGoogleIdToken);
  const onErrorRef = useRef(onError);
  const onBusyRef = useRef(onBusyChange);
  onErrorRef.current = onError;
  onBusyRef.current = onBusyChange;

  useEffect(() => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      setLoadFailed(true);
      return;
    }
    let cancelled = false;
    let resizeObs: ResizeObserver | null = null;
    let renderFn: (() => void) | null = null;

    (async () => {
      try {
        await loadGis();
        if (cancelled || !containerRef.current || !window.google) return;
        const rawNonce = crypto.randomUUID() + crypto.randomUUID();
        const hashedNonce = await sha256Hex(rawNonce);

        window.google.accounts.id.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          nonce: hashedNonce,
          ux_mode: 'popup',
          itp_support: true,
          use_fedcm_for_button: true,
          callback: async (resp: GoogleCredentialResponse) => {
            onBusyRef.current?.(true);
            try {
              await signInWithGoogleIdToken(resp.credential, rawNonce);
            } catch (e) {
              onErrorRef.current?.(getErrorMessage(e));
            } finally {
              onBusyRef.current?.(false);
            }
          },
        });

        const render = () => {
          const el = containerRef.current;
          if (!el || !window.google) return;
          el.innerHTML = '';
          const dark = document.documentElement.classList.contains('dark');
          window.google.accounts.id.renderButton(el, {
            type: 'standard',
            theme: dark ? 'filled_black' : 'outline',
            size: 'large',
            text,
            shape: 'pill',
            logo_alignment: 'center',
            locale: 'vi',
            width: Math.min(400, Math.max(200, Math.floor(el.clientWidth))),
          });
        };
        renderFn = render;
        render();
        resizeObs = new ResizeObserver(() => render());
        resizeObs.observe(containerRef.current);
        window.addEventListener('fairpay:theme', render);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      resizeObs?.disconnect();
      if (renderFn) window.removeEventListener('fairpay:theme', renderFn);
      window.google?.accounts.id.cancel();
    };
  }, [signInWithGoogleIdToken, text]);

  if (loadFailed) {
    return (
      <p className="rounded-xl bg-surface-secondary px-3 py-2.5 text-center text-xs text-muted">
        Không tải được nút đăng nhập Google. Hãy dùng email/mật khẩu hoặc thử lại sau.
      </p>
    );
  }

  return <div ref={containerRef} className="flex min-h-[44px] w-full justify-center" />;
}
