import { formatVND } from '../../utils/format';
import { DragonAvatar } from '../brand/DragonAvatar';

// Rồng Fair Pay "nhắn" tổng kết số dư mọi nhóm như 1 tin chat (khớp DragonSummaryBubble của app).
export function DragonSummaryBubble({
  owed,
  owing,
  groupCount,
}: {
  /** Tổng được nhận (dương) trên các nhóm đang hiện. */
  owed: number;
  /** Tổng đang nợ (dương). */
  owing: number;
  groupCount: number;
}) {
  const total = owed - owing;
  const settled = owed === 0 && owing === 0;
  // Quy ước dấu: '+' được nhận, '-' đang nợ (góc nhìn user).
  const sign = total >= 0 ? '+' : '-';

  return (
    <div className="mx-4 flex items-end gap-2">
      <DragonAvatar size={40} />
      <div
        className="min-w-0 flex-1 rounded-[20px] rounded-bl-md bg-bubble-other px-3.5 pb-3 pt-2.5"
        role="note"
        aria-label={
          settled
            ? `Rồng Fair Pay: bạn đang cân bằng ở cả ${groupCount} nhóm`
            : `Rồng Fair Pay: được nhận ${formatVND(owed)}, đang nợ ${formatVND(owing)}, còn lại ${sign}${formatVND(Math.abs(total))}`
        }
      >
        <p className="text-xs font-bold text-muted">Rồng Fair Pay</p>
        {settled ? (
          <p className="mt-0.5 text-[15px] leading-[21px] text-foreground">
            Bạn đang cân bằng ở cả {groupCount} nhóm. Không ai nợ ai!
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-[15px] leading-[21px] text-foreground">
              Tổng kết {groupCount} nhóm: bạn được nhận <b>{formatVND(owed)}</b>, đang nợ <b>{formatVND(owing)}</b>.
            </p>
            <p
              className={`tabular mt-2 text-[22px] font-extrabold leading-7 tracking-[-0.02em] ${
                total >= 0 ? 'text-money-positive' : 'text-money-negative'
              }`}
            >
              Còn lại {sign}
              {formatVND(Math.abs(total))}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
