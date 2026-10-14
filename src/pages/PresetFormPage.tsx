import { Button, Spinner } from '@heroui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router';

import { type SplitMember, SplitEditor, type SplitState } from '../components/expense/SplitEditor';
import { PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TextInputField } from '../components/ui/Field';
import { MoneyInput } from '../components/ui/MoneyInput';
import { PageSpinner } from '../components/ui/PageSpinner';
import { ChipPicker, ErrorBox, Panel, Pill } from '../components/ui/Primitives';
import { fetchGroupMembers, type GroupMember } from '../services/group.service';
import type { PresetCreateParams, PresetSplitEntry, PresetSplitType } from '../services/preset.service';
import { fetchTripById, fetchTrips, type Trip } from '../services/trip.service';
import { useGroupStore } from '../stores/group.store';
import { usePresetStore } from '../stores/preset.store';
import { getErrorMessage } from '../utils/error';
import { parseMoneyInput } from '../utils/format';
import { resolveRatio } from '../utils/split';
import { showSuccess } from '../utils/toast';

type Scope = 'global' | 'trip';
type ModeChoice = 'none' | PresetSplitType;

export default function PresetFormPage() {
  const { presetId } = useParams();
  const isEdit = !!presetId;
  const navigate = useNavigate();

  const presets = usePresetStore((s) => s.presets);
  const presetsLoaded = usePresetStore((s) => s.loaded);
  const loadPresets = usePresetStore((s) => s.loadPresets);
  const addPreset = usePresetStore((s) => s.addPreset);
  const editPreset = usePresetStore((s) => s.editPreset);
  const groups = useGroupStore((s) => s.groups);
  const groupsLoaded = useGroupStore((s) => s.groupsLoaded);
  const loadGroups = useGroupStore((s) => s.loadGroups);

  const editing = isEdit ? presets.find((p) => p.id === presetId) ?? null : null;

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState<Scope>('global');
  const [groupId, setGroupId] = useState<string | null>(null);
  const [tripId, setTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [paidBy, setPaidBy] = useState<string>('none');
  const [mode, setMode] = useState<ModeChoice>('none');
  const [split, setSplit] = useState<SplitState>({ mode: 'equal', participants: new Set(), ratios: {}, customAmounts: {} });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(!isEdit);

  const savedRef = useRef(false);
  const proceedingRef = useRef(false);

  useEffect(() => {
    if (!presetsLoaded) void loadPresets().catch(() => {});
    if (!groupsLoaded) void loadGroups({ quiet: true }).catch(() => {});
  }, [presetsLoaded, loadPresets, groupsLoaded, loadGroups]);

  // Nạp preset đang sửa (tìm nhóm qua chuyến).
  useEffect(() => {
    if (!isEdit || hydrated || !presetsLoaded) return;
    if (!editing) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    (async () => {
      setTitle(editing.title);
      setAmount(String(editing.amount));
      if (editing.trip_id) {
        setScope('trip');
        const trip = await fetchTripById(editing.trip_id).catch(() => null);
        if (cancelled) return;
        if (trip) {
          setGroupId(trip.group_id);
          setTripId(trip.id);
        }
        setPaidBy(editing.paid_by_member_id ?? 'none');
        if (editing.split_type && editing.splits_data) {
          setMode(editing.split_type);
          setSplit({
            mode: editing.split_type,
            participants: new Set(editing.splits_data.map((s) => s.member_id)),
            ratios: Object.fromEntries(editing.splits_data.map((s) => [s.member_id, String(s.ratio ?? 1)])),
            customAmounts: Object.fromEntries(editing.splits_data.map((s) => [s.member_id, String(s.amount ?? 0)])),
          });
        }
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, hydrated, presetsLoaded, editing]);

  // Chuyến của nhóm đã chọn.
  useEffect(() => {
    if (!groupId) {
      setTrips([]);
      return;
    }
    let cancelled = false;
    setTripsLoading(true);
    fetchTrips(groupId)
      .then((list) => !cancelled && setTrips(list))
      .catch(() => !cancelled && setTrips([]))
      .finally(() => !cancelled && setTripsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Thành viên (khi đã chọn chuyến).
  useEffect(() => {
    if (!tripId || !groupId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    fetchGroupMembers(groupId)
      .then((list) => !cancelled && setMembers(list))
      .catch(() => !cancelled && setMembers([]));
    return () => {
      cancelled = true;
    };
  }, [tripId, groupId]);

  const splitMembers: SplitMember[] = useMemo(() => members.map((m) => ({ id: m.id, name: m.display_name })), [members]);
  const amountValue = parseInt(parseMoneyInput(amount) || '0', 10) || 0;

  const snapshot = JSON.stringify({ title, amount, scope, groupId, tripId, paidBy, mode, p: [...split.participants].sort(), r: split.ratios, c: split.customAmounts });
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  if (hydrated && initialSnapshot === null) setInitialSnapshot(snapshot);
  const dirty = hydrated && initialSnapshot !== null && initialSnapshot !== snapshot;

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !savedRef.current && !busy && currentLocation.pathname !== nextLocation.pathname,
  );

  const changeScope = (s: Scope) => {
    setScope(s);
    if (s === 'global') {
      setGroupId(null);
      setTripId(null);
      setPaidBy('none');
      setMode('none');
    }
  };
  const changeGroup = (id: string) => {
    setGroupId(id);
    setTripId(null);
    setPaidBy('none');
    setMode('none');
  };
  const changeMode = (m: ModeChoice) => {
    setMode(m);
    if (m !== 'none') {
      setSplit((prev) => ({
        ...prev,
        mode: m,
        participants: prev.participants.size ? prev.participants : new Set(members.map((x) => x.id)),
      }));
    }
  };

  const submit = async () => {
    setError(null);
    const trimmed = title.trim();
    if (!trimmed) return setError('Vui lòng nhập tên preset');
    if (!amount) return setError('Vui lòng nhập số tiền');
    if (amountValue <= 0) return setError('Số tiền phải lớn hơn 0');
    if (amountValue % 1000 !== 0) return setError('Số tiền phải là bội của 1.000đ');

    const params: PresetCreateParams = { title: trimmed, amount: amountValue };
    if (scope === 'trip') {
      if (!groupId) return setError('Vui lòng chọn nhóm');
      if (!tripId) return setError('Vui lòng chọn chuyến đi');
      params.tripId = tripId;
      params.paidByMemberId = paidBy === 'none' ? null : paidBy;
      if (mode !== 'none') {
        const picked = members.filter((m) => split.participants.has(m.id));
        if (picked.length === 0) return setError('Chọn ít nhất 1 thành viên cho cách chia');
        let data: PresetSplitEntry[];
        if (mode === 'equal') {
          data = picked.map((m) => ({ member_id: m.id }));
        } else if (mode === 'ratio') {
          const ratios = picked.map((m) => ({ member_id: m.id, ratio: resolveRatio(split.ratios[m.id]) }));
          if (ratios.some((r) => r.ratio <= 0)) return setError('Tỷ lệ phải lớn hơn 0');
          if (ratios.some((r) => r.ratio > 99)) return setError('Tỷ lệ tối đa là 99');
          data = ratios;
        } else {
          data = picked.map((m) => ({
            member_id: m.id,
            amount: parseInt(parseMoneyInput(split.customAmounts[m.id] ?? '') || '0', 10),
          }));
          if (data.some((d) => (d.amount ?? 0) < 0)) return setError('Số tiền mỗi người không được âm');
          const sum = data.reduce((acc, d) => acc + (d.amount ?? 0), 0);
          if (sum !== amountValue) {
            return setError(
              `Tổng chia (${sum.toLocaleString('vi-VN')}đ) khác số tiền (${amountValue.toLocaleString('vi-VN')}đ)`,
            );
          }
        }
        params.splitType = mode;
        params.splitsData = data;
      }
    }

    setBusy(true);
    try {
      if (isEdit && presetId) await editPreset(presetId, params);
      else await addPreset(params);
      showSuccess(isEdit ? 'Đã cập nhật preset' : 'Đã thêm preset', trimmed);
      savedRef.current = true;
      navigate('/presets', { replace: true });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pageTitle = isEdit ? 'Sửa preset' : 'Thêm preset';
  if (isEdit && (!presetsLoaded || !hydrated)) {
    return (
      <>
        <PageHeader title={pageTitle} back="/presets" />
        <PageSpinner />
      </>
    );
  }
  if (isEdit && !editing) {
    return (
      <>
        <PageHeader title={pageTitle} back="/presets" />
        <p className="py-10 text-center text-sm text-muted">Preset không tồn tại hoặc đã bị xóa.</p>
      </>
    );
  }

  return (
    <>
      <PageHeader title={pageTitle} back="/presets" />
      <form
        className="space-y-5 pb-8"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        <Panel className="space-y-4 p-4">
          <TextInputField label="Tên preset" value={title} onChange={setTitle} placeholder="VD: Cà phê sáng" maxLength={100} autoFocus={!isEdit} />
          <MoneyInput label="Số tiền (VND)" value={amount} onChange={setAmount} size="lg" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Phạm vi</p>
            <ChipPicker
              ariaLabel="Phạm vi preset"
              value={scope}
              onChange={changeScope}
              options={[
                { value: 'global', label: 'Mọi nhóm' },
                { value: 'trip', label: 'Gắn chuyến đi' },
              ]}
            />
          </div>
        </Panel>

        {scope === 'trip' ? (
          <Panel className="space-y-4 p-4">
            <p className="text-sm font-semibold text-foreground">Áp dụng cho chuyến đi</p>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted">Nhóm</p>
              {groups.length === 0 ? (
                <p className="text-sm text-muted">Chưa có nhóm — tạo nhóm trước khi gắn preset.</p>
              ) : (
                <ChipPicker
                  ariaLabel="Nhóm"
                  value={groupId}
                  onChange={changeGroup}
                  options={groups.map((g) => ({ value: g.id, label: g.name }))}
                />
              )}
            </div>
            {groupId ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Chuyến đi</p>
                {tripsLoading ? (
                  <Spinner size="sm" color="current" className="text-muted" />
                ) : trips.length === 0 ? (
                  <p className="text-sm text-muted">Nhóm này chưa có chuyến đi.</p>
                ) : (
                  <ChipPicker
                    ariaLabel="Chuyến đi"
                    value={tripId}
                    onChange={setTripId}
                    options={trips.map((t) => ({ value: t.id, label: t.name }))}
                  />
                )}
              </div>
            ) : null}
          </Panel>
        ) : null}

        {scope === 'trip' && tripId ? (
          <Panel className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Pre-fill 1-tap</p>
              <Pill tone="muted">Tùy chọn</Pill>
            </div>
            <p className="-mt-2 text-xs leading-5 text-muted">
              Lưu sẵn người trả và cách chia để tạo khoản chi chỉ với 1 chạm.
            </p>
            {members.length === 0 ? (
              <Spinner size="sm" color="current" className="text-muted" />
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted">Người trả</p>
                  <ChipPicker
                    ariaLabel="Người trả"
                    value={paidBy}
                    onChange={setPaidBy}
                    options={[{ value: 'none', label: 'Không chọn' }, ...members.map((m) => ({ value: m.id, label: m.display_name }))]}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted">Cách chia</p>
                  <ChipPicker
                    ariaLabel="Cách chia"
                    value={mode}
                    onChange={changeMode}
                    options={[
                      { value: 'none', label: 'Không lưu' },
                      { value: 'equal', label: 'Chia đều' },
                      { value: 'ratio', label: 'Tỷ lệ' },
                      { value: 'custom', label: 'Cố định' },
                    ]}
                  />
                </div>
                {mode !== 'none' ? (
                  <SplitEditor
                    hideModeTabs
                    members={splitMembers}
                    amount={amountValue}
                    state={{ ...split, mode }}
                    onChange={(next) => setSplit(next)}
                  />
                ) : null}
              </>
            )}
          </Panel>
        ) : null}

        <ErrorBox>{error}</ErrorBox>

        <div className="flex gap-2">
          <Button variant="secondary" isDisabled={busy} onPress={() => navigate('/presets')}>
            Hủy
          </Button>
          <Button type="submit" className="flex-1" isPending={busy} isDisabled={!title.trim() || !amount}>
            {busy ? 'Đang lưu...' : isEdit ? 'Cập nhật' : 'Thêm'}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={blocker.state === 'blocked'}
        onOpenChange={(o) => {
          if (!o && !proceedingRef.current && blocker.state === 'blocked') blocker.reset();
        }}
        tone="warning"
        title="Thoát mà chưa lưu?"
        description="Dữ liệu đã nhập sẽ bị mất. Bạn có chắc muốn thoát?"
        cancelLabel="Ở lại"
        confirmLabel="Thoát"
        onConfirm={() => {
          proceedingRef.current = true;
          if (blocker.state === 'blocked') blocker.proceed();
        }}
      />
    </>
  );
}
