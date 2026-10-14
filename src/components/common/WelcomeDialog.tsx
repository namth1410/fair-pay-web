import { Button, Modal } from '@heroui/react';
import { useEffect, useState } from 'react';

import { useAuthStore } from '../../stores/auth.store';
import { hasBeenWelcomed, markWelcomed } from '../../utils/preferences';

/** Lời chào 1 lần / user / trình duyệt — như WelcomeDialog của app. */
export function WelcomeDialog() {
  const authId = useAuthStore((s) => s.user?.id ?? null);
  const profileLoaded = useAuthStore((s) => !!s.profile);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!authId || !profileLoaded) return;
    if (!hasBeenWelcomed(authId)) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [authId, profileLoaded]);

  const close = () => {
    if (authId) markWelcomed(authId);
    setOpen(false);
  };

  return (
    <Modal.Backdrop isOpen={open} onOpenChange={(o) => (!o ? close() : setOpen(true))} isDismissable={false}>
      <Modal.Container placement="center" size="sm">
        <Modal.Dialog>
          <Modal.Header className="flex-row items-center justify-between gap-3">
            <Modal.Heading>Cảm ơn bạn đã đến với Fair Pay</Modal.Heading>
            <img src="/stickers/01_slay_qua.webp" alt="" className="-my-2 h-16 w-16 shrink-0 select-none object-contain" draggable={false} />
          </Modal.Header>
          <Modal.Body className="space-y-3 text-sm leading-6 text-muted">
            <p>
              Cảm ơn bạn đã dành thời gian trải nghiệm app. Mong bạn có những giây phút chia tiền nhóm thật nhẹ
              nhàng.
            </p>
            <p>Khi nào có góp ý cải thiện, bạn có thể vào phần Cài đặt → Gửi góp ý nhé!</p>
          </Modal.Body>
          <Modal.Footer>
            <Button fullWidth onPress={close}>
              Bắt đầu
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
