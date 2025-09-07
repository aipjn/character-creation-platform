// Search component exports
export { SearchBar, default as SearchBarDefault } from './SearchBar';
export { FilterPanel, default as FilterPanelDefault } from './FilterPanel';
export { FilterChips, default as FilterChipsDefault } from './FilterChips';

// Re-export types for convenience
export type {
  SearchOptions,
  FilterOptions,
  GalleryView,
  GalleryState,
  GalleryActions,
} from '../../types/gallery';

export type {
  CharacterFilters,
  CharacterSortOptions,
  CharacterActions,
} from '../../types/character';