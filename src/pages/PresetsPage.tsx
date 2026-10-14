import { Button, Skeleton } from '@heroui/react';
import { Bookmark, MapPin, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { HeaderIconButton, PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/Primitives';
import { type ExpensePreset, isFullPreset } from '../services/preset.service';
import { usePresetStore } from '../stores/preset.store';
import { useTripStore } from '../stores/trip.store';
import { formatVND } from '../utils/format';
import { showError, showSuccess } from '../utils/toast';

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
    <>
      <PageHeader
        title="Preset khoản chi"
        right={
          <HeaderIconButton label="Thêm preset mới" onClick={() => navigate('/presets/new')}>
            <Plus className="h-5 w-5" />
          </HeaderIconButton>
        }
      />

      <p className="mb-4 text-sm leading-5 text-muted">
        Lưu sẵn những khoản chi hay lặp lại (cà phê, gửi xe, tiền phòng…). Preset gắn chuyến đi có đủ người trả và
        cách chia sẽ tạo khoản chi chỉ với <span className="font-semibold text-foreground">1 chạm</span>.
      </p>

      {loading && !loaded ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[76px] rounded-2xl" />
          ))}
        </div>
      ) : presets.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Chưa có preset"
          subtitle="Tạo preset để dùng nhanh khi thêm khoản chi hay lặp lại."
          action={
            <Button onPress={() => navigate('/presets/new')}>
              <Plus className="h-4 w-4" /> Thêm preset
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {presets.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-border/70 bg-surface p-2 pl-4 shadow-surface">
              <button type="button" onClick={() => navigate(`/presets/${p.id}`)} className="min-w-0 flex-1 py-1.5 text-left">
                <span className="flex items-center gap-2">
                  <span className="truncate text-[15px] font-semibold text-foreground">{p.title}</span>
                  {isFullPreset(p) ? (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[color-mix(in_oklab,var(--warning)_18%,transparent)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]">
                      <Zap className="h-3 w-3 fill-current" /> 1-tap
                    </span>
                  ) : null}
                </span>
                <span className="tabular block text-sm text-muted">{formatVND(p.amount)}</span>
                {p.trip_id ? (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{tripName(p.trip_id)}</span>
                  </span>
                ) : null}
              </button>
              <Button isIconOnly variant="ghost" size="sm" aria-label={`Sửa ${p.title}`} onPress={() => navigate(`/presets/${p.id}`)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button isIconOnly variant="ghost" size="sm" aria-label={`Xóa ${p.title}`} onPress={() => setDeleting(p)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Xóa preset?"
        description={`Xóa "${deleting?.title ?? ''}" khỏi danh sách preset. Hành động này không hoàn tác.`}
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
    </>
  );
}
