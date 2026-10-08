import { create } from 'zustand';

/** Local UI state only. Server data lives in TanStack Query, never here. */
type DirectoryUiState = {
  searchText: string;
  setSearchText: (text: string) => void;
};

export const useDirectoryUiStore = create<DirectoryUiState>((set) => ({
  searchText: '',
  setSearchText: (searchText) => set({ searchText }),
}));
