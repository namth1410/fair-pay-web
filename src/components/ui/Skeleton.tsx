// Skeleton giao diện "Hội thoại": khối bo tròn nhấp nháy nhẹ (class .bone ở index.css, tự đứng
// yên khi tắt "Hiệu ứng chuyển động" / giảm chuyển động). Mỗi màn dựng đúng hình học màn thật
// (khớp Skeleton.tsx của app) để data về không nhảy layout.

const TITLE_WIDTHS = ['58%', '42%', '66%', '50%', '36%'];
const SUB_WIDTHS = ['34%', '46%', '28%', '40%', '52%'];

export function Bone({
  w = '100%',
  h,
  r = 6,
  className = '',
}: {
  w?: number | string;
  h: number;
  r?: number;
  className?: string;
}) {
  return <span aria-hidden className={`bone block shrink-0 ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

/** Danh sách dòng kiểu chat: khối đầu (avatar tròn / ô bo góc) + 2 dòng chữ + đường kẻ. */
export function RowsSkeleton({
  count = 6,
  leading = 'circle',
  size = 54,
  minHeight = 76,
}: {
  count?: number;
  leading?: 'circle' | 'tile';
  size?: number;
  minHeight?: number;
}) {
  return (
    <div role="progressbar" aria-label="Đang tải" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 pl-4" style={{ minHeight }}>
          <Bone w={size} h={size} r={leading === 'circle' ? size / 2 : 18} />
          <div className="flex flex-1 flex-col justify-center gap-2.5 self-stretch border-b border-border py-3 pr-4">
            <Bone w={TITLE_WIDTHS[i % TITLE_WIDTHS.length]} h={14} />
            <Bone w={SUB_WIDTHS[i % SUB_WIDTHS.length]} h={11} />
          </div>
        </div>
      ))}
    </div>
  );
}
