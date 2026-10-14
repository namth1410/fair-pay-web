import { create } from 'zustand';

interface UIState {
  createJoinOpen: boolean;
  createJoinMode: 'create' | 'join';
  /** Mã mời điền sẵn (mở từ link /join/:code). */
  createJoinCode: string;
  quickAddOpen: boolean;
  openCreateJoin: (mode?: 'create' | 'join', code?: string) => void;
  closeCreateJoin: () => void;
  setQuickAddOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  createJoinOpen: false,
  createJoinMode: 'create',
  createJoinCode: '',
  quickAddOpen: false,
  openCreateJoin: (mode = 'create', code = '') =>
    set({ createJoinOpen: true, createJoinMode: mode, createJoinCode: code }),
  closeCreateJoin: () => set({ createJoinOpen: false }),
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),
}));
