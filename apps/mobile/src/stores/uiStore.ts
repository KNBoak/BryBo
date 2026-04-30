import { create } from 'zustand';

type ActiveTab = 'myday' | 'calendar' | 'accounts' | 'contacts';

interface UiState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: 'myday',
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
