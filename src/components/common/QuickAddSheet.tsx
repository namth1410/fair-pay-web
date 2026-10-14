import { Spinner } from '@heroui/react';
import { Camera, ChevronRight, Images, MapPin, PencilLine, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { createExpense } from '../../services/expense.service';
import { applyPresetToTrip, type ExpensePreset, isFullPreset } from '../../services/preset.service';
import { useGroupStore } from '../../stores/group.store';
import { getPresetsForContext, usePresetStore } from '../../stores/preset.store';
import { useTripStore } from '../../stores/trip.store';
import { useUIStore } from '../../stores/ui.store';
import { getErrorMessage } from '../../utils/error';
import { formatVND } from '../../utils/format';
import { processImageFile } from '../../utils/imageProcessing';
import { setPendingImage } from '../../utils/pendingImage';
import { showError, showSuccess, showWarning } from '../../utils/toast';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { ErrorBox } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

/** Nút "+" ở dock/sidebar: preset 1 chạm + chụp/chọn ảnh hoá đơn + nhập tay. */
export function QuickAddSheet() {
  const isOpen = useUIStore((s) => s.quickAddOpen);
  const setOpen = useUIStore((s) => s.setQuickAddOpen);
  const navigate = useNavigate();

  const presets = usePresetStore((s) => s.presets);
  const presetsLoaded = usePresetStore((s) => s.loaded);
  const loadPresets = usePresetStore((s) => s.loadPresets);
  const allUserTrips = useTripStore((s) => s.allUserTrips);
  const loadAllUserTrips = useTripStore((s) => s.loadAllUserTrips);

  const [picking, setPicking] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const [confirmPreset, setConfirmPreset] = useState<ExpensePreset | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPickError(null);
    if (!presetsLoaded) void loadPresets().catch(() => {});
    void loadAllUserTrips().catch(() => {});
  }, [isOpen, presetsLoaded, loadPresets, loadAllUserTrips]);

  const tripName = useMemo(() => {
    const map = new Map((allUserTrips ?? []).map((t) => [t.id, t.name]));
    return (id: string | null) => (id ? map.get(id) ?? 'Chuyến đi' : null);
  }, [allUserTrips]);

  const contextPresets = useMemo(() => getPresetsForContext(presets, { tripId: null }), [presets]);

  const goNew = (extra: Record<string, string> = {}) => {
    const params = new URLSearchParams({ expenseId: crypto.randomUUID(), ...extra });
    setOpen(false);
    navigate(`/expenses/new?${params.toString()}`);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setPicking(true);
    setPickError(null);
    try {
      const img = await processImageFile(file);
      setPendingImage(img);
      goNew({ withImage: '1' });
    } catch (e) {
      setPickError(getErrorMessage(e));
    } finally {
      setPicking(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (libraryRef.current) libraryRef.current.value = '';
    }
  };

  const onPresetPress = (p: ExpensePreset) => {
    if (isFullPreset(p)) {
      setConfirmPreset(p);
      return;
    }
    const params = new URLSearchParams({
      expenseId: crypto.randomUUID(),
      prefillTitle: p.title,
      prefillAmount: String(p.amount),
    });
    setOpen(false);
    if (p.trip_id) {
      params.set('applyPresetId', p.id);
      navigate(`/trips/${p.trip_id}/expenses/new?${params.toString()}`);
    } else {
      navigate(`/expenses/new?${params.toString()}`);
    }
  };

  const createFromPreset = async () => {
    const p = confirmPreset;
    if (!p?.trip_id) return;
    try {
      const applied = await applyPresetToTrip(p, p.trip_id);
      await createExpense({
        tripId: p.trip_id,
        groupId: applied.tripGroupId,
        title: p.title,
        amount: p.amount,
        paidByMemberId: applied.paidByMemberId,
        splitType: applied.splitType,
        splits: applied.splits,
      });
      void useGroupStore.getState().loadBalanceSummary();
      const tripState = useTripStore.getState();
      if (tripState.currentTripId === p.trip_id) void tripState.refreshCurrentTrip();
      const desc = `${p.title} · ${formatVND(p.amount)}`;
      if (applied.warnings.length) showWarning('Đã tạo khoản chi', applied.warnings.join(' · '));
      else showSuccess('Đã tạo khoản chi', desc);
      setOpen(false);
    } catch (e) {
      showError(e, 'Lỗi tạo khoản chi');
      throw e;
    }
  };

  const rows = [
    {
      key: 'camera',
      icon: Camera,
      title: 'Chụp ảnh',
      sub: 'Mở camera để chụp hoá đơn',
      onClick: () => cameraRef.current?.click(),
    },
    {
      key: 'library',
      icon: Images,
      title: 'Chọn từ thư viện',
      sub: 'Lấy ảnh có sẵn trên máy',
      onClick: () => libraryRef.current?.click(),
    },
    {
      key: 'manual',
      icon: PencilLine,
      title: 'Nhập thủ công',
      sub: 'Tạo khoản chi không cần ảnh',
      onClick: () => goNew(),
    },
  ];

  return (
    <>
      <Sheet isOpen={isOpen} onOpenChange={setOpen} isLocked={picking} title="Thêm khoản chi mới" size="md">
        <div className="space-y-5">
          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Preset</p>
            {presetsLoaded && contextPresets.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted">
                Chưa có preset. Tạo preset để thêm khoản chi nhanh hơn.{' '}
                <Link to="/presets/new" onClick={() => setOpen(false)} className="font-semibold text-foreground underline-offset-2 hover:underline">
                  Tạo preset
                </Link>
              </div>
            ) : !presetsLoaded ? (
              <div className="flex h-16 items-center"><Spinner size="sm" color="current" className="text-muted" /></div>
            ) : (
              <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {contextPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onPresetPress(p)}
                    className="flex min-w-[148px] max-w-[200px] shrink-0 flex-col items-start rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-foreground/30"
                  >
                    <span className="flex w-full items-center gap-1">
                      <span className="truncate text-sm font-semibold text-foreground">{p.title}</span>
                      {isFullPreset(p) ? <Zap className="h-3.5 w-3.5 shrink-0 fill-current text-warning" /> : null}
                    </span>
                    <span className="tabular mt-0.5 text-sm text-muted">{formatVND(p.amount)}</span>
                    {p.trip_id ? (
                      <span className="mt-1 flex max-w-full items-center gap-1 text-[11px] text-muted">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{tripName(p.trip_id)}</span>
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}
          </section>

          <p className="text-xs leading-5 text-muted">
            Hoặc tạo khoản chi mới bên dưới. Ảnh sẽ được đính kèm làm bằng chứng (1:1, tối đa 2 MB).
          </p>

          <ErrorBox>{pickError}</ErrorBox>

          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
            {rows.map(({ key, icon: Icon, title, sub, onClick }) => (
              <button
                key={key}
                type="button"
                disabled={picking}
                onClick={onClick}
                className="flex w-full items-center gap-3 bg-surface px-4 py-3.5 text-left transition-colors hover:bg-surface-secondary disabled:opacity-60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-secondary">
                  <Icon className="h-5 w-5 text-foreground" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{title}</span>
                  <span className="block text-xs text-muted">{sub}</span>
                </span>
                {picking && key !== 'manual' ? (
                  <Spinner size="sm" color="current" className="text-muted" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted" />
                )}
              </button>
            ))}
          </div>

          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <input
            ref={libraryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
        </div>
      </Sheet>

      <ConfirmDialog
        isOpen={confirmPreset !== null}
        onOpenChange={(o) => !o && setConfirmPreset(null)}
        tone="accent"
        title="Tạo khoản chi mới?"
        description={
          confirmPreset
            ? `${confirmPreset.title} · ${formatVND(confirmPreset.amount)}\nVào chuyến: ${tripName(confirmPreset.trip_id) ?? ''}`
            : ''
        }
        confirmLabel="Tạo"
        pendingLabel="Đang tạo..."
        onConfirm={createFromPreset}
      />
    </>
  );
}
