import { Button, Skeleton } from '@heroui/react';
import { Plus, ReceiptText } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import type { ExpenseWithSplits } from '../../services/expense.service';
import { groupExpensesByDay } from '../../utils/expenseGrouping';
import { gradientFromString } from '../../utils/gradientFromString';
import { isDarkNow } from '../../utils/preferences';
import { Money } from '../ui/Money';
import { EmptyState } from '../ui/Primitives';
import { ExpenseDetailSheet } from './ExpenseDetailSheet';
import { firstLetter } from './tripHelpers';

export function ExpenseThumb({ expense, size = 56 }: { expense: Pick<ExpenseWithSplits, 'id' | 'title' | 'image_url'>; size?: number }) {
  const [failed, setFailed] = useState(false);
  const colors = gradientFromString(expense.title || expense.id, isDarkNow());
  if (expense.image_url && !failed) {
    return (
      <img
        src={expense.image_url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0 rounded-xl object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-xl text-lg font-bold text-white/95"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${colors.join(', ')})`,
        textShadow: '0 1px 2px rgba(0,0,0,0.15)',
      }}
    >
      {firstLetter(expense.title)}
    </span>
  );
}

const ExpenseRow = memo(function ExpenseRow({
  expense,
  payerName,
  onOpen,
}: {
  expense: ExpenseWithSplits;
  payerName: string;
  onOpen: (e: ExpenseWithSplits) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(expense)}
      className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-surface p-2.5 text-left shadow-surface transition-colors hover:border-foreground/20"
    >
      <ExpenseThumb expense={expense} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[15px] font-semibold leading-5 text-foreground">{expense.title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted">{payerName} đã trả</span>
      </span>
      <Money value={expense.amount} size="md" className="shrink-0 pr-1" />
    </button>
  );
});

export function ExpensesTab({
  expenses,
  isLoading,
  tripOpen,
  tripId,
  nameOf,
  canDelete,
  onDeleted,
}: {
  expenses: ExpenseWithSplits[];
  isLoading: boolean;
  tripOpen: boolean;
  tripId: string;
  nameOf: (id: string) => string;
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const sections = useMemo(() => groupExpensesByDay(expenses), [expenses]);
  const [selected, setSelected] = useState<ExpenseWithSplits | null>(null);

  return (
    <div className="space-y-4">
      {tripOpen ? (
        <Button fullWidth onPress={() => navigate(`/trips/${tripId}/expenses/new`)}>
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Thêm khoản chi
        </Button>
      ) : null}

      {isLoading && expenses.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[78px] rounded-2xl" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Chưa có khoản chi nào" subtitle={tripOpen ? 'Bấm “Thêm khoản chi” để ghi khoản đầu tiên.' : undefined} />
      ) : (
        <div className="space-y-5">
          {sections.map((section) => (
            <section key={section.dayKey} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-surface-secondary px-2.5 py-0.5 text-xs font-semibold text-muted">
                  {section.title}
                </span>
                <span className="h-px flex-1 bg-border" />
                <Money
                  value={section.data.reduce((sum, e) => sum + e.amount, 0)}
                  size="sm"
                  tone="muted"
                />
              </div>
              <div className="space-y-2">
                {section.data.map((e) => (
                  <ExpenseRow key={e.id} expense={e} payerName={nameOf(e.paid_by)} onOpen={setSelected} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <ExpenseDetailSheet
        expense={selected}
        onClose={() => setSelected(null)}
        tripOpen={tripOpen}
        canDelete={canDelete}
        nameOf={nameOf}
        onDeleted={onDeleted}
      />
    </div>
  );
}
