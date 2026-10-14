import type { TripBalanceMember } from '../../services/expense.service';

/** Tra tên thành viên (kể cả người đã rời — có hậu tố) theo id. */
export function makeNameLookup(members: TripBalanceMember[]): (id: string) => string {
  const map = new Map(members.map((m) => [m.id, m]));
  return (id: string) => {
    const m = map.get(id);
    if (!m) return '?';
    return m.leftAt ? `${m.displayName} (đã rời)` : m.displayName;
  };
}

/** Chữ cái đầu cho thumbnail khoản chi không có ảnh ('?' nếu ký tự đầu không phải chữ). */
export function firstLetter(title: string): string {
  const ch = title.trim().charAt(0);
  return /\p{L}/u.test(ch) ? ch.toUpperCase() : '?';
}
