import { Button } from '@heroui/react';
import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router';

import { AuthHeading, AuthLayout } from '../../components/auth/AuthLayout';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { TextInputField } from '../../components/ui/Field';
import { ErrorBox } from '../../components/ui/Primitives';
import { useAuthStore } from '../../stores/auth.store';
import { getErrorMessage } from '../../utils/error';
import { validateEmail } from '../../utils/validate';

export function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
      className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full text-muted hover:text-foreground"
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

export default function LoginPage() {
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const isLoading = useAuthStore((s) => s.isLoading);
  const location = useLocation();
  const search = location.search;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setEmailError(null);
    setPwError(null);
    if (!email.trim() || !password) {
      if (!email.trim()) setEmailError('Vui lòng nhập email và mật khẩu');
      else setPwError('Vui lòng nhập email và mật khẩu');
      return;
    }
    const emailErr = validateEmail(email);
    if (emailErr) {
      setEmailError(emailErr);
      return;
    }
    try {
      await signInWithEmail(email.trim(), password);
      // PublicOnly guard tự chuyển về trang `next`/home khi có session.
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <AuthLayout>
      <AuthHeading title="Đăng nhập" subtitle="Chào mừng bạn quay lại Fair Pay" />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        noValidate
      >
        <TextInputField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="ban@email.com"
          autoComplete="email"
          error={emailError}
          autoFocus
        />
        <div className="relative">
          <TextInputField
            label="Mật khẩu"
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
            error={pwError}
            labelEnd={
              <Link to="/forgot-password" className="text-xs font-medium text-muted hover:text-foreground">
                Quên mật khẩu?
              </Link>
            }
            suffix={<PasswordToggle shown={showPw} onToggle={() => setShowPw((v) => !v)} />}
          />
        </div>

        <ErrorBox>{error}</ErrorBox>

        <Button type="submit" fullWidth size="lg" isPending={isLoading && !googleBusy} isDisabled={googleBusy}>
          {isLoading && !googleBusy ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        hoặc
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleSignInButton onError={setError} onBusyChange={setGoogleBusy} />
      {googleBusy ? <p className="mt-2 text-center text-xs text-muted">Đang đăng nhập...</p> : null}

      <p className="mt-8 text-center text-sm text-muted">
        Chưa có tài khoản?{' '}
        <Link to={`/register${search}`} className="font-semibold text-foreground hover:underline">
          Đăng ký
        </Link>
      </p>
    </AuthLayout>
  );
}
