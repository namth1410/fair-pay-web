import { Button } from '@heroui/react';
import { MapPin, Plus, Trash2, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { HeaderIconButton, TabPage } from '../components/layout/LargeTitleHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/Primitives';
import { RowsSkeleton } from '../components/ui/Skeleton';
import { type ExpensePreset, isFullPreset } from '../services/preset.service';
import { usePresetStore } from '../stores/preset.store';
import { useTripStore } from '../stores/trip.store';
import { formatVND } from '../utils/format';
import { pastelIndex } from '../utils/seedGradient';
import { showError, showSuccess } from '../utils/toast';

/** Preset khoản chi — danh sách phẳng kiểu app (giao diện "Hội thoại"). */
export default function PresetsPage() {
  const navigate = useNavigate();
  const presets = usePresetStore((s) => s.presets);
  const loading = usePresetStore((s) => s.loading);
  const loaded = usePresetStore((s) => s.loaded);
  const loadPresets = usePresetStore((s) => s.loadPresets);
  const removePreset = usePresetStore((s) => s.removePreset);
  const allTrips = useTripStore((s) => s.allUserTrips);
  const loadAllUserTrips = useTripStore((s) => s.loadAllUserTrips);
  const [deleting, setDeleting] = useState<ExpensePreset | null>(null);

  useEffect(() => {
    void loadPresets().catch((e) => showError(e));
    void loadAllUserTrips().catch(() => {});
  }, [loadPresets, loadAllUserTrips]);

  const tripName = useMemo(() => {
    const map = new Map((allTrips ?? []).map((t) => [t.id, t.name]));
    return (id: string) => map.get(id) ?? 'Chuyến đi';
  }, [allTrips]);

  return (
    <TabPage
      title="Preset"
      right={<HeaderIconButton icon={Plus} label="Thêm preset mới" onClick={() => navigate('/presets/new')} />}
    >
      {loading && !loaded ? (
        <RowsSkeleton count={5} leading="tile" size={52} minHeight={74} />
      ) : presets.length === 0 ? (
        <EmptyState
          icon={Zap}
          title="Chưa có preset"
          subtitle="Lưu sẵn khoản chi hay lặp lại (cà phê, gửi xe…). Preset gắn chuyến có đủ người trả + cách chia tạo khoản chi chỉ với 1 chạm."
          action={
            <Button onPress={() => navigate('/presets/new')}>
              <Plus className="h-4 w-4" /> Tạo preset
            </Button>
          }
        />
      ) : (
        <ul aria-label="Preset của bạn">
          {presets.map((p) => {
            const full = isFullPreset(p);
            return (
              <li key={p.id} className="group relative flex min-h-[74px] items-center transition-colors hover:bg-surface-secondary">
                <button
                  type="button"
                  onClick={() => navigate(`/presets/${p.id}`)}
                  aria-label={`Sửa preset ${p.title}`}
                  className="flex min-w-0 flex-1 items-center gap-3 self-stretch pl-4 text-left"
                >
                  <span
                    className={`pastel-${pastelIndex(p.trip_id ?? p.id)} flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px]`}
                    style={{ background: 'var(--pastel-bg)', color: 'var(--pastel-fg)' }}
                  >
                    {p.trip_id ? <MapPin className="h-[22px] w-[22px]" /> : <Zap className="h-[22px] w-[22px]" />}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col justify-center gap-[3px] self-stretch border-b border-border py-3 pr-14">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-base font-bold text-foreground">{p.title}</span>
                      {full ? (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-accent">
                          <Zap className="h-3 w-3 fill-current" /> 1 chạm
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-[13px] text-muted">
                      <span className="tabular">{formatVND(p.amount)}</span> · {p.trip_id ? tripName(p.trip_id) : 'Mọi chuyến'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label={`Xóa preset ${p.title}`}
                  title="Xóa preset"
                  onClick={() => setDeleting(p)}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger-tint hover:text-danger"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa preset?"
        description={`Xóa "${deleting?.title ?? ''}" khỏi danh sách preset. Khoản chi đã tạo từ preset không bị ảnh hưởng.`}
        confirmLabel="Xóa"
        pendingLabel="Đang xóa..."
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await removePreset(deleting.id);
            showSuccess('Đã xóa preset', deleting.title);
          } catch (e) {
            showError(e);
            throw e;
          }
        }}
      />
    </TabPage>
  );
}
