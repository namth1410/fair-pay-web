import { Button } from '@heroui/react';
import { PencilLine, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { deleteExpense, type ExpenseWithSplits } from '../../services/expense.service';
import { formatDateTimeVN } from '../../utils/format';
import { showError, showSuccess } from '../../utils/toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Money } from '../ui/Money';
import { Pill } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

const SPLIT_LABEL: Record<string, string> = {
  equal: 'Chia đều',
  ratio: 'Theo tỉ lệ',
  custom: 'Tuỳ chỉnh',
};

export function ExpenseDetailSheet({
  expense,
  onClose,
  tripOpen,
  canDelete,
  nameOf,
  onDeleted,
}: {
  expense: ExpenseWithSplits | null;
  onClose: () => void;
  tripOpen: boolean;
  canDelete: boolean;
  nameOf: (id: string) => string;
  onDeleted: () => void;
}) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <>
      <Sheet
        isOpen={expense !== null && !confirmDelete}
        onOpenChange={(o) => !o && onClose()}
        title={expense?.title ?? ''}
        footer={
          expense && tripOpen ? (
            <div className="flex w-full gap-2">
              {canDelete ? (
                <Button variant="danger-soft" onPress={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Xóa
                </Button>
              ) : null}
              <Button
                className="flex-1"
                variant="secondary"
                onPress={() => {
                  onClose();
                  navigate(`/trips/${expense.trip_id}/expenses/${expense.id}/edit`);
                }}
              >
                <PencilLine className="h-4 w-4" /> Sửa khoản chi
              </Button>
            </div>
          ) : null
        }
      >
        {expense ? (
          <div className="space-y-5">
            <Money value={expense.amount} size="display" />

            <dl className="divide-y divide-border rounded-xl bg-surface-secondary/60 text-sm">
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <dt className="text-muted">Người trả</dt>
                <dd className="truncate font-semibold text-foreground">{nameOf(expense.paid_by)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <dt className="text-muted">Ngày</dt>
                <dd className="tabular font-medium text-foreground">{formatDateTimeVN(new Date(expense.date))}</dd>
              </div>
            </dl>

            {expense.note ? (
              <section>
                <p className="mb-1.5 text-[13px] font-bold text-muted">Ghi chú</p>
                <p className="whitespace-pre-line text-sm leading-6 text-foreground">{expense.note}</p>
              </section>
            ) : null}

            {expense.image_url ? (
              <section>
                <p className="mb-1.5 text-[13px] font-bold text-muted">Hình ảnh</p>
                <a href={expense.image_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl bg-surface-secondary">
                  <img src={expense.image_url} alt={`Ảnh hoá đơn ${expense.title}`} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                </a>
              </section>
            ) : null}

            <section>
              <div className="mb-2 flex items-center gap-2">
                <p className="text-[13px] font-bold text-muted">Chia tiền</p>
                <Pill tone="muted">{SPLIT_LABEL[expense.split_type] ?? expense.split_type}</Pill>
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border">
                {expense.expense_splits.map((s) => (
                  <li key={s.id ?? s.member_id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <span className="truncate text-foreground">{nameOf(s.member_id)}</span>
                    <Money value={s.amount} size="sm" />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </Sheet>

      <ConfirmDialog
        isOpen={confirmDelete}
        onOpenChange={(o) => {
          setConfirmDelete(o);
        }}
        title="Xóa khoản chi"
        description={`Xóa "${expense?.title ?? ''}"?`}
        confirmLabel="Xóa"
        pendingLabel="Đang xóa..."
        onConfirm={async () => {
          if (!expense) return;
          try {
            await deleteExpense(expense);
            showSuccess('Đã xóa khoản chi', expense.title);
            onClose();
            onDeleted();
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
    </>
  );
}
