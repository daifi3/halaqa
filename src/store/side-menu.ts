import { create } from 'zustand';

/** The slide-in side menu, opened from the ☰ button in a tab's header. */
interface SideMenuState {
  open: boolean;
  /** Bumped on every open, so the menu items replay their entrance. */
  openCount: number;
  show: () => void;
  hide: () => void;
}

export const useSideMenu = create<SideMenuState>()((set) => ({
  open: false,
  openCount: 0,
  show: () => set((s) => ({ open: true, openCount: s.openCount + 1 })),
  hide: () => set({ open: false }),
}));
