import { Spinner } from '@heroui/react';
import { Camera, Plus } from 'lucide-react';
import { useRef } from 'react';

/**
 * Ô soạn ở đáy luồng chuyến đi (khớp TripComposer của app): nút ảnh hoá đơn · ô giả "Thêm khoản
 * chi…" · nút +. Chuyến đã đóng → câu nhắc + nút mở lại (quản trị).
 */
export function TripComposer({
  isClosed,
  isPicking,
  onCompose,
  onPickImage,
  closedActionLabel,
  onClosedAction,
}: {
  isClosed: boolean;
  isPicking: boolean;
  onCompose: () => void;
  onPickImage: (file: File) => void;
  closedActionLabel?: string;
  onClosedAction?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (isClosed) {
    return (
      <div className="flex shrink-0 items-center gap-2 border-t border-border bg-surface px-3 pt-2.5 [padding-bottom:max(env(safe-area-inset-bottom),10px)]">
        <p className="min-w-0 flex-1 px-1 text-[13px] leading-[18px] text-muted">
          Chuyến đã đóng. Mở lại để thêm khoản chi hoặc ghi nhận thanh toán.
        </p>
        {closedActionLabel && onClosedAction ? (
          <button
            type="button"
            onClick={onClosedAction}
            className="h-11 shrink-0 rounded-full border-[1.5px] border-accent px-4 text-[13px] font-bold text-accent transition-colors hover:bg-primary-soft"
          >
            {closedActionLabel}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-border bg-surface px-3 pt-2.5 [padding-bottom:max(env(safe-area-inset-bottom),10px)]">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={isPicking}
        aria-label="Thêm khoản chi từ ảnh hoá đơn"
        title="Chụp / chọn ảnh hoá đơn"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-foreground transition-colors hover:bg-surface-tertiary disabled:opacity-60"
      >
        {isPicking ? <Spinner size="sm" color="current" className="text-muted" /> : <Camera className="h-[21px] w-[21px]" />}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onPickImage(file);
        }}
      />
      <button
        type="button"
        onClick={onCompose}
        aria-label="Thêm khoản chi"
        className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-surface-secondary px-4 text-left text-base text-muted transition-colors hover:bg-surface-tertiary"
      >
        Thêm khoản chi…
      </button>
      <button
        type="button"
        onClick={onCompose}
        aria-label="Thêm khoản chi mới"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-transform active:scale-95"
      >
        <Plus className="h-[22px] w-[22px]" strokeWidth={2.4} />
      </button>
    </div>
  );
}
