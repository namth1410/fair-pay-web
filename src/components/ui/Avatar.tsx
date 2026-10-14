import { memo, useState } from 'react';

import { getInitials as rawInitials, pastelIndex } from '../../utils/seedGradient';

/** Bỏ ký tự không phải chữ/số trước khi lấy chữ cái đầu ("Test web (Claude)" → "TC", không ra "T("). */
function getInitials(label: string): string {
  const cleaned = label.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  return cleaned ? rawInitials(cleaned) : (Array.from(label.trim())[0] ?? '?');
}

interface AvatarProps {
  /** Seed ổn định cho màu nền (id hoặc tên) — cùng seed ra cùng màu như app. */
  seed: string;
  /** Chuỗi lấy chữ cái viết tắt (mặc định = seed). */
  label?: string;
  photoUrl?: string | null;
  size?: number;
  rounded?: 'full' | 'xl' | '2xl';
  className?: string;
  /** Viền vòng ngoài (vd vòng "story" của chuyến ghim). */
  ring?: string;
}

/**
 * Avatar kiểu app nhắn tin (giao diện "Hội thoại"): ảnh tròn; không có ảnh → chữ cái đầu trên
 * nền pastel đặc. Màu lấy từ class .pastel-N (index.css) nên tự đổi theo sáng/tối.
 */
export const Avatar = memo(function Avatar({
  seed,
  label,
  photoUrl,
  size = 40,
  rounded = 'full',
  className = '',
  ring,
}: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = !!photoUrl && failedUrl !== photoUrl;
  const radius = rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-2xl';

  return (
    <span
      className={`pastel-${pastelIndex(seed)} relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden ${radius} ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: ring ? `0 0 0 2px var(--surface), 0 0 0 4px ${ring}` : undefined,
        background: showPhoto ? 'var(--surface-secondary)' : 'var(--pastel-bg)',
      }}
      aria-hidden="true"
    >
      {showPhoto ? (
        <img
          src={photoUrl!}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(photoUrl!)}
        />
      ) : (
        <span
          className="font-extrabold"
          style={{ color: 'var(--pastel-fg)', fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {getInitials(label ?? seed)}
        </span>
      )}
    </span>
  );
});
