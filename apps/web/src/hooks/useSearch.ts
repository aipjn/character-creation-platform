import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { CharacterDisplayData, CharacterFilters } from '../types/character';
import { searchCharacters, SearchScore } from '../utils/searchUtils';

export interface SearchState {
  query: string;
  results: CharacterDisplayData[];
  filteredResults: CharacterDisplayData[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  searchTime: number;
  hasSearched: boolean;
}

export interface SearchOptions {
  minLength?: number;
  debounceMs?: number;
  maxResults?: number;
  highlightResults?: boolean;
}

export interface UseSearchResult {
  state: SearchState;
  actions: {
    search: (query: string) => void;
    clear: () => void;
    setQuery: (query: string) => void;
  };
}

const DEFAULT_OPTIONS: Required<SearchOptions> = {
  minLength: 1,
  debounceMs: 300,
  maxResults: 1000,
  highlightResults: false,
};

export function useSearch(
  characters: CharacterDisplayData[],
  filters: CharacterFilters,
  options: SearchOptions = {}
): UseSearchResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    filteredResults: [],
    loading: false,
    error: null,
    totalCount: 0,
    searchTime: 0,
    hasSearched: false,
  });

  const debounceRef = useRef<NodeJS.Timeout>();
  const searchStartRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController>();

  // Memoized filtered characters based on current filters
  const filteredCharacters = useMemo(() => {
    return characters.filter(character => {
      // Style filter
      if (filters.styleType && character.styleType !== filters.styleType) {
        return false;
      }

      // Status filter
      if (filters.status && character.status !== filters.status) {
        return false;
      }

      // Visibility filter
      if (filters.isPublic !== undefined && character.isPublic !== filters.isPublic) {
        return false;
      }

      // Tag filters
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

      // Date range filter
      if (filters.dateRange) {
        const charDate = new Date(character.createdAt);
        if (filters.dateRange.from && charDate < filters.dateRange.from) {
          return false;
        }
        if (filters.dateRange.to && charDate > filters.dateRange.to) {
          return false;
        }
      }

      // User filter
      if (filters.userId && character.author?.id !== filters.userId) {
        return false;
      }

      return true;
    });
  }, [characters, filters]);

  const performSearch = useCallback(
    async (query: string) => {
      // Cancel previous search
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      setState(prev => ({
        ...prev,
        loading: true,
        error: null,
        query,
      }));

      try {
        searchStartRef.current = performance.now();

        // If query is empty or below minimum length, return all filtered characters
        if (!query.trim() || query.trim().length < opts.minLength) {
          const results = filteredCharacters.slice(0, opts.maxResults);
          const searchTime = performance.now() - searchStartRef.current;

          setState(prev => ({
            ...prev,
            results,
            filteredResults: results,
            loading: false,
            totalCount: filteredCharacters.length,
            searchTime,
            hasSearched: query.trim().length > 0,
          }));
          return;
        }

        // Simulate async search (in a real app, this might be an API call)
        await new Promise(resolve => setTimeout(resolve, 50));

        // Check if search was cancelled
        if (signal.aborted) {
          return;
        }

        // Perform the search
        const searchResults = searchCharacters(filteredCharacters, query.trim());
        const results = searchResults
          .slice(0, opts.maxResults)
          .map(result => result.character);

        const searchTime = performance.now() - searchStartRef.current;

        setState(prev => ({
          ...prev,
          results,
          filteredResults: results,
          loading: false,
          totalCount: searchResults.length,
          searchTime,
          hasSearched: true,
          error: null,
        }));
      } catch (error) {
        if (!signal.aborted) {
          setState(prev => ({
            ...prev,
            loading: false,
            error: error instanceof Error ? error.message : 'Search failed',
          }));
        }
      }
    },
    [filteredCharacters, opts.minLength, opts.maxResults]
  );

  const search = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        performSearch(query);
      }, opts.debounceMs);
    },
    [performSearch, opts.debounceMs]
  );

  const clear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      query: '',
      results: [],
      filteredResults: filteredCharacters.slice(0, opts.maxResults),
      loading: false,
      error: null,
      totalCount: filteredCharacters.length,
      searchTime: 0,
      hasSearched: false,
    });
  }, [filteredCharacters, opts.maxResults]);

  const setQuery = useCallback(
    (query: string) => {
      search(query);
    },
    [search]
  );

  // Update results when filters change
  useEffect(() => {
    if (!state.hasSearched) {
      // If no search has been performed, show filtered characters
      setState(prev => ({
        ...prev,
        filteredResults: filteredCharacters.slice(0, opts.maxResults),
        totalCount: filteredCharacters.length,
      }));
    } else {
      // Re-run search with current query
      performSearch(state.query);
    }
  }, [filteredCharacters, state.hasSearched, state.query, performSearch, opts.maxResults]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Initialize with filtered characters
  useEffect(() => {
    if (!state.hasSearched && state.filteredResults.length === 0) {
      setState(prev => ({
        ...prev,
        filteredResults: filteredCharacters.slice(0, opts.maxResults),
        totalCount: filteredCharacters.length,
      }));
    }
  }, [filteredCharacters, opts.maxResults, state.hasSearched, state.filteredResults.length]);

  return {
    state,
    actions: {
      search,
      clear,
      setQuery,
    },
  };
}