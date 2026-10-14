import { Button } from '@heroui/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { AuthHeading, AuthLayout } from '../../components/auth/AuthLayout';
import { TextInputField } from '../../components/ui/Field';
import { ErrorBox, InfoBox } from '../../components/ui/Primitives';
import { getResetCooldownRemaining } from '../../services/auth.helper';
import { useAuthStore } from '../../stores/auth.store';
import { getErrorMessage } from '../../utils/error';
import { validateEmail } from '../../utils/validate';

export default function ForgotPasswordPage() {
  const sendPasswordResetEmail = useAuthStore((s) => s.sendPasswordResetEmail);
  const isLoading = useAuthStore((s) => s.isLoading);
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(() => getResetCooldownRemaining());

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(getResetCooldownRemaining()), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const send = async (target: string) => {
    setError(null);
    const emailErr = validateEmail(target);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    try {
      await sendPasswordResetEmail(target.trim());
      setSentTo(target.trim());
      setCooldown(getResetCooldownRemaining());
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  const sent = sentTo !== null;

  return (
    <AuthLayout>
      <AuthHeading
        title="Quên mật khẩu"
        subtitle={
          sent
            ? 'Kiểm tra hộp thư và nhấn vào liên kết để đặt lại mật khẩu'
            : 'Nhập email đã đăng ký, chúng tôi sẽ gửi link đặt lại mật khẩu'
        }
      />

      {sent ? (
        <div className="space-y-4">
          <InfoBox tone="success">
            Đã gửi email đến <strong>{sentTo}</strong>. Link có hiệu lực trong 1 giờ.
          </InfoBox>
          <ErrorBox>{error}</ErrorBox>
          <Button
            fullWidth
            size="lg"
            isDisabled={cooldown > 0}
            isPending={isLoading}
            onPress={() => void send(sentTo ?? '')}
          >
            {isLoading ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại (${cooldown}s)` : 'Gửi lại'}
          </Button>
          <Button fullWidth size="lg" variant="outline" onPress={() => navigate('/login', { replace: true })}>
            Quay về đăng nhập
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void send(email);
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
            autoFocus
          />
          <ErrorBox>{error}</ErrorBox>
          <Button type="submit" fullWidth size="lg" isDisabled={cooldown > 0} isPending={isLoading}>
            {isLoading ? 'Đang gửi...' : cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi link đặt lại mật khẩu'}
          </Button>
          <p className="text-center text-sm">
            <Link to="/login" className="font-medium text-muted hover:text-foreground">
              Quay lại đăng nhập
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
