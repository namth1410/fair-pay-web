import { Modal } from '@heroui/react';
import type { ReactNode } from 'react';

interface SheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Chặn đóng (vd đang lưu) — tắt cả bấm nền lẫn ESC. */
  isLocked?: boolean;
  /** Mặc định: bấm nền để đóng. */
  isDismissable?: boolean;
  bodyClassName?: string;
}

/**
 * "Bottom sheet" của app → Modal HeroUI placement auto: mobile trượt từ đáy,
 * desktop hiện giữa màn hình. Nội dung dài tự cuộn bên trong.
 */
export function Sheet({
  isOpen,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  isLocked = false,
  isDismissable = true,
  bodyClassName = '',
}: SheetProps) {
  return (
    <Modal.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && isLocked) return;
        onOpenChange(open);
      }}
      isDismissable={isDismissable && !isLocked}
      isKeyboardDismissDisabled={isLocked}
    >
      <Modal.Container placement="auto" size={size} scroll="inside">
        <Modal.Dialog className="max-h-[calc(var(--visual-viewport-height,100dvh)-2rem)] sm:max-h-[min(86dvh,760px)]">
          {!isLocked && <Modal.CloseTrigger aria-label="Đóng" />}
          <Modal.Header className="pr-8">
            <Modal.Heading className="text-lg font-semibold leading-tight">{title}</Modal.Heading>
            {description ? <p className="mt-1 text-sm leading-5 text-muted">{description}</p> : null}
          </Modal.Header>
          <Modal.Body className={`scrollbar-thin ${bodyClassName}`}>{children}</Modal.Body>
          {footer ? <Modal.Footer className="flex-wrap">{footer}</Modal.Footer> : null}
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
