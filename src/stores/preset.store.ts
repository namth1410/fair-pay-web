import { create } from 'zustand';

import {
  createPreset,
  deletePreset,
  type ExpensePreset,
  fetchPresets,
  type PresetCreateParams,
  updatePreset,
} from '../services/preset.service';

interface PresetState {
  presets: ExpensePreset[];
  loading: boolean;
  loaded: boolean;
  loadPresets: () => Promise<void>;
  addPreset: (params: PresetCreateParams) => Promise<ExpensePreset>;
  editPreset: (id: string, params: PresetCreateParams) => Promise<ExpensePreset>;
  removePreset: (id: string) => Promise<void>;
  reset: () => void;
}

export const usePresetStore = create<PresetState>((set, get) => ({
  presets: [],
  loading: false,
  loaded: false,

  loadPresets: async () => {
    set({ loading: true });
    try {
      set({ presets: await fetchPresets(), loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addPreset: async (params) => {
    const preset = await createPreset(params);
    set({ presets: [preset, ...get().presets] });
    return preset;
  },

  editPreset: async (id, params) => {
    const preset = await updatePreset(id, params);
    set({ presets: [preset, ...get().presets.filter((p) => p.id !== id)] });
    return preset;
  },

  removePreset: async (id) => {
    await deletePreset(id);
    set({ presets: get().presets.filter((p) => p.id !== id) });
  },

  reset: () => set({ presets: [], loading: false, loaded: false }),
}));

/**
 * Lọc + sắp preset theo ngữ cảnh:
 * - Home (`tripId=null`): mọi preset, gắn-chuyến trước global.
 * - Trong chuyến X: CHỈ global + preset của X (không nhiễu preset chuyến khác).
 */
export function getPresetsForContext(
  allPresets: ExpensePreset[],
  ctx: { tripId?: string | null },
): ExpensePreset[] {
  const tripId = ctx.tripId ?? null;
  const filtered = allPresets.filter((p) => {
    if (p.trip_id === null) return true;
    if (tripId === null) return true;
    return p.trip_id === tripId;
  });
  return filtered.slice().sort((a, b) => {
    const aIsContext = tripId !== null && a.trip_id === tripId;
    const bIsContext = tripId !== null && b.trip_id === tripId;
    if (aIsContext !== bIsContext) return aIsContext ? -1 : 1;
    const aPinned = a.trip_id !== null;
    const bPinned = b.trip_id !== null;
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}
