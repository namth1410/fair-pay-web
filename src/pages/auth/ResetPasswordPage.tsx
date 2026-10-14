import { Button, Spinner } from '@heroui/react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { AuthHeading, AuthLayout } from '../../components/auth/AuthLayout';
import { TextInputField } from '../../components/ui/Field';
import { ErrorBox } from '../../components/ui/Primitives';
import { useAuthStore } from '../../stores/auth.store';
import { getErrorMessage } from '../../utils/error';
import { getInitialAuthParams } from '../../utils/initialUrl';
import { showSuccess } from '../../utils/toast';
import { PasswordToggle } from './LoginPage';

type Phase = 'parsing' | 'ready' | 'expired' | 'exchange_failed' | 'no_token';

const INVALID_TEXT: Record<'expired' | 'exchange_failed' | 'no_token', string> = {
  expired:
    'Link đã được dùng hoặc hết hạn. Lưu ý: link đặt lại mật khẩu chỉ dùng được 1 lần — nếu mail client đã mở trước link, hãy gửi lại email.',
  exchange_failed: 'Xác thực link thất bại. Vui lòng gửi lại email.',
  no_token: 'Không tìm thấy token đặt lại mật khẩu trong link.',
};

/**
 * Đích của link email đặt lại mật khẩu. supabase-js (detectSessionInUrl) tự đổi
 * `#access_token…` / `?code=…` thành session; trang này chỉ chờ session đó rồi
 * cho đặt mật khẩu mới.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const updatePassword = useAuthStore((s) => s.updatePassword);
  const isLoading = useAuthStore((s) => s.isLoading);

  const params = useMemo(() => getInitialAuthParams(), []);
  const hasError = params.has('error') || params.has('error_code');
  const hasToken = params.has('access_token') || params.has('code') || params.get('type') === 'recovery';

  const [timedOut, setTimedOut] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasToken || session) return;
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [hasToken, session]);

  let phase: Phase;
  if (hasError) phase = 'expired';
  else if (session) phase = 'ready';
  else if (!isInitialized) phase = 'parsing';
  else if (hasToken) phase = timedOut ? 'exchange_failed' : 'parsing';
  else phase = 'no_token';

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    try {
      await updatePassword(password);
      showSuccess('Đã đặt lại mật khẩu');
      navigate('/', { replace: true });
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  if (phase === 'parsing') {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 py-16 text-sm text-muted">
          <Spinner color="current" />
          Đang xác thực link...
        </div>
      </AuthLayout>
    );
  }

  if (phase !== 'ready') {
    return (
      <AuthLayout>
        <AuthHeading title="Đặt lại mật khẩu" subtitle={INVALID_TEXT[phase]} />
        <div className="space-y-3">
          <Button fullWidth size="lg" onPress={() => navigate('/forgot-password', { replace: true })}>
            Gửi lại email
          </Button>
          <Button fullWidth size="lg" variant="outline" onPress={() => navigate('/login', { replace: true })}>
            Quay về đăng nhập
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthHeading title="Đặt lại mật khẩu" subtitle="Đặt mật khẩu mới cho tài khoản" />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        noValidate
      >
        <TextInputField
          label="Mật khẩu mới"
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          placeholder="Ít nhất 6 ký tự"
          autoComplete="new-password"
          autoFocus
          suffix={<PasswordToggle shown={showPw} onToggle={() => setShowPw((v) => !v)} />}
        />
        <TextInputField
          label="Xác nhận mật khẩu mới"
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={setConfirm}
          placeholder="Nhập lại mật khẩu mới"
          autoComplete="new-password"
        />
        <ErrorBox>{error}</ErrorBox>
        <Button type="submit" fullWidth size="lg" isPending={isLoading}>
          {isLoading ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
        </Button>
      </form>
    </AuthLayout>
  );
}
