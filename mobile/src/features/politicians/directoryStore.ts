import { create } from 'zustand';

import type { DirectoryFilters } from '@/domain/models/directory';

/**
 * Local UI state only (server data lives in TanStack Query). Kept in a store
 * rather than component state so the search text and filters survive
 * navigating to a profile and back.
 */
type DirectoryUiState = {
  searchText: string;
  filters: DirectoryFilters;
  setSearchText: (text: string) => void;
  setFilters: (filters: DirectoryFilters) => void;
  clearFilters: () => void;
  /** Replaces search and filters in one step, e.g. when arriving from Home. */
  applyPreset: (preset: { searchText?: string; filters?: DirectoryFilters }) => void;
  reset: () => void;
};

export const useDirectoryUiStore = create<DirectoryUiState>((set) => ({
  searchText: '',
  filters: {},
  setSearchText: (searchText) => set({ searchText }),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {} }),
  applyPreset: ({ searchText = '', filters = {} }) => set({ searchText, filters }),
  reset: () => set({ searchText: '', filters: {} }),
}));
