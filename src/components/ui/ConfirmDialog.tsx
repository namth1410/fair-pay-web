import { AlertDialog, Button } from '@heroui/react';
import { type ReactNode, useState } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'accent' | 'success' | 'warning' | 'default';
  /** Trả promise → nút hiện trạng thái đang xử lý, khóa đóng dialog tới khi xong. */
  onConfirm: () => void | Promise<void>;
  /** Mặc định đóng sau khi onConfirm xong (kể cả lỗi — lỗi do caller toast). */
  closeOnError?: boolean;
  children?: ReactNode;
}

/** Dialog xác nhận (thay BouncyDialog của app). */
export function ConfirmDialog({
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Hủy',
  tone = 'danger',
  onConfirm,
  closeOnError = true,
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      if (closeOnError) onOpenChange(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && pending) return;
        onOpenChange(open);
      }}
      isDismissable={!pending}
      isKeyboardDismissDisabled={pending}
    >
      <AlertDialog.Container size="sm">
        <AlertDialog.Dialog>
          <AlertDialog.Header>
            {tone !== 'default' && <AlertDialog.Icon status={tone} />}
            <AlertDialog.Heading>{title}</AlertDialog.Heading>
          </AlertDialog.Header>
          {(description || children) && (
            <AlertDialog.Body>
              {description ? <p className="whitespace-pre-line text-sm leading-6 text-muted">{description}</p> : null}
              {children}
            </AlertDialog.Body>
          )}
          <AlertDialog.Footer>
            <Button variant="tertiary" isDisabled={pending} onPress={() => onOpenChange(false)}>
              {cancelLabel}
            </Button>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              isPending={pending}
              onPress={handleConfirm}
            >
              {pending && pendingLabel ? pendingLabel : confirmLabel}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
