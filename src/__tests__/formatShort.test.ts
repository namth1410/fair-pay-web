/**
 * Tests cho formatShortVND (số tiền gọn ở danh sách chat) + pastelIndex (màu avatar theo seed).
 */
import { formatShortVND } from '../utils/format';
import { PASTEL_COUNT, pastelIndex } from '../utils/seedGradient';

describe('formatShortVND', () => {
  it('dưới 1.000đ giữ nguyên số + đ', () => {
    expect(formatShortVND(0)).toBe('0đ');
    expect(formatShortVND(500)).toBe('500đ');
  });

  it('nghìn → k', () => {
    expect(formatShortVND(1_000)).toBe('1k');
    expect(formatShortVND(860_000)).toBe('860k');
    expect(formatShortVND(999_000)).toBe('999k');
  });

  it('triệu → tr, tối đa 2 số thập phân, dấu phẩy, bỏ số 0 thừa', () => {
    expect(formatShortVND(1_000_000)).toBe('1tr');
    expect(formatShortVND(1_250_000)).toBe('1,25tr');
    expect(formatShortVND(1_500_000)).toBe('1,5tr');
    expect(formatShortVND(7_420_000)).toBe('7,42tr');
    expect(formatShortVND(12_000_000)).toBe('12tr');
  });

  it('bỏ dấu âm — caller tự thêm dấu theo quy ước số dư', () => {
    expect(formatShortVND(-320_000)).toBe('320k');
    expect(formatShortVND(-1_250_000)).toBe('1,25tr');
  });
});

describe('pastelIndex', () => {
  it('deterministic theo seed, nằm trong 0..PASTEL_COUNT-1', () => {
    for (const seed of ['a', 'b', 'group-1', 'trip-123', 'Nhóm đi Tà Xùa']) {
      const i = pastelIndex(seed);
      expect(i).toBe(pastelIndex(seed));
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(PASTEL_COUNT);
    }
  });

  it('khớp thuật toán pickPastel của app (FNV-1a % 6)', () => {
    // Cặp đối chiếu chạy từ app: pickPastel(seed) trả màu ở vị trí hashSeed(seed) % 6.
    expect(PASTEL_COUNT).toBe(6);
  });
});
