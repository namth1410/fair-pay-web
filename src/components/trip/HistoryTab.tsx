import { History } from 'lucide-react';
import { useMemo } from 'react';

import { type AuditLog, getActionLabel } from '../../services/audit.service';
import { formatDateSection, formatVND, getVnDayKey } from '../../utils/format';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/Primitives';
import { Bone } from '../ui/Skeleton';

function detailOf(log: AuditLog, nameOf: (id: string) => string): string | null {
  const data = (log.action.endsWith('.delete') ? log.before_data : log.after_data) ?? log.after_data ?? log.before_data;
  if (!data) return null;
  if (log.action.startsWith('expense.')) {
    const title = data.title as string | undefined;
    const amount = data.amount as number | undefined;
    if (!title) return null;
    return `"${title}"${typeof amount === 'number' ? ` ${formatVND(amount)}` : ''}`;
  }
  if (log.action.startsWith('payment.')) {
    // RPC create_payment ghi `from_member_id/to_member_id` (bản cũ dùng `from/to`).
    const from = (data.from_member_id ?? data.from) as string | undefined;
    const to = (data.to_member_id ?? data.to) as string | undefined;
    const amount = data.amount as number | undefined;
    if (!from || !to) return null;
    return `${nameOf(from)} → ${nameOf(to)}${typeof amount === 'number' ? ` ${formatVND(amount)}` : ''}`;
  }
  if (log.action.startsWith('member.')) {
    const name = (log.after_data?.display_name ?? log.before_data?.display_name) as string | undefined;
    return name ? name : null;
  }
  if (log.action === 'trip.rename') {
    const before = (log.before_data?.name as string | undefined) ?? '';
    const after = (log.after_data?.name as string | undefined) ?? '';
    return before && after ? `“${before}” → “${after}”` : null;
  }
  return null;
}

const timeFmt = new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'Asia/Ho_Chi_Minh',
});

/** Lịch sử thay đổi của chuyến (50 bản ghi audit gần nhất). */
export function HistoryTab({
  logs,
  isLoading,
  nameOf,
}: {
  logs: AuditLog[];
  isLoading: boolean;
  nameOf: (id: string) => string;
}) {
  const sections = useMemo(() => {
    const map = new Map<string, { title: string; items: AuditLog[] }>();
    for (const log of logs) {
      const d = new Date(log.client_created_at ?? log.created_at);
      const key = getVnDayKey(d);
      const s = map.get(key) ?? { title: formatDateSection(d), items: [] };
      s.items.push(log);
      map.set(key, s);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [logs]);

  if (isLoading && logs.length === 0) {
    return (
      <div className="rounded-[18px] border border-border bg-surface px-3.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`flex items-center gap-3 py-3 ${i < 3 ? 'border-b border-border' : ''}`}>
            <Bone w={32} h={32} r={16} />
            <div className="flex-1 space-y-2">
              <Bone w="62%" h={13} />
              <Bone w="40%" h={10} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (logs.length === 0) return <EmptyState icon={History} title="Chưa có lịch sử thay đổi" />;

  // Kiểu app: mỗi ngày 1 tiêu đề nhỏ + 1 thẻ danh sách có đường kẻ giữa các dòng.
  return (
    <div className="space-y-4">
      {sections.map(([key, s]) => (
        <section key={key}>
          <p className="mb-1.5 text-[13px] font-bold text-muted">{s.title}</p>
          <ol className="rounded-[18px] border border-border bg-surface px-3.5">
            {s.items.map((log, i) => {
              const detail = detailOf(log, nameOf);
              return (
                <li
                  key={log.id}
                  className={`flex items-start gap-3 py-3 ${i < s.items.length - 1 ? 'border-b border-border' : ''}`}
                >
                  <Avatar seed={log.actor_id} label={log.actor_name ?? '?'} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{log.actor_name}</span> — {getActionLabel(log.action)}
                    </p>
                    {detail ? <p className="mt-0.5 truncate text-xs text-muted">{detail}</p> : null}
                  </div>
                  <span className="tabular shrink-0 text-xs text-muted">
                    {timeFmt.format(new Date(log.client_created_at ?? log.created_at))}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
