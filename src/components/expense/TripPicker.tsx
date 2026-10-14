import { Spinner } from '@heroui/react';
import { Check, ChevronDown, MapPin, Plus, Search, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import type { TripWithGroup } from '../../services/trip.service';
import { useGroupStore } from '../../stores/group.store';
import { useTripStore } from '../../stores/trip.store';
import { useUIStore } from '../../stores/ui.store';
import { EmptyState } from '../ui/Primitives';
import { Sheet } from '../ui/Sheet';

export interface PickedTrip {
  tripId: string;
  tripName: string;
  groupId: string;
  groupName: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd');
}

/** Trường "Thêm vào" (bắt buộc) ở form thêm khoản chi từ trang chủ. */
export function AddToField({
  value,
  onChange,
}: {
  value: PickedTrip | null;
  onChange: (v: PickedTrip | null) => void;
}) {
  const trips = useTripStore((s) => s.allUserTrips);
  const loadAll = useTripStore((s) => s.loadAllUserTrips);
  const groups = useGroupStore((s) => s.groups);
  const groupsLoaded = useGroupStore((s) => s.groupsLoaded);
  const loadGroups = useGroupStore((s) => s.loadGroups);
  const openCreateJoin = useUIStore((s) => s.openCreateJoin);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    void loadAll().catch(() => {});
    if (!groupsLoaded) void loadGroups({ quiet: true }).catch(() => {});
  }, [loadAll, loadGroups, groupsLoaded]);

  const recent = useMemo(() => (trips ?? []).filter((t) => t.status === 'open').slice(0, 3), [trips]);

  const pick = (t: TripWithGroup) =>
    onChange({ tripId: t.id, tripName: t.name, groupId: t.group_id, groupName: t.group_name });

  if (groupsLoaded && groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-4 text-center">
        <p className="text-sm text-muted">Bạn chưa có nhóm nào</p>
        <button
          type="button"
          onClick={() => openCreateJoin('create')}
          className="mt-2 text-sm font-semibold text-foreground hover:underline"
        >
          Tạo nhóm mới
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">
        Thêm vào {!value ? <span className="text-danger">(bắt buộc)</span> : null}
      </p>
      {value ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-accent bg-surface px-3.5 py-2.5 text-left"
          >
            <MapPin className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{value.tripName}</span>
              <span className="block truncate text-xs text-muted">{value.groupName}</span>
            </span>
          </button>
          <button
            type="button"
            aria-label="Bỏ chọn nhóm/chuyến"
            onClick={() => onChange(null)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-secondary hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          {trips === null ? (
            <div className="flex h-12 items-center">
              <Spinner size="sm" color="current" className="text-muted" />
            </div>
          ) : recent.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {recent.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => pick(t)}
                  className="max-w-full rounded-2xl border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-accent"
                >
                  <span className="block truncate text-sm font-semibold text-foreground">{t.name}</span>
                  <span className="block truncate text-[11px] text-muted">{t.group_name}</span>
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-border px-3.5 py-3 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Tạo chuyến mới hoặc chọn từ nhóm
          </button>
        </>
      )}

      <TripPickerSheet
        isOpen={pickerOpen}
        onOpenChange={setPickerOpen}
        selectedTripId={value?.tripId ?? null}
        onPick={(t) => {
          pick(t);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function TripPickerSheet({
  isOpen,
  onOpenChange,
  selectedTripId,
  onPick,
}: {
  isOpen: boolean;
  onOpenChange: (o: boolean) => void;
  selectedTripId: string | null;
  onPick: (t: TripWithGroup) => void;
}) {
  const trips = useTripStore((s) => s.allUserTrips);
  const loading = useTripStore((s) => s.isLoadingAllUserTrips);
  const groups = useGroupStore((s) => s.groups);
  const openCreateJoin = useUIStore((s) => s.openCreateJoin);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const byGroup = useMemo(() => {
    const map = new Map<string, TripWithGroup[]>();
    for (const t of trips ?? []) {
      const arr = map.get(t.group_id) ?? [];
      arr.push(t);
      map.set(t.group_id, arr);
    }
    return map;
  }, [trips]);

  // Tự mở nhóm có 1–3 chuyến hoặc chứa chuyến đang chọn.
  const [wasOpen, setWasOpen] = useState(false);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) {
      setQuery('');
      const auto = new Set<string>();
      for (const g of groups) {
        const list = byGroup.get(g.id) ?? [];
        if ((list.length >= 1 && list.length <= 3) || list.some((t) => t.id === selectedTripId)) auto.add(g.id);
      }
      setExpanded(auto);
    }
  }

  const q = normalize(query.trim());
  const results = useMemo(
    () =>
      q
        ? (trips ?? []).filter((t) => normalize(t.name).includes(q) || normalize(t.group_name).includes(q))
        : [],
    [q, trips],
  );

  const Row = ({ t, showGroup }: { t: TripWithGroup; showGroup?: boolean }) => (
    <button
      type="button"
      onClick={() => onPick(t)}
      className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-secondary"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${t.status === 'open' ? 'bg-money-positive' : 'bg-muted/50'}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{t.name}</span>
        <span className="block truncate text-xs text-muted">
          {showGroup ? `${t.group_name} · ` : ''}
          {t.status === 'open' ? 'Đang mở' : 'Đã đóng'}
        </span>
      </span>
      {t.id === selectedTripId ? <Check className="h-4 w-4 text-foreground" /> : null}
    </button>
  );

  return (
    <Sheet isOpen={isOpen} onOpenChange={onOpenChange} title="Chọn nhóm và chuyến">
      <div className="space-y-3">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-field px-3">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm nhóm hoặc chuyến..."
            className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-field-placeholder"
          />
        </label>

        {loading && !trips ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
            <Spinner size="sm" color="current" /> Đang tải...
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Chưa có nhóm nào"
            subtitle="Tạo nhóm mới để bắt đầu chia tiền"
            action={
              <button
                type="button"
                className="text-sm font-semibold text-foreground hover:underline"
                onClick={() => {
                  onOpenChange(false);
                  openCreateJoin('create');
                }}
              >
                Tạo nhóm
              </button>
            }
          />
        ) : q ? (
          results.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Không tìm thấy chuyến nào phù hợp</p>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {results.map((t) => (
                <Row key={t.id} t={t} showGroup />
              ))}
            </div>
          )
        ) : (
          <div className="space-y-2">
            {groups.map((g) => {
              const list = byGroup.get(g.id) ?? [];
              const open = expanded.has(g.id);
              return (
                <div key={g.id} className="overflow-hidden rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(g.id)) next.delete(g.id);
                        else next.add(g.id);
                        return next;
                      })
                    }
                    className="flex w-full items-center gap-3 bg-surface px-3.5 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{g.name}</span>
                      <span className="block text-xs text-muted">{list.length} chuyến</span>
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open ? (
                    <div className="divide-y divide-border border-t border-border bg-surface">
                      {list.map((t) => (
                        <Row key={t.id} t={t} />
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          onOpenChange(false);
                          navigate(`/groups/${g.id}`);
                        }}
                        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-muted hover:bg-surface-secondary hover:text-foreground"
                      >
                        <Plus className="h-4 w-4" /> Tạo chuyến mới
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
