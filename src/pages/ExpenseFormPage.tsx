import { Button, Label, Switch } from '@heroui/react';
import { Camera, CircleAlert, ImagePlus, Images, MapPin, TriangleAlert, X, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router';

import { computeSplits, type SplitMember, SplitEditor, type SplitState } from '../components/expense/SplitEditor';
import { MemberAvatarPicker } from '../components/expense/MemberAvatarPicker';
import { AddToField, type PickedTrip } from '../components/expense/TripPicker';
import { GroupTripsPane } from '../components/group/GroupTripsPane';
import { ChatLayout } from '../components/layout/ChatLayout';
import { PageFrame, PageHeader } from '../components/layout/PageHeader';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { TextAreaField, TextInputField } from '../components/ui/Field';
import { MoneyInput } from '../components/ui/MoneyInput';
import { PageSpinner } from '../components/ui/PageSpinner';
import { EmptyState, ErrorBox, Panel } from '../components/ui/Primitives';
import {
  createExpense,
  editExpense,
  type ExpenseWithSplits,
  fetchExpenseById,
  uploadExpenseImage,
} from '../services/expense.service';
import { fetchAllGroupMembers, fetchGroupById, fetchGroupMembers, type GroupMember } from '../services/group.service';
import { type ExpensePreset, isFullPreset } from '../services/preset.service';
import { fetchTripById } from '../services/trip.service';
import { useIsWide } from '../hooks/useMediaQuery';
import { useAuthStore } from '../stores/auth.store';
import { useGroupStore } from '../stores/group.store';
import { getPresetsForContext, usePresetStore } from '../stores/preset.store';
import { useTripStore } from '../stores/trip.store';
import { getErrorMessage } from '../utils/error';
import { formatDateTimeVN, formatVND, parseMoneyInput } from '../utils/format';
import { type ProcessedImage, processImageFile } from '../utils/imageProcessing';
import { takePendingImage } from '../utils/pendingImage';
import { resolveRatio, validateAmount, validateSplits } from '../utils/split';
import { showError, showSuccess, showWarning } from '../utils/toast';

type ImageState = { kind: 'none' } | { kind: 'existing'; url: string } | { kind: 'new'; image: ProcessedImage };

interface TripCtx {
  tripId: string;
  tripName: string;
  groupId: string;
  groupName: string;
  status: 'open' | 'closed';
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
function weekdayVN(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

const emptySplit = (ids: string[]): SplitState => ({
  mode: 'equal',
  participants: new Set(ids),
  ratios: {},
  customAmounts: {},
});

export default function ExpenseFormPage() {
  const { tripId: routeTripId, expenseId: editId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!editId;
  const wide = useIsWide();
  // Cột "các chuyến của nhóm" chỉ hiện khi danh sách đã nạp sẵn (đi từ luồng chuyến sang).
  const tripsListGroupId = useTripStore((s) => s.currentTripsGroupId);

  const profileId = useAuthStore((s) => s.profile?.id ?? null);
  const presets = usePresetStore((s) => s.presets);
  const presetsLoaded = usePresetStore((s) => s.loaded);
  const loadPresets = usePresetStore((s) => s.loadPresets);
  const addPreset = usePresetStore((s) => s.addPreset);

  // Id khoản chi mới cố định trong suốt form (key ảnh R2 + idempotency).
  const [newExpenseId] = useState(() => searchParams.get('expenseId') || crypto.randomUUID());

  const [ctx, setCtx] = useState<TripCtx | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [extraMembers, setExtraMembers] = useState<GroupMember[]>([]); // người đã rời còn trong khoản chi (edit)
  const [membersLoading, setMembersLoading] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithSplits | null>(null);

  const [title, setTitle] = useState(() => (isEdit ? '' : searchParams.get('prefillTitle') ?? ''));
  const [amount, setAmount] = useState(() => {
    const raw = searchParams.get('prefillAmount');
    const n = raw ? Number(raw) : NaN;
    return !isEdit && Number.isInteger(n) && n > 0 ? String(n) : '';
  });
  const [date, setDate] = useState(() => toLocalInput(new Date()));
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [split, setSplit] = useState<SplitState>(emptySplit([]));
  const [image, setImage] = useState<ImageState>(() => {
    if (!isEdit && searchParams.get('withImage') === '1') {
      const img = takePendingImage();
      if (img) return { kind: 'new', image: img };
    }
    return { kind: 'none' };
  });
  const [savePreset, setSavePreset] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);

  const savedRef = useRef(false);
  const proceedingRef = useRef(false);
  const presetAppliedRef = useRef(false);
  const libraryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  // ── Tải chuyến (route có tripId hoặc từ khoản chi đang sửa) ──────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let tripId = routeTripId ?? null;
        if (isEdit && editId) {
          const exp = await fetchExpenseById(editId);
          if (cancelled) return;
          if (!exp) {
            setCtxError('Không tải được khoản chi. Kiểm tra kết nối hoặc mở lại từ chuyến đi.');
            return;
          }
          setEditing(exp);
          tripId = exp.trip_id;
        }
        if (!tripId) return;
        const trip = await fetchTripById(tripId);
        if (cancelled) return;
        if (!trip) {
          setCtxError('Không tải được chuyến đi. Kiểm tra kết nối hoặc mở lại từ nhóm.');
          return;
        }
        const group = await fetchGroupById(trip.group_id);
        if (cancelled) return;
        setCtx({
          tripId: trip.id,
          tripName: trip.name,
          groupId: trip.group_id,
          groupName: group?.name ?? '',
          status: trip.status,
        });
      } catch (e) {
        if (!cancelled) setCtxError(getErrorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routeTripId, editId, isEdit]);

  useEffect(() => {
    if (!presetsLoaded) void loadPresets().catch(() => {});
  }, [presetsLoaded, loadPresets]);

  // ── Thành viên của nhóm chứa chuyến ───────────────────────────────────────
  const groupId = ctx?.groupId ?? null;
  useEffect(() => {
    if (!groupId) {
      setMembers([]);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    (async () => {
      try {
        const active = await fetchGroupMembers(groupId);
        if (cancelled) return;
        setMembers(active);
        if (isEdit) {
          const all = await fetchAllGroupMembers(groupId);
          if (!cancelled) setExtraMembers(all.filter((m) => m.left_at));
        }
      } catch (e) {
        if (!cancelled) showError(e, 'Không tải được thành viên');
      } finally {
        if (!cancelled) setMembersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId, isEdit]);

  // Danh sách hiển thị: thành viên đang hoạt động (+ người đã rời còn dính trong khoản chi khi sửa).
  const formMembers: SplitMember[] = useMemo(() => {
    const list = members.map((m) => ({ id: m.id, name: m.display_name }));
    if (isEdit && editing) {
      const ref = new Set([editing.paid_by, ...editing.expense_splits.map((s) => s.member_id)]);
      for (const m of extraMembers) {
        if (ref.has(m.id) && !list.some((x) => x.id === m.id)) list.push({ id: m.id, name: `${m.display_name} (đã rời)` });
      }
    }
    return list;
  }, [members, extraMembers, isEdit, editing]);

  const myMemberId = useMemo(() => members.find((m) => m.user_id === profileId)?.id ?? null, [members, profileId]);

  // ── Khởi tạo state khi đủ dữ liệu ─────────────────────────────────────────
  const initKey = `${groupId ?? ''}|${members.length}|${editing?.id ?? ''}|${extraMembers.length}`;
  const [initedKey, setInitedKey] = useState('');
  if (members.length > 0 && initKey !== initedKey && (!isEdit || editing)) {
    setInitedKey(initKey);
    if (isEdit && editing) {
      const ids = editing.expense_splits.map((s) => s.member_id);
      setTitle(editing.title);
      setAmount(String(editing.amount));
      setNote(editing.note ?? '');
      setDate(toLocalInput(new Date(editing.date)));
      setPaidBy(editing.paid_by);
      setImage(editing.image_url ? { kind: 'existing', url: editing.image_url } : { kind: 'none' });
      // ratio không lưu → hiển thị lại dạng "Tùy chỉnh" với số tiền chính xác (như app).
      setSplit({
        mode: editing.split_type === 'equal' ? 'equal' : 'custom',
        participants: new Set(ids),
        ratios: {},
        customAmounts: Object.fromEntries(editing.expense_splits.map((s) => [s.member_id, String(s.amount)])),
      });
    } else {
      setPaidBy((prev) => (prev && members.some((m) => m.id === prev) ? prev : myMemberId ?? members[0]?.id ?? null));
      setSplit(emptySplit(members.map((m) => m.id)));
    }
  }

  // Form "bẩn" — tạo mới: như app (đã nhập gì đó / đổi người tham gia); sửa: so với bản đã tải.
  const snapshot = JSON.stringify({
    title: title.trim(),
    amount,
    note: note.trim(),
    paidBy,
    date,
    mode: split.mode,
    participants: [...split.participants].sort(),
    custom: split.customAmounts,
    image: image.kind === 'new' ? 'new' : image.kind === 'existing' ? image.url : null,
  });
  const ready = members.length > 0 && (!isEdit || !!editing) && initKey === initedKey;
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  if (isEdit && ready && initialSnapshot === null) setInitialSnapshot(snapshot);
  const dirty = isEdit
    ? ready && initialSnapshot !== null && initialSnapshot !== snapshot
    : !!title.trim() ||
      !!amount ||
      !!note.trim() ||
      image.kind === 'new' ||
      savePreset ||
      Object.values(split.ratios).some(Boolean) ||
      Object.values(split.customAmounts).some(Boolean) ||
      (members.length > 0 && split.participants.size !== members.length);

  // ── Chặn rời trang khi còn thay đổi chưa lưu ──────────────────────────────
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !savedRef.current && !submitting && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (savedRef.current) return;
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ── Preset ────────────────────────────────────────────────────────────────
  const contextPresets = useMemo(
    () => (isEdit ? [] : getPresetsForContext(presets, { tripId: ctx?.tripId ?? null })),
    [presets, ctx?.tripId, isEdit],
  );
  const presetConflict =
    savePreset && !!title.trim() && presets.some((p) => p.trip_id === null && p.title.trim() === title.trim());

  const applyPreset = useCallback(
    (p: ExpensePreset) => {
      setTitle(p.title);
      setAmount(String(p.amount));
      setSavePreset(false);
      setError(null);
      const nextWarnings: string[] = [];
      if (ctx && p.trip_id === ctx.tripId && isFullPreset(p)) {
        const activeIds = new Set(members.map((m) => m.id));
        if (p.paid_by_member_id && activeIds.has(p.paid_by_member_id)) setPaidBy(p.paid_by_member_id);
        else if (p.paid_by_member_id) nextWarnings.push('Người trả mặc định trong preset đã rời nhóm, đặt lại theo nhóm');
        const data = p.splits_data ?? [];
        if (p.split_type && data.length > 0 && data.every((s) => activeIds.has(s.member_id))) {
          setSplit({
            mode: p.split_type,
            participants: new Set(data.map((s) => s.member_id)),
            ratios: Object.fromEntries(data.map((s) => [s.member_id, String(s.ratio ?? 1)])),
            customAmounts: Object.fromEntries(data.map((s) => [s.member_id, String(s.amount ?? 0)])),
          });
        } else if (p.split_type) {
          nextWarnings.push('Cách chia trong preset có thành viên đã rời nhóm, đặt mặc định chia đều');
          setSplit(emptySplit(members.map((m) => m.id)));
        }
      }
      setWarnings(nextWarnings);
    },
    [ctx, members],
  );

  // applyPresetId từ URL — áp 1 lần khi preset + thành viên + chuyến sẵn sàng.
  const applyPresetId = searchParams.get('applyPresetId');
  useEffect(() => {
    if (!applyPresetId || presetAppliedRef.current || !presetsLoaded || !ready || !ctx) return;
    const p = presets.find((x) => x.id === applyPresetId);
    presetAppliedRef.current = true;
    if (p && (p.trip_id === null || p.trip_id === ctx.tripId)) {
      applyPreset(p);
    }
  }, [applyPresetId, presetsLoaded, ready, ctx, presets, applyPreset]);

  // ── Ảnh ───────────────────────────────────────────────────────────────────
  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setImageBusy(true);
    try {
      const img = await processImageFile(file);
      setImage((prev) => {
        if (prev.kind === 'new') URL.revokeObjectURL(prev.image.previewUrl);
        return { kind: 'new', image: img };
      });
    } catch (e) {
      showError(e, 'Lỗi chọn ảnh');
    } finally {
      setImageBusy(false);
      if (libraryRef.current) libraryRef.current.value = '';
      if (cameraRef.current) cameraRef.current.value = '';
    }
  };
  const removeImage = () =>
    setImage((prev) => {
      if (prev.kind === 'new') URL.revokeObjectURL(prev.image.previewUrl);
      return { kind: 'none' };
    });

  // ── Submit ────────────────────────────────────────────────────────────────
  const goBack = () => {
    savedRef.current = true;
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(ctx ? `/trips/${ctx.tripId}` : '/', { replace: true });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!ctx) {
      setError(routeTripId || isEdit ? 'Không tìm thấy chuyến đi' : 'Vui lòng chọn nhóm và chuyến');
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return setError('Vui lòng nhập tên khoản chi');
    if (!amount) return setError('Vui lòng nhập số tiền');
    const value = parseInt(parseMoneyInput(amount) || '0', 10);
    if (!Number.isFinite(value) || value <= 0) return setError('Số tiền phải lớn hơn 0');
    const amountErr = validateAmount(value);
    if (amountErr) return setError(amountErr);
    if (!paidBy) return setError('Vui lòng chọn người trả');
    const when = new Date(date);
    if (Number.isNaN(when.getTime())) return setError('Ngày giờ không hợp lệ');
    if (when.getTime() > Date.now() + 60_000) return setError('Không thể chọn ngày trong tương lai');
    if (presetConflict) return setError('Đã có preset tên này, đổi tên hoặc bỏ tick "Lưu làm preset"');
    const picked = formMembers.filter((m) => split.participants.has(m.id));
    if (picked.length === 0) return setError('Chọn ít nhất 1 thành viên cho cách chia');
    if (split.mode === 'ratio' && picked.some((m) => resolveRatio(split.ratios[m.id]) <= 0)) {
      return setError('Tỷ lệ phải lớn hơn 0');
    }
    const splits = computeSplits(formMembers, value, split);
    if (!splits) return setError('Chọn ít nhất 1 thành viên cho cách chia');
    const splitsErr = validateSplits(value, splits);
    if (splitsErr) return setError(splitsErr);

    setSubmitting(true);
    try {
      let imageWarning: string | null = null;
      if (isEdit && editing) {
        await editExpense({
          expense: editing,
          title: trimmedTitle,
          amount: value,
          paidByMemberId: paidBy,
          splitType: split.mode,
          splits,
          note,
          date: when.toISOString(),
          imageUrl: image.kind === 'existing' ? image.url : image.kind === 'new' ? editing.image_url : null,
        });
        if (image.kind === 'new') {
          try {
            await uploadExpenseImage(editing.id, ctx.tripId, image.image);
          } catch (e) {
            imageWarning = getErrorMessage(e);
          }
        }
        showSuccess('Đã lưu thay đổi', trimmedTitle);
      } else {
        const created = await createExpense({
          id: newExpenseId,
          tripId: ctx.tripId,
          groupId: ctx.groupId,
          title: trimmedTitle,
          amount: value,
          paidByMemberId: paidBy,
          splitType: split.mode,
          splits,
          note,
          date: when.toISOString(),
        });
        if (image.kind === 'new') {
          try {
            await uploadExpenseImage(created.id, ctx.tripId, image.image);
          } catch (e) {
            imageWarning = getErrorMessage(e);
          }
        }
        showSuccess('Đã thêm khoản chi', trimmedTitle);
        if (savePreset && !presetConflict) {
          try {
            await addPreset({ title: trimmedTitle, amount: value });
            showSuccess('Đã lưu preset', trimmedTitle);
          } catch (e) {
            showError(e, 'Lỗi lưu preset');
          }
        }
      }
      if (imageWarning) showWarning('Chưa tải được ảnh hoá đơn', imageWarning);

      const tripState = useTripStore.getState();
      if (tripState.currentTripId === ctx.tripId) void tripState.refreshCurrentTrip();
      void useGroupStore.getState().loadBalanceSummary();
      goBack();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const pageTitle = isEdit ? 'Sửa khoản chi' : 'Thêm khoản chi';
  const needsPicker = !routeTripId && !isEdit;
  const amountValue = parseInt(parseMoneyInput(amount) || '0', 10) || 0;

  if (ctxError) {
    return (
      <PageFrame header={<PageHeader title={pageTitle} back />}>
        <EmptyState icon={CircleAlert} title={ctxError} />
      </PageFrame>
    );
  }
  if (!needsPicker && !ctx) {
    return (
      <PageFrame header={<PageHeader title={pageTitle} back />}>
        <PageSpinner label={isEdit ? 'Đang tải khoản chi...' : 'Đang tải chuyến đi...'} />
      </PageFrame>
    );
  }

  const imagePreview = image.kind === 'new' ? image.image.previewUrl : image.kind === 'existing' ? image.url : null;
  const tripClosed = ctx?.status === 'closed';

  const formFrame = (
    <PageFrame
      header={
        <PageHeader title={pageTitle} subtitle={ctx && !needsPicker ? `${ctx.tripName} · ${ctx.groupName}` : undefined} back />
      }
    >
      <form
        className="space-y-5 pb-8"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        noValidate
      >
        {needsPicker ? (
          <Panel className="p-4">
            <AddToField
              value={ctx ? { tripId: ctx.tripId, tripName: ctx.tripName, groupId: ctx.groupId, groupName: ctx.groupName } : null}
              onChange={(v: PickedTrip | null) => {
                if (!v) {
                  setCtx(null);
                  setPaidBy(null);
                  return;
                }
                const t = useTripStore.getState().allUserTrips?.find((x) => x.id === v.tripId);
                setCtx({ ...v, status: t?.status ?? 'open' });
                setPaidBy(null);
              }}
            />
          </Panel>
        ) : null}

        {tripClosed ? (
          <ErrorBox>Chuyến đã đóng — mở lại chuyến đi để thêm hoặc sửa khoản chi.</ErrorBox>
        ) : null}

        {/* Ảnh hoá đơn */}
        <Panel className="p-4">
          {imagePreview ? (
            <div className="flex items-center gap-4">
              <div className="relative">
                <img src={imagePreview} alt="Ảnh đính kèm" className="h-40 w-40 rounded-2xl object-cover" />
                <button
                  type="button"
                  aria-label="Bỏ ảnh đính kèm"
                  onClick={removeImage}
                  className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-foreground text-background"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-muted">Ảnh hoá đơn (1:1, tối đa 2 MB)</p>
                <Button size="sm" variant="secondary" isPending={imageBusy} onPress={() => libraryRef.current?.click()}>
                  Đổi ảnh
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-2 text-sm text-muted">
                <ImagePlus className="h-4 w-4" /> Thêm ảnh hoá đơn (tùy chọn)
              </span>
              <span className="flex-1" />
              <Button size="sm" variant="secondary" isPending={imageBusy} onPress={() => cameraRef.current?.click()}>
                <Camera className="h-4 w-4" /> Chụp
              </Button>
              <Button size="sm" variant="secondary" isDisabled={imageBusy} onPress={() => libraryRef.current?.click()}>
                <Images className="h-4 w-4" /> Chọn ảnh
              </Button>
            </div>
          )}
          <input ref={libraryRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </Panel>

        {warnings.length > 0 ? (
          <div className="space-y-1 rounded-xl bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] px-3 py-2.5 text-sm text-foreground">
            {warnings.map((w) => (
              <p key={w} className="flex items-start gap-2">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> {w}
              </p>
            ))}
          </div>
        ) : null}

        {contextPresets.length > 0 ? (
          <div>
            <p className="mb-2 text-[13px] font-bold text-muted">Preset</p>
            <div className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {contextPresets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm transition-colors hover:border-accent hover:bg-primary-soft"
                >
                  {isFullPreset(p) ? <Zap className="h-3.5 w-3.5 fill-current text-accent" /> : null}
                  <span className="max-w-[160px] truncate font-medium text-foreground">{p.title}</span>
                  <span className="tabular text-muted">{formatVND(p.amount)}</span>
                  {p.trip_id ? <MapPin className="h-3.5 w-3.5 text-muted" /> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Panel className="space-y-4 p-4">
          <TextInputField
            label="Tên khoản chi"
            value={title}
            onChange={setTitle}
            placeholder="VD: Ăn tối, Taxi, Khách sạn"
            maxLength={100}
            autoFocus={!isEdit && !title}
          />
          <MoneyInput label="Số tiền (VND)" value={amount} onChange={setAmount} size="lg" />
          <div className="space-y-1.5">
            <Label htmlFor="expense-date">Ngày &amp; giờ</Label>
            <input
              id="expense-date"
              type="datetime-local"
              value={date}
              max={toLocalInput(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 w-full rounded-[var(--field-radius,0.75rem)] border border-field-border bg-field px-3 text-sm text-field-foreground shadow-field outline-none focus:border-accent"
            />
            {/* Ô datetime-local hiển thị theo ngôn ngữ trình duyệt (có thể là kiểu Mỹ) → nhắc lại dạng VN. */}
            {!Number.isNaN(new Date(date).getTime()) ? (
              <p className="tabular text-xs text-muted">{weekdayVN(new Date(date))}, {formatDateTimeVN(new Date(date))}</p>
            ) : null}
          </div>
        </Panel>

        <Panel className="space-y-3 p-4">
          <p className="text-[15px] font-bold text-foreground">Ai trả?</p>
          {formMembers.length === 0 ? (
            <p className="text-sm text-muted">
              {!ctx ? 'Chọn nhóm để xem thành viên' : membersLoading ? 'Đang tải thành viên...' : 'Nhóm chưa có thành viên'}
            </p>
          ) : (
            <MemberAvatarPicker
              ariaLabel="Người trả"
              selected={paidBy}
              onSelect={setPaidBy}
              options={formMembers.map((m) => ({ key: m.id, label: m.id === myMemberId ? 'Bạn' : m.name, name: m.name }))}
            />
          )}
        </Panel>

        {formMembers.length > 0 && amountValue > 0 ? (
          <SplitEditor members={formMembers} amount={amountValue} state={split} onChange={setSplit} />
        ) : null}

        <TextAreaField label="Ghi chú (tùy chọn)" value={note} onChange={setNote} rows={3} maxLength={500} />

        {!isEdit ? (
          <Panel className="p-4">
            <Switch isSelected={savePreset} onChange={setSavePreset} className="w-full">
              <Switch.Content className="flex w-full items-center justify-between gap-4">
                <span className="min-w-0">
                  <Label className="text-sm font-medium">Lưu làm preset</Label>
                  <span className={`block text-xs ${presetConflict ? 'text-danger' : 'text-muted'}`}>
                    {presetConflict
                      ? 'Đã có preset tên này, đổi tên hoặc tắt tùy chọn'
                      : 'Dùng nhanh khoản chi này lần sau (lưu làm preset toàn cục)'}
                  </span>
                </span>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </Panel>
        ) : null}

        <ErrorBox>{error}</ErrorBox>

        <Button
          type="submit"
          fullWidth
          size="lg"
          isPending={submitting}
          isDisabled={submitting || presetConflict || !ctx || tripClosed || (isEdit && !editing)}
        >
          {submitting ? 'Đang lưu...' : isEdit ? 'Lưu thay đổi' : 'Thêm khoản chi'}
        </Button>
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
    </PageFrame>
  );

  // Desktop + đang trong 1 chuyến: giữ cột "các chuyến của nhóm" bên trái như khi xem luồng.
  if (wide && ctx && !needsPicker && tripsListGroupId === ctx.groupId) {
    return <ChatLayout list={<GroupTripsPane groupId={ctx.groupId} activeTripId={ctx.tripId} />} main={formFrame} />;
  }
  return formFrame;
}
