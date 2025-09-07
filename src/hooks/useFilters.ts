import { useState, useCallback, useMemo, useEffect } from 'react';
import { CharacterFilters, CharacterDisplayData } from '../types/character';
import { StyleType, GenerationStatus } from '@prisma/client';

export interface FilterStats {
  totalCharacters: number;
  filteredCount: number;
  styleTypeCounts: Record<StyleType, number>;
  statusCounts: Record<GenerationStatus, number>;
  availableTags: string[];
  tagCounts: Record<string, number>;
  publicCount: number;
  privateCount: number;
  dateRange: {
    earliest: Date | null;
    latest: Date | null;
  };
}

export interface FilterActions {
  setFilters: (filters: Partial<CharacterFilters>) => void;
  updateFilter: <K extends keyof CharacterFilters>(
    key: K,
    value: CharacterFilters[K]
  ) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  clearFilters: () => void;
  clearFilter: (key: keyof CharacterFilters) => void;
  resetToDefaults: () => void;
}

export interface UseFiltersResult {
  filters: CharacterFilters;
  stats: FilterStats;
  actions: FilterActions;
  hasActiveFilters: boolean;
}

export interface FilterOptions {
  defaultFilters?: Partial<CharacterFilters>;
  persistToSessionStorage?: boolean;
  sessionStorageKey?: string;
}

const DEFAULT_FILTERS: CharacterFilters = {
  styleType: undefined,
  tags: [],
  status: undefined,
  isPublic: undefined,
  search: undefined,
  userId: undefined,
  dateRange: undefined,
};

const DEFAULT_OPTIONS: Required<FilterOptions> = {
  defaultFilters: DEFAULT_FILTERS,
  persistToSessionStorage: false,
  sessionStorageKey: 'character-filters',
};

export function useFilters(
  characters: CharacterDisplayData[],
  options: FilterOptions = {}
): UseFiltersResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const initialFilters = { ...DEFAULT_FILTERS, ...opts.defaultFilters };

  // Load persisted filters from session storage
  const getInitialFilters = useCallback((): CharacterFilters => {
    if (!opts.persistToSessionStorage) {
      return initialFilters;
    }

    try {
      const stored = sessionStorage.getItem(opts.sessionStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        if (parsed.dateRange) {
          if (parsed.dateRange.from) {
            parsed.dateRange.from = new Date(parsed.dateRange.from);
          }
          if (parsed.dateRange.to) {
            parsed.dateRange.to = new Date(parsed.dateRange.to);
          }
        }
        return { ...initialFilters, ...parsed };
      }
    } catch (error) {
      console.warn('Failed to load filters from session storage:', error);
    }

    return initialFilters;
  }, [initialFilters, opts.persistToSessionStorage, opts.sessionStorageKey]);

  const [filters, setFiltersState] = useState<CharacterFilters>(getInitialFilters);

  // Persist filters to session storage
  const persistFilters = useCallback(
    (newFilters: CharacterFilters) => {
      if (opts.persistToSessionStorage) {
        try {
          sessionStorage.setItem(opts.sessionStorageKey, JSON.stringify(newFilters));
        } catch (error) {
          console.warn('Failed to persist filters to session storage:', error);
        }
      }
    },
    [opts.persistToSessionStorage, opts.sessionStorageKey]
  );

  // Calculate filter statistics
  const stats: FilterStats = useMemo(() => {
    // Initialize counts
    const styleTypeCounts = {} as Record<StyleType, number>;
    const statusCounts = {} as Record<GenerationStatus, number>;
    const tagCounts: Record<string, number> = {};

    // Initialize with zero counts
    Object.values(StyleType).forEach(style => {
      styleTypeCounts[style] = 0;
    });
    Object.values(GenerationStatus).forEach(status => {
      statusCounts[status] = 0;
    });

    let publicCount = 0;
    let privateCount = 0;
    let earliest: Date | null = null;
    let latest: Date | null = null;

    // Calculate statistics from all characters
    characters.forEach(character => {
      // Style type counts
      styleTypeCounts[character.styleType]++;

      // Status counts
      statusCounts[character.status]++;

      // Visibility counts
      if (character.isPublic) {
        publicCount++;
      } else {
        privateCount++;
      }

      // Tag counts
      character.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });

      // Date range
      const charDate = new Date(character.createdAt);
      if (!earliest || charDate < earliest) {
        earliest = charDate;
      }
      if (!latest || charDate > latest) {
        latest = charDate;
      }
    });

    // Get available tags sorted by count
    const availableTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag);

    // Count filtered characters
    const filteredCharacters = characters.filter(character => {
      if (filters.styleType && character.styleType !== filters.styleType) {
        return false;
      }
      if (filters.status && character.status !== filters.status) {
        return false;
      }
      if (filters.isPublic !== undefined && character.isPublic !== filters.isPublic) {
        return false;
      }
      if (filters.tags && filters.tags.length > 0) {
        const hasAllTags = filters.tags.every(tag => 
          character.tags.some(charTag => 
            charTag.toLowerCase().includes(tag.toLowerCase())
          )
        );
        if (!hasAllTags) {
          return false;
        }
      }
      if (filters.dateRange) {
        const charDate = new Date(character.createdAt);
        if (filters.dateRange.from && charDate < filters.dateRange.from) {
          return false;
        }
        if (filters.dateRange.to && charDate > filters.dateRange.to) {
          return false;
        }
      }
      if (filters.userId && character.author?.id !== filters.userId) {
        return false;
      }
      return true;
    });

    return {
      totalCharacters: characters.length,
      filteredCount: filteredCharacters.length,
      styleTypeCounts,
      statusCounts,
      availableTags,
      tagCounts,
      publicCount,
      privateCount,
      dateRange: {
        earliest,
        latest,
      },
    };
  }, [characters, filters]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.styleType ||
      filters.status ||
      filters.isPublic !== undefined ||
      (filters.tags && filters.tags.length > 0) ||
      filters.dateRange ||
      filters.userId ||
      filters.search
    );
  }, [filters]);

  // Filter actions
  const setFilters = useCallback(
    (newFilters: Partial<CharacterFilters>) => {
      const updatedFilters = { ...filters, ...newFilters };
      setFiltersState(updatedFilters);
      persistFilters(updatedFilters);
    },
    [filters, persistFilters]
  );

  const updateFilter = useCallback(
    <K extends keyof CharacterFilters>(key: K, value: CharacterFilters[K]) => {
      setFilters({ [key]: value });
    },
    [setFilters]
  );

  const addTag = useCallback(
    (tag: string) => {
      const currentTags = filters.tags || [];
      if (!currentTags.includes(tag)) {
        setFilters({ tags: [...currentTags, tag] });
      }
    },
    [filters.tags, setFilters]
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      const currentTags = filters.tags || [];
      const newTags = currentTags.filter(tag => tag !== tagToRemove);
      setFilters({ tags: newTags.length > 0 ? newTags : undefined });
    },
    [filters.tags, setFilters]
  );

  const clearFilter = useCallback(
    (key: keyof CharacterFilters) => {
      const newFilters = { ...filters };
      if (key === 'tags') {
        newFilters[key] = undefined;
      } else {
        (newFilters as any)[key] = undefined;
      }
      setFiltersState(newFilters);
      persistFilters(newFilters);
    },
    [filters, persistFilters]
  );

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    persistFilters(DEFAULT_FILTERS);
  }, [persistFilters]);

  const resetToDefaults = useCallback(() => {
    setFiltersState(initialFilters);
    persistFilters(initialFilters);
  }, [initialFilters, persistFilters]);

  // Update filters when characters change (to ensure consistency)
  useEffect(() => {
    // Remove invalid filters based on available data
    let needsUpdate = false;
    const newFilters = { ...filters };

    // Check if selected style type exists in current characters
    if (filters.styleType) {
      const hasStyleType = characters.some(char => char.styleType === filters.styleType);
      if (!hasStyleType) {
        newFilters.styleType = undefined;
        needsUpdate = true;
      }
    }

    // Check if selected status exists in current characters
    if (filters.status) {
      const hasStatus = characters.some(char => char.status === filters.status);
      if (!hasStatus) {
        newFilters.status = undefined;
        needsUpdate = true;
      }
    }

    // Remove tags that no longer exist in current characters
    if (filters.tags && filters.tags.length > 0) {
      const availableTagsSet = new Set(
        characters.flatMap(char => char.tags)
      );
      const validTags = filters.tags.filter(tag => 
        Array.from(availableTagsSet).some(availableTag => 
          availableTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
      if (validTags.length !== filters.tags.length) {
        newFilters.tags = validTags.length > 0 ? validTags : undefined;
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      setFiltersState(newFilters);
      persistFilters(newFilters);
    }
  }, [characters, filters, persistFilters]);

  return {
    filters,
    stats,
    actions: {
      setFilters,
      updateFilter,
      addTag,
      removeTag,
      clearFilters,
      clearFilter,
      resetToDefaults,
    },
    hasActiveFilters,
  };
}