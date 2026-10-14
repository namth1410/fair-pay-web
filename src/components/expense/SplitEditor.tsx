import { Checkbox } from '@heroui/react';
import { useMemo } from 'react';

import { formatThousands, parseMoneyInput } from '../../utils/format';
import { resolveRatio, splitByRatio, splitEqual, type SplitResult } from '../../utils/split';
import { Money } from '../ui/Money';
import { SegmentedTabs } from '../ui/Primitives';

export type SplitMode = 'equal' | 'ratio' | 'custom';

export interface SplitMember {
  id: string;
  name: string;
}

export interface SplitState {
  mode: SplitMode;
  participants: Set<string>;
  ratios: Record<string, string>;
  customAmounts: Record<string, string>;
}

/**
 * Tính splits cuối từ state — giữ đúng thứ tự members (người-cuối-được-tích nhận phần dư).
 * Trả null nếu chưa đủ dữ liệu (0 người, amount ≤ 0).
 */
export function computeSplits(members: SplitMember[], amount: number, s: SplitState): SplitResult[] | null {
  const picked = members.filter((m) => s.participants.has(m.id));
  if (picked.length === 0 || amount <= 0) return null;
  if (s.mode === 'equal') return splitEqual(amount, picked.map((m) => m.id));
  if (s.mode === 'ratio') {
    const ratios = picked.map((m) => ({ memberId: m.id, ratio: resolveRatio(s.ratios[m.id]) }));
    if (ratios.every((r) => r.ratio <= 0)) return null;
    return splitByRatio(amount, ratios);
  }
  return picked.map((m) => ({
    memberId: m.id,
    amount: parseInt(parseMoneyInput(s.customAmounts[m.id] ?? '') || '0', 10),
  }));
}

/** Mô hình 2 chiều như app: AI tham gia (checkbox) × chia THẾ NÀO (đều / tỷ lệ / tùy chỉnh). */
export function SplitEditor({
  members,
  amount,
  state,
  onChange,
  hideModeTabs = false,
}: {
  members: SplitMember[];
  amount: number;
  state: SplitState;
  onChange: (next: SplitState) => void;
  /** Ẩn thanh chọn kiểu chia (form preset tự điều khiển kiểu chia). */
  hideModeTabs?: boolean;
}) {
  const preview = useMemo(() => {
    const res = computeSplits(members, amount, state);
    return new Map((res ?? []).map((r) => [r.memberId, r.amount]));
  }, [members, amount, state]);

  const selectedCount = members.filter((m) => state.participants.has(m.id)).length;
  const allSelected = selectedCount === members.length;
  const customSum = useMemo(
    () =>
      members
        .filter((m) => state.participants.has(m.id))
        .reduce((sum, m) => sum + parseInt(parseMoneyInput(state.customAmounts[m.id] ?? '') || '0', 10), 0),
    [members, state],
  );

  const toggle = (id: string) => {
    const next = new Set(state.participants);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...state, participants: next });
  };

  return (
    <section className="space-y-3">
      {!hideModeTabs ? <p className="text-sm font-medium text-foreground">Cách chia</p> : null}
      {!hideModeTabs ? <SegmentedTabs
        ariaLabel="Cách chia"
        stretch
        value={state.mode}
        onChange={(mode) => onChange({ ...state, mode })}
        tabs={[
          { id: 'equal', label: 'Đều' },
          { id: 'ratio', label: 'Tỷ lệ' },
          { id: 'custom', label: 'Tùy chỉnh' },
        ]}
      /> : null}
      {state.mode === 'ratio' ? (
        <p className="text-xs text-muted">Nhập tỷ lệ cho mỗi người (VD: 2 = gấp đôi)</p>
      ) : state.mode === 'custom' ? (
        <p className="text-xs text-muted">Nhập số tiền cụ thể cho mỗi người</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
          <span className="text-sm text-muted">
            Chia cho <span className="font-semibold text-foreground">{selectedCount}/{members.length}</span> người
          </span>
          <button
            type="button"
            onClick={() =>
              onChange({ ...state, participants: allSelected ? new Set() : new Set(members.map((m) => m.id)) })
            }
            className="text-xs font-semibold text-foreground hover:underline"
          >
            {allSelected ? 'Bỏ chọn' : 'Chọn tất cả'}
          </button>
        </div>
        <ul className="divide-y divide-border">
          {members.map((m) => {
            const checked = state.participants.has(m.id);
            return (
              <li key={m.id} className={`flex items-center gap-3 px-3.5 py-2 transition-opacity ${checked ? '' : 'opacity-50'}`}>
                <Checkbox isSelected={checked} onChange={() => toggle(m.id)} aria-label={`Chia cho ${m.name}`}>
                  <Checkbox.Content className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-1">
                    <Checkbox.Control>
                      <Checkbox.Indicator />
                    </Checkbox.Control>
                    <span className="truncate text-sm font-medium text-foreground">{m.name}</span>
                  </Checkbox.Content>
                </Checkbox>
                <span className="flex-1" />
                {checked && state.mode === 'ratio' ? (
                  <label className="flex items-center gap-1.5">
                    <input
                      inputMode="numeric"
                      maxLength={2}
                      value={state.ratios[m.id] ?? ''}
                      placeholder="1"
                      onChange={(e) =>
                        onChange({ ...state, ratios: { ...state.ratios, [m.id]: e.target.value.replace(/\D/g, '') } })
                      }
                      className="tabular h-9 w-12 rounded-lg border border-border bg-field text-center text-sm font-semibold text-foreground outline-none focus:border-foreground/40"
                      aria-label={`Tỷ lệ của ${m.name}`}
                    />
                    <span className="text-xs text-muted">phần</span>
                  </label>
                ) : null}
                {checked && state.mode === 'custom' ? (
                  <label className="flex items-center gap-1">
                    <input
                      inputMode="numeric"
                      maxLength={12}
                      value={formatThousands(state.customAmounts[m.id] ?? '')}
                      placeholder="0"
                      onChange={(e) =>
                        onChange({
                          ...state,
                          customAmounts: { ...state.customAmounts, [m.id]: parseMoneyInput(e.target.value).slice(0, 12) },
                        })
                      }
                      className="tabular h-9 w-28 rounded-lg border border-border bg-field px-2 text-right text-sm font-semibold text-foreground outline-none focus:border-foreground/40"
                      aria-label={`Số tiền của ${m.name}`}
                    />
                    <span className="text-xs text-muted">₫</span>
                  </label>
                ) : null}
                {checked && state.mode !== 'custom' ? (
                  <Money value={preview.get(m.id) ?? 0} size="sm" tone="muted" className="w-24 justify-end" />
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border bg-surface-secondary/50 px-3.5 py-2.5 text-xs">
          {selectedCount === 0 ? (
            <span className="font-medium text-danger">Chọn ít nhất 1 người</span>
          ) : state.mode === 'custom' ? (
            <span className={customSum === amount ? 'font-medium text-money-positive' : 'font-medium text-money-negative'}>
              Tổng chia: {formatThousands(customSum) || '0'}₫ / {formatThousands(amount) || '0'}₫
            </span>
          ) : state.mode === 'equal' ? (
            <span className="text-muted">
              Chia đều cho {selectedCount} người · làm tròn 1.000₫, người cuối nhận phần dư
            </span>
          ) : (
            <span className="text-muted">Theo tỷ lệ — làm tròn 1.000₫, người cuối nhận phần dư</span>
          )}
        </div>
      </div>
    </section>
  );
}
