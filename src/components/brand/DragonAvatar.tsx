/** Avatar rồng Fair Pay (linh vật) — khung tròn lấy phần đầu rồng từ ảnh cả thân. */
export function DragonAvatar({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 justify-center overflow-hidden rounded-full bg-brand-soft ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src="/dragon-receipt.png"
        alt=""
        draggable={false}
        className="max-w-none select-none"
        // Phóng to + đẩy lên để khung tròn lấy phần đầu (giống DragonSummaryBubble của app).
        style={{ width: size * 1.5, height: size * 1.48, marginTop: 1 }}
      />
    </span>
  );
}
