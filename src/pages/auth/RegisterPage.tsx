import { Button, Modal } from '@heroui/react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';

import { AuthHeading, AuthLayout } from '../../components/auth/AuthLayout';
import { GoogleSignInButton } from '../../components/auth/GoogleSignInButton';
import { TextInputField } from '../../components/ui/Field';
import { ErrorBox, InfoBox } from '../../components/ui/Primitives';
import { useAuthStore } from '../../stores/auth.store';
import { getErrorMessage } from '../../utils/error';
import { validateEmail } from '../../utils/validate';
import { PasswordToggle } from './LoginPage';

export default function RegisterPage() {
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { search } = useLocation();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  // Lưu ý quota email — tự mở sau 450ms như app.
  useEffect(() => {
    const t = setTimeout(() => setNoticeOpen(true), 450);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!displayName.trim() || !email.trim() || !password || !confirm) {
      setError('Vui lòng điền đầy đủ thông tin');
      return;
    }
    const name = displayName.trim();
    if (name.length < 2 || name.length > 50) {
      setError('Tên hiển thị phải từ 2 đến 50 ký tự');
      return;
    }
    const emailErr = validateEmail(email);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (password !== confirm) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }
    try {
      const { needsConfirm } = await signUpWithEmail(email.trim(), password, name);
      if (needsConfirm) setConfirmSent(true);
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <AuthLayout>
      <AuthHeading title="Tạo tài khoản Fair Pay" subtitle="Miễn phí, chỉ mất chưa tới một phút" />

      {confirmSent ? (
        <InfoBox tone="success" className="mb-4">
          Đã gửi email xác nhận tới <strong>{email.trim()}</strong>. Mở hộp thư và bấm vào liên kết để kích hoạt
          tài khoản, rồi quay lại đăng nhập.
        </InfoBox>
      ) : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        noValidate
      >
        <ErrorBox>{error}</ErrorBox>
        <TextInputField
          label="Tên hiển thị"
          value={displayName}
          onChange={setDisplayName}
          placeholder="2-50 ký tự"
          maxLength={50}
          autoComplete="nickname"
        />
        <TextInputField
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="ban@email.com"
          autoComplete="email"
        />
        <TextInputField
          label="Mật khẩu"
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          placeholder="Ít nhất 6 ký tự"
          autoComplete="new-password"
          suffix={<PasswordToggle shown={showPw} onToggle={() => setShowPw((v) => !v)} />}
        />
        <TextInputField
          label="Xác nhận mật khẩu"
          type={showPw ? 'text' : 'password'}
          value={confirm}
          onChange={setConfirm}
          placeholder="Nhập lại mật khẩu"
          autoComplete="new-password"
        />
        <Button type="submit" fullWidth size="lg" isPending={isLoading && !googleBusy}>
          {isLoading && !googleBusy ? 'Đang đăng ký...' : 'Đăng ký'}
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        hoặc
        <span className="h-px flex-1 bg-border" />
      </div>
      {/* Chỉ 1 nút Google tại 1 thời điểm (GIS dùng cấu hình toàn cục). */}
      {!noticeOpen ? <GoogleSignInButton text="signup_with" onError={setError} onBusyChange={setGoogleBusy} /> : null}

      <p className="mt-8 text-center text-sm text-muted">
        Đã có tài khoản?{' '}
        <Link to={`/login${search}`} className="font-semibold text-foreground hover:underline">
          Đăng nhập
        </Link>
      </p>

      <Modal.Backdrop isOpen={noticeOpen} onOpenChange={setNoticeOpen} isDismissable={false}>
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog>
            <Modal.Header className="flex-row items-center justify-between gap-3">
              <Modal.Heading>Một lưu ý nhỏ 🐉</Modal.Heading>
              <img src="/stickers/06_na_ni.webp" alt="" className="-my-2 h-14 w-14 shrink-0 select-none object-contain" draggable={false} />
            </Modal.Header>
            <Modal.Body className="space-y-3 text-sm leading-6 text-muted">
              <p>
                Fair Pay là app làm cho vui, nên toàn bộ tài nguyên máy chủ đều xài gói miễn phí. Vì vậy cả hệ thống
                chỉ gửi được khoảng 4 email mỗi giờ — đăng ký bằng email rất dễ gặp lỗi.
              </p>
              <p>Để vào app nhanh và ổn định hơn, bạn nên đăng nhập bằng Google nhé!</p>
            </Modal.Body>
            <Modal.Footer className="flex-col items-stretch gap-2">
              <GoogleSignInButton
                text="continue_with"
                onError={(m) => {
                  setNoticeOpen(false);
                  setError(m);
                }}
                onBusyChange={setGoogleBusy}
              />
              <Button variant="ghost" fullWidth onPress={() => setNoticeOpen(false)}>
                Vẫn đăng ký bằng email
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </AuthLayout>
  );
}
