import { create } from 'zustand';

import { MAX_PINNED_TRIPS } from '../config/constants';
import { type AuditLog, fetchAuditLogs } from '../services/audit.service';
import {
  computeTripBalances,
  type ExpenseWithSplits,
  fetchTripBalanceData,
  type TripBalanceMember,
} from '../services/expense.service';
import {
  calculateSettlements,
  createPayment,
  deletePayment,
  type Payment,
} from '../services/payment.service';
import {
  clearTrip,
  closeTrip,
  createTrip,
  deleteTrip,
  fetchAllUserTripsWithGroup,
  fetchPinnedTrips,
  fetchTripById,
  fetchTrips,
  pinTrip,
  reopenTrip,
  reorderPinnedTrips,
  type Trip,
  type TripWithGroup,
  unpinTrip,
  updateTripName,
} from '../services/trip.service';
import { useGroupStore } from './group.store';

export interface BalanceEntry {
  memberId: string;
  memberName: string;
  balance: number;
}

export interface SettlementEntry {
  from: string;
  fromName: string;
  to: string;
  toName: string;
  amount: number;
}

export interface PaymentInput {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  note?: string;
}

interface TripState {
  // Danh sách chuyến của nhóm đang xem
  trips: Trip[];
  currentTripsGroupId: string | null;
  isLoadingTrips: boolean;

  // Chi tiết chuyến
  currentTripId: string | null;
  currentTrip: Trip | null;
  currentTripLoadError: boolean;
  isLoadingTrip: boolean;
  expenses: ExpenseWithSplits[];
  payments: Payment[];
  allMembers: TripBalanceMember[];
  balances: BalanceEntry[];
  settlements: SettlementEntry[];
  auditLogs: AuditLog[];
  isLoadingAudit: boolean;

  // Ghim
  pinnedTrips: TripWithGroup[];
  pinnedTripIds: Set<string>;
  pinnedLoaded: boolean;
  allUserTrips: TripWithGroup[] | null;
  isLoadingAllUserTrips: boolean;

  loadTrips: (groupId: string, opts?: { quiet?: boolean }) => Promise<void>;
  addTrip: (groupId: string, name: string) => Promise<Trip>;
  toggleTripStatus: (trip: Trip) => Promise<void>;

  loadTrip: (tripId: string, opts?: { quiet?: boolean }) => Promise<void>;
  loadAuditLogs: (tripId: string) => Promise<void>;
  refreshCurrentTrip: () => Promise<void>;
  renameTrip: (trip: Trip, name: string) => Promise<void>;
  clearTrip: (trip: Trip) => Promise<void>;
  deleteTrip: (trip: Trip) => Promise<void>;

  addPayment: (input: PaymentInput) => Promise<void>;
  addPayments: (inputs: PaymentInput[]) => Promise<{ ok: number; failed: number }>;
  removePayment: (paymentId: string) => Promise<void>;

  loadPinnedTrips: () => Promise<void>;
  togglePin: (tripId: string) => Promise<void>;
  swapPinned: () => Promise<void>;
  loadAllUserTrips: () => Promise<void>;

  reset: () => void;
}

const initialState = {
  trips: [] as Trip[],
  currentTripsGroupId: null as string | null,
  isLoadingTrips: false,
  currentTripId: null as string | null,
  currentTrip: null as Trip | null,
  currentTripLoadError: false,
  isLoadingTrip: false,
  expenses: [] as ExpenseWithSplits[],
  payments: [] as Payment[],
  allMembers: [] as TripBalanceMember[],
  balances: [] as BalanceEntry[],
  settlements: [] as SettlementEntry[],
  auditLogs: [] as AuditLog[],
  isLoadingAudit: false,
  pinnedTrips: [] as TripWithGroup[],
  pinnedTripIds: new Set<string>(),
  pinnedLoaded: false,
  allUserTrips: null as TripWithGroup[] | null,
  isLoadingAllUserTrips: false,
};

function memberName(members: TripBalanceMember[], id: string): string {
  return members.find((m) => m.id === id)?.displayName ?? '';
}

export const useTripStore = create<TripState>((set, get) => ({
  ...initialState,

  loadTrips: async (groupId, opts) => {
    const switching = get().currentTripsGroupId !== groupId;
    set({
      currentTripsGroupId: groupId,
      ...(!opts?.quiet && { isLoadingTrips: true }),
      ...(switching && { trips: [] }),
    });
    try {
      const trips = await fetchTrips(groupId);
      if (get().currentTripsGroupId !== groupId) return;
      set({ trips });
    } finally {
      if (!opts?.quiet) set({ isLoadingTrips: false });
    }
  },

  addTrip: async (groupId, name) => {
    const trip = await createTrip(groupId, name);
    await get().loadTrips(groupId, { quiet: true });
    return trip;
  },

  toggleTripStatus: async (trip) => {
    if (trip.status === 'open') await closeTrip(trip);
    else await reopenTrip(trip);
    await Promise.all([
      get().currentTripsGroupId === trip.group_id
        ? get().loadTrips(trip.group_id, { quiet: true })
        : Promise.resolve(),
      get().currentTripId === trip.id ? get().refreshCurrentTrip() : Promise.resolve(),
    ]);
    void get().loadPinnedTrips();
    void useGroupStore.getState().loadBalanceSummary();
  },

  loadTrip: async (tripId, opts) => {
    const quiet = opts?.quiet ?? false;
    const switching = get().currentTripId !== tripId;
    set({
      currentTripId: tripId,
      ...(!quiet && { isLoadingTrip: true, currentTripLoadError: false }),
      ...(switching && {
        currentTrip: null,
        expenses: [],
        payments: [],
        allMembers: [],
        balances: [],
        settlements: [],
        auditLogs: [],
      }),
    });
    try {
      const [data, trip] = await Promise.all([fetchTripBalanceData(tripId), fetchTripById(tripId)]);
      if (get().currentTripId !== tripId) return;
      if (!trip) {
        set({ currentTripLoadError: true });
        return;
      }
      if (!data) {
        set({ currentTrip: trip, expenses: [], payments: [], allMembers: [], balances: [], settlements: [] });
        return;
      }
      const balances = computeTripBalances(data.members, data.expenses, data.payments);
      set({
        currentTrip: trip,
        expenses: data.expenses,
        payments: data.payments,
        allMembers: data.members,
        balances,
        settlements: calculateSettlements(balances),
      });
    } catch (e) {
      if (get().currentTripId === tripId && !quiet) set({ currentTripLoadError: true });
      throw e;
    } finally {
      if (!quiet && get().currentTripId === tripId) set({ isLoadingTrip: false });
    }
  },

  loadAuditLogs: async (tripId) => {
    set({ isLoadingAudit: true });
    try {
      const auditLogs = await fetchAuditLogs(tripId);
      if (get().currentTripId !== tripId) return;
      set({ auditLogs });
    } finally {
      set({ isLoadingAudit: false });
    }
  },

  refreshCurrentTrip: async () => {
    const tripId = get().currentTripId;
    if (!tripId) return;
    await Promise.all([
      get().loadTrip(tripId, { quiet: true }),
      get().loadAuditLogs(tripId).catch(() => {}),
    ]);
  },

  renameTrip: async (trip, name) => {
    await updateTripName(trip, name);
    await Promise.all([
      get().refreshCurrentTrip(),
      get().currentTripsGroupId === trip.group_id
        ? get().loadTrips(trip.group_id, { quiet: true })
        : Promise.resolve(),
    ]);
    void get().loadPinnedTrips();
  },

  clearTrip: async (trip) => {
    await clearTrip(trip);
    await get().refreshCurrentTrip();
    void useGroupStore.getState().loadBalanceSummary();
  },

  deleteTrip: async (trip) => {
    await deleteTrip(trip);
    set((s) => ({
      trips: s.trips.filter((t) => t.id !== trip.id),
      pinnedTrips: s.pinnedTrips.filter((t) => t.id !== trip.id),
      pinnedTripIds: new Set([...s.pinnedTripIds].filter((id) => id !== trip.id)),
    }));
    void useGroupStore.getState().loadBalanceSummary();
  },

  addPayment: async (input) => {
    const trip = get().currentTrip;
    if (!trip) return;
    const members = get().allMembers;
    await createPayment({
      tripId: trip.id,
      groupId: trip.group_id,
      fromMemberId: input.fromMemberId,
      toMemberId: input.toMemberId,
      fromName: memberName(members, input.fromMemberId),
      toName: memberName(members, input.toMemberId),
      amount: input.amount,
      note: input.note,
    });
    await get().refreshCurrentTrip();
    void useGroupStore.getState().loadBalanceSummary();
  },

  addPayments: async (inputs) => {
    const trip = get().currentTrip;
    if (!trip || inputs.length === 0) return { ok: 0, failed: 0 };
    const members = get().allMembers;
    const results = await Promise.allSettled(
      inputs.map((input) =>
        createPayment({
          tripId: trip.id,
          groupId: trip.group_id,
          fromMemberId: input.fromMemberId,
          toMemberId: input.toMemberId,
          fromName: memberName(members, input.fromMemberId),
          toName: memberName(members, input.toMemberId),
          amount: input.amount,
          note: input.note,
        }),
      ),
    );
    await get().refreshCurrentTrip();
    void useGroupStore.getState().loadBalanceSummary();
    const failed = results.filter((r) => r.status === 'rejected').length;
    return { ok: results.length - failed, failed };
  },

  removePayment: async (paymentId) => {
    await deletePayment(paymentId);
    await get().refreshCurrentTrip();
    void useGroupStore.getState().loadBalanceSummary();
  },

  loadPinnedTrips: async () => {
    try {
      const pinnedTrips = await fetchPinnedTrips();
      set({ pinnedTrips, pinnedTripIds: new Set(pinnedTrips.map((t) => t.id)), pinnedLoaded: true });
    } catch (e) {
      if (__DEV__) console.warn('[trip] pinned failed', e);
    }
  },

  togglePin: async (tripId) => {
    const isPinned = get().pinnedTripIds.has(tripId);
    if (!isPinned && get().pinnedTripIds.size >= MAX_PINNED_TRIPS) {
      throw new Error('max_pinned_reached');
    }
    // Optimistic cho checkbox/nút phản hồi ngay.
    const prevIds = get().pinnedTripIds;
    const nextIds = new Set(prevIds);
    if (isPinned) nextIds.delete(tripId);
    else nextIds.add(tripId);
    set({ pinnedTripIds: nextIds });
    try {
      if (isPinned) await unpinTrip(tripId);
      else await pinTrip(tripId);
    } catch (e) {
      set({ pinnedTripIds: prevIds });
      throw e;
    }
    await get().loadPinnedTrips();
  },

  swapPinned: async () => {
    const [a, b] = get().pinnedTrips;
    if (!a || !b) return;
    const prev = get().pinnedTrips;
    set({ pinnedTrips: [b, a, ...prev.slice(2)] });
    try {
      await reorderPinnedTrips([b.id, a.id]);
    } catch (e) {
      set({ pinnedTrips: prev });
      throw e;
    }
  },

  loadAllUserTrips: async () => {
    set({ isLoadingAllUserTrips: true });
    try {
      set({ allUserTrips: await fetchAllUserTripsWithGroup() });
    } finally {
      set({ isLoadingAllUserTrips: false });
    }
  },

  reset: () => set({ ...initialState, pinnedTripIds: new Set<string>() }),
}));
