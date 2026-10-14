import { memo, useState } from 'react';

import { getInitials as rawInitials, pickGradient, pickHeroGradient } from '../../utils/seedGradient';

/** Bỏ ký tự không phải chữ/số trước khi lấy chữ cái đầu ("Test web (Claude)" → "TC", không ra "T("). */
function getInitials(label: string): string {
  const cleaned = label.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  return cleaned ? rawInitials(cleaned) : (Array.from(label.trim())[0] ?? '?');
}

interface AvatarProps {
  /** Seed ổn định cho màu nền (id hoặc tên). */
  seed: string;
  /** Chuỗi lấy chữ cái viết tắt (mặc định = seed). */
  label?: string;
  photoUrl?: string | null;
  size?: number;
  /** 'gray' = avatar người (gradient xám như app); 'color' = ảnh bìa nhóm (pastel theo hue). */
  palette?: 'gray' | 'color';
  rounded?: 'full' | 'xl' | '2xl';
  className?: string;
  ring?: string;
}

/** Ảnh tròn; ảnh lỗi/không có → chữ cái đầu trên nền gradient sinh từ seed. */
export const Avatar = memo(function Avatar({
  seed,
  label,
  photoUrl,
  size = 40,
  palette = 'gray',
  rounded = 'full',
  className = '',
  ring,
}: AvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = !!photoUrl && failedUrl !== photoUrl;
  const g = palette === 'color' ? pickHeroGradient(seed) : pickGradient(seed);
  const radius = rounded === 'full' ? 'rounded-full' : rounded === 'xl' ? 'rounded-xl' : 'rounded-2xl';

  return (
    <span
      className={`relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden ${radius} ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: ring ? `0 0 0 2px var(--background), 0 0 0 4px ${ring}` : undefined,
        background: showPhoto ? 'var(--surface-secondary)' : `linear-gradient(135deg, ${g.from}, ${g.to})`,
      }}
      aria-hidden="true"
    >
      {showPhoto ? (
        <img
          src={photoUrl!}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(photoUrl!)}
        />
      ) : (
        <span className="font-bold" style={{ color: g.text, fontSize: Math.max(10, Math.round(size * 0.4)) }}>
          {getInitials(label ?? seed)}
        </span>
      )}
    </span>
  );
});

/** Ảnh bìa nhóm phủ kín khung cha: ảnh nhóm hoặc gradient pastel + chữ cái đầu. */
export const GroupCover = memo(function GroupCover({
  seed,
  label,
  photoUrl,
  className = '',
}: {
  seed: string;
  label: string;
  photoUrl?: string | null;
  className?: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = !!photoUrl && failedUrl !== photoUrl;
  const g = pickHeroGradient(seed);
  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className}`}
      style={{ background: showPhoto ? 'var(--surface-secondary)' : `linear-gradient(135deg, ${g.from}, ${g.to})` }}
      aria-hidden="true"
    >
      {showPhoto ? (
        <img
          src={photoUrl!}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          onError={() => setFailedUrl(photoUrl!)}
        />
      ) : (
        <span className="text-4xl font-bold tracking-tight" style={{ color: g.text }}>
          {getInitials(label)}
        </span>
      )}
    </div>
  );
});
