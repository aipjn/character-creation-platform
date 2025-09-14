// Gallery components exports
export { CharacterCard } from './CharacterCard';
export { ViewToggle, EnhancedViewToggle } from './ViewToggle';
export { GalleryGrid, MemoizedGalleryGrid } from './GalleryGrid';
export { GalleryList, MemoizedGalleryList } from './GalleryList';

// Re-export types for convenience
export type {
  CharacterDisplayData,
  CharacterFilters,
  CharacterSortOptions,
  CharacterActions,
  CharacterStats,
  CharacterUser,
} from '../../types/character';

export type {
  GalleryView,
  GalleryState,
  GalleryConfig,
  GalleryTheme,
  GalleryActions,
  GalleryGridConfig,
  GalleryListConfig,
  CharacterCardProps,
  GalleryBreakpoints,
  SearchOptions,
  FilterOptions,
  PaginationOptions,
  GalleryContextData,
} from '../../types/gallery';

// Re-export context hooks
export {
  GalleryProvider,
  useGallery,
  useGalleryActions,
  useGalleryState,
} from '../../contexts/GalleryContext';