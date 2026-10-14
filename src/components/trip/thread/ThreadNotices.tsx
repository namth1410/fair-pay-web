import { Lock } from 'lucide-react';

import { DragonAvatar } from '../../brand/DragonAvatar';

/** Vạch ngày giữa luồng: "Hôm nay", "Chủ Nhật, 11/10"... */
export function ThreadDaySeparator({ title }: { title: string }) {
  return (
    <div className="my-2.5 flex justify-center">
      <span className="rounded-full bg-surface-secondary px-3 py-1 text-xs font-semibold text-muted">{title}</span>
    </div>
  );
}

/** Tin hệ thống ở giữa luồng (vd "Chuyến đi đã đóng · 13/10"). */
export function ThreadSystemNotice({ text }: { text: string }) {
  return (
    <div className="my-2.5 flex justify-center">
      <span className="flex items-center gap-1.5 rounded-full bg-surface-secondary px-3 py-1 text-xs font-semibold text-muted">
        <Lock className="h-3 w-3" strokeWidth={2.4} />
        {text}
      </span>
    </div>
  );
}

/** Tin của rồng trong luồng: lời nhắn + (tuỳ chọn) 1 nút hành động. */
export function DragonMessage({
  title,
  text,
  actionLabel,
  onAction,
}: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="my-1.5 flex items-end gap-2 pr-12">
      <DragonAvatar size={28} />
      <div className="max-w-[460px] rounded-[20px] rounded-bl-md border-[1.5px] border-brand-border bg-surface px-3.5 pb-3 pt-2.5">
        <p className="text-xs font-bold text-money-positive">{title}</p>
        <p className="mt-0.5 text-[15px] leading-[21px] text-foreground">{text}</p>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="mt-2.5 rounded-full bg-accent px-4 py-2 text-[13px] font-bold text-accent-foreground transition-opacity hover:opacity-90"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
