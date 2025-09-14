import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { GalleryContextData, GalleryState, GalleryActions, GalleryConfig, GalleryTheme, GalleryView } from '../types/gallery';
import { CharacterDisplayData, CharacterFilters, CharacterSortOptions } from '../types/character';

// Default configuration
const defaultConfig: GalleryConfig = {
  defaultView: 'grid',
  enableFilters: true,
  enableSearch: true,
  enableSorting: true,
  enableBulkActions: true,
  enablePagination: true,
  pageSize: 20,
  gridConfig: {
    columns: 4,
    gap: 16,
    minCardWidth: 280,
    maxCardWidth: 400,
    aspectRatio: 0.75,
  },
  listConfig: {
    itemHeight: 120,
    spacing: 16,
    showMetadata: true,
    showDescription: true,
  },
};

// Default theme
const defaultTheme: GalleryTheme = {
  colors: {
    background: '#ffffff',
    cardBackground: '#ffffff',
    border: '#e5e7eb',
    text: '#111827',
    textSecondary: '#6b7280',
    accent: '#3b82f6',
    error: '#ef4444',
    success: '#10b981',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
  },
  shadows: {
    card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    hover: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  breakpoints: {
    xs: 320,
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
};

// Initial state
const initialState: GalleryState = {
  characters: [],
  loading: false,
  error: undefined,
  view: defaultConfig.defaultView,
  filters: {},
  sort: { field: 'createdAt', direction: 'desc' },
  selectedCharacters: [],
  totalCount: 0,
  hasMore: false,
  page: 1,
  pageSize: defaultConfig.pageSize,
};

// Gallery context
const GalleryContext = createContext<GalleryContextData | undefined>(undefined);

// Action types for reducer
type GalleryAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | undefined }
  | { type: 'SET_CHARACTERS'; payload: CharacterDisplayData[] }
  | { type: 'ADD_CHARACTERS'; payload: CharacterDisplayData[] }
  | { type: 'UPDATE_CHARACTER'; payload: CharacterDisplayData }
  | { type: 'REMOVE_CHARACTER'; payload: string }
  | { type: 'SET_VIEW'; payload: GalleryView }
  | { type: 'SET_FILTERS'; payload: CharacterFilters }
  | { type: 'SET_SORT'; payload: CharacterSortOptions }
  | { type: 'SET_SELECTED'; payload: string[] }
  | { type: 'TOGGLE_SELECTED'; payload: string }
  | { type: 'SET_TOTAL_COUNT'; payload: number }
  | { type: 'SET_HAS_MORE'; payload: boolean }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'RESET_STATE' };

// Reducer function
function galleryReducer(state: GalleryState, action: GalleryAction): GalleryState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'SET_CHARACTERS':
      return { ...state, characters: action.payload, loading: false, error: undefined };
    case 'ADD_CHARACTERS':
      return { 
        ...state, 
        characters: [...state.characters, ...action.payload], 
        loading: false,
        error: undefined
      };
    case 'UPDATE_CHARACTER':
      return {
        ...state,
        characters: state.characters.map(char => 
          char.id === action.payload.id ? action.payload : char
        ),
      };
    case 'REMOVE_CHARACTER':
      return {
        ...state,
        characters: state.characters.filter(char => char.id !== action.payload),
        selectedCharacters: state.selectedCharacters.filter(id => id !== action.payload),
        totalCount: Math.max(0, state.totalCount - 1),
      };
    case 'SET_VIEW':
      return { ...state, view: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: action.payload, page: 1 };
    case 'SET_SORT':
      return { ...state, sort: action.payload, page: 1 };
    case 'SET_SELECTED':
      return { ...state, selectedCharacters: action.payload };
    case 'TOGGLE_SELECTED':
      return {
        ...state,
        selectedCharacters: state.selectedCharacters.includes(action.payload)
          ? state.selectedCharacters.filter(id => id !== action.payload)
          : [...state.selectedCharacters, action.payload],
      };
    case 'SET_TOTAL_COUNT':
      return { ...state, totalCount: action.payload };
    case 'SET_HAS_MORE':
      return { ...state, hasMore: action.payload };
    case 'SET_PAGE':
      return { ...state, page: action.payload };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
}

// Gallery Provider Props
interface GalleryProviderProps {
  children: React.ReactNode;
  config?: Partial<GalleryConfig>;
  theme?: Partial<GalleryTheme>;
  initialCharacters?: CharacterDisplayData[];
  onCharacterLoad?: (filters: CharacterFilters, sort: CharacterSortOptions, page: number) => Promise<{
    characters: CharacterDisplayData[];
    totalCount: number;
    hasMore: boolean;
  }>;
}

// Gallery Provider Component
export function GalleryProvider({
  children,
  config: configOverride = {},
  theme: themeOverride = {},
  initialCharacters = [],
  onCharacterLoad,
}: GalleryProviderProps) {
  const [state, dispatch] = useReducer(galleryReducer, {
    ...initialState,
    characters: initialCharacters,
  });

  const config = { ...defaultConfig, ...configOverride };
  const theme = { 
    ...defaultTheme, 
    ...themeOverride,
    colors: { ...defaultTheme.colors, ...themeOverride.colors },
    spacing: { ...defaultTheme.spacing, ...themeOverride.spacing },
    borderRadius: { ...defaultTheme.borderRadius, ...themeOverride.borderRadius },
    shadows: { ...defaultTheme.shadows, ...themeOverride.shadows },
    breakpoints: { ...defaultTheme.breakpoints, ...themeOverride.breakpoints },
  };

  // Load characters function
  const loadCharacters = useCallback(async (reset = false) => {
    if (!onCharacterLoad) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: undefined });

    try {
      const result = await onCharacterLoad(state.filters, state.sort, reset ? 1 : state.page);
      
      if (reset) {
        dispatch({ type: 'SET_CHARACTERS', payload: result.characters });
        dispatch({ type: 'SET_PAGE', payload: 1 });
      } else {
        dispatch({ type: 'ADD_CHARACTERS', payload: result.characters });
      }
      
      dispatch({ type: 'SET_TOTAL_COUNT', payload: result.totalCount });
      dispatch({ type: 'SET_HAS_MORE', payload: result.hasMore });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to load characters' });
    }
  }, [onCharacterLoad, state.filters, state.sort, state.page]);

  // Gallery actions
  const actions: GalleryActions = {
    onViewChange: useCallback((view: GalleryView) => {
      dispatch({ type: 'SET_VIEW', payload: view });
    }, []),

    onFilterChange: useCallback((filters: Partial<CharacterFilters>) => {
      const newFilters = { ...state.filters, ...filters };
      dispatch({ type: 'SET_FILTERS', payload: newFilters });
    }, [state.filters]),

    onSortChange: useCallback((sort: CharacterSortOptions) => {
      dispatch({ type: 'SET_SORT', payload: sort });
    }, []),

    onSearch: useCallback((query: string) => {
      const newFilters = { ...state.filters, search: query || undefined };
      dispatch({ type: 'SET_FILTERS', payload: newFilters });
    }, [state.filters]),

    onLoadMore: useCallback(() => {
      if (!state.loading && state.hasMore) {
        dispatch({ type: 'SET_PAGE', payload: state.page + 1 });
      }
    }, [state.loading, state.hasMore, state.page]),

    onRefresh: useCallback(() => {
      loadCharacters(true);
    }, [loadCharacters]),

    onBulkAction: useCallback((action: string, characterIds: string[]) => {
      // Placeholder for bulk actions - will be implemented by other streams
      console.log('Bulk action:', action, 'on characters:', characterIds);
    }, []),

    onSelectionChange: useCallback((selectedIds: string[]) => {
      dispatch({ type: 'SET_SELECTED', payload: selectedIds });
    }, []),

    // Character-specific actions - placeholders for other streams to implement
    onView: useCallback((character: CharacterDisplayData) => {
      console.log('View character:', character.id);
    }, []),

    onEdit: useCallback((character: CharacterDisplayData) => {
      console.log('Edit character:', character.id);
    }, []),

    onDelete: useCallback((character: CharacterDisplayData) => {
      dispatch({ type: 'REMOVE_CHARACTER', payload: character.id });
    }, []),

    onDownload: useCallback((character: CharacterDisplayData) => {
      console.log('Download character:', character.id);
    }, []),

    onShare: useCallback((character: CharacterDisplayData) => {
      console.log('Share character:', character.id);
    }, []),

    onTagUpdate: useCallback((characterId: string, tags: string[]) => {
      const character = state.characters.find(c => c.id === characterId);
      if (character) {
        const updated = { ...character, tags };
        dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
      }
    }, [state.characters]),

    onVisibilityToggle: useCallback((characterId: string, isPublic: boolean) => {
      const character = state.characters.find(c => c.id === characterId);
      if (character) {
        const updated = { ...character, isPublic };
        dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
      }
    }, [state.characters]),
  };

  // Auto-load when filters or sort change
  useEffect(() => {
    if (onCharacterLoad) {
      loadCharacters(true);
    }
  }, [state.filters, state.sort]);

  // Auto-load more when page changes
  useEffect(() => {
    if (state.page > 1 && onCharacterLoad) {
      loadCharacters(false);
    }
  }, [state.page]);

  const contextValue: GalleryContextData = {
    state,
    config,
    theme,
    actions,
  };

  return (
    <GalleryContext.Provider value={contextValue}>
      {children}
    </GalleryContext.Provider>
  );
}

// Hook to use gallery context
export function useGallery(): GalleryContextData {
  const context = useContext(GalleryContext);
  if (!context) {
    throw new Error('useGallery must be used within a GalleryProvider');
  }
  return context;
}

// Hook to use gallery actions only
export function useGalleryActions(): GalleryActions {
  const { actions } = useGallery();
  return actions;
}

// Hook to use gallery state only
export function useGalleryState(): GalleryState {
  const { state } = useGallery();
  return state;
}