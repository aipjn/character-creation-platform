import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import { CharacterDisplayData } from '../../types/character';
import { GalleryActions, GalleryListConfig } from '../../types/gallery';
import { CharacterCard } from './CharacterCard';
import '../../styles/gallery.scss';

interface GalleryListProps {
  characters: CharacterDisplayData[];
  loading?: boolean;
  error?: string;
  config?: Partial<GalleryListConfig>;
  actions?: GalleryActions;
  selectedCharacters?: string[];
  selectable?: boolean;
  showAuthor?: boolean;
  showMetadata?: boolean;
  showTags?: boolean;
  showStatus?: boolean;
  onCharacterClick?: (character: CharacterDisplayData) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  className?: string;
  emptyMessage?: string;
  emptyIcon?: string;
  virtualScroll?: boolean;
  itemHeight?: number;
  overscan?: number;
}

// Default list configuration
const defaultConfig: GalleryListConfig = {
  itemHeight: 120,
  spacing: 16,
  showMetadata: true,
  showDescription: true,
};

// Loading placeholder for list items
const LoadingListItem: React.FC = () => (
  <div className="character-card character-card--list character-card--loading">
    <div className="character-card__image">
      <div className="placeholder">⏳</div>
    </div>
    <div className="character-card__content">
      <div className="character-card__title loading-skeleton"></div>
      <div className="character-card__description loading-skeleton"></div>
      <div className="character-card__meta loading-skeleton"></div>
    </div>
  </div>
);

// Loading placeholder component
const LoadingPlaceholder: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <LoadingListItem key={`loading-${i}`} />
    ))}
  </>
);

// Empty state component
const EmptyState: React.FC<{ message?: string; icon?: string }> = ({ 
  message = "No characters found", 
  icon = "🎭" 
}) => (
  <div className="gallery__empty">
    <div className="icon">{icon}</div>
    <div className="title">No Characters Yet</div>
    <div className="description">{message}</div>
  </div>
);

// Error state component
const ErrorState: React.FC<{ error: string; onRetry?: () => void }> = ({ 
  error, 
  onRetry 
}) => (
  <div className="gallery__error">
    <div className="icon">❌</div>
    <div className="title">Error Loading Characters</div>
    <div className="description">{error}</div>
    {onRetry && (
      <button 
        type="button" 
        className="retry-button" 
        onClick={onRetry}
      >
        Try Again
      </button>
    )}
  </div>
);

// Virtual scroll item component
interface VirtualItemProps {
  index: number;
  character: CharacterDisplayData;
  style: React.CSSProperties;
  selectedCharacters: string[];
  selectable: boolean;
  actions?: GalleryActions;
  showAuthor: boolean;
  showMetadata: boolean;
  showTags: boolean;
  showStatus: boolean;
  onCharacterClick?: (character: CharacterDisplayData) => void;
  onCharacterSelect?: (characterId: string, selected: boolean) => void;
}

const VirtualItem: React.FC<VirtualItemProps> = ({
  character,
  style,
  selectedCharacters,
  selectable,
  actions,
  showAuthor,
  showMetadata,
  showTags,
  showStatus,
  onCharacterClick,
  onCharacterSelect,
}) => (
  <div style={style}>
    <CharacterCard
      character={character}
      view="list"
      selected={selectedCharacters.includes(character.id)}
      selectable={selectable}
      actions={actions}
      showAuthor={showAuthor}
      showMetadata={showMetadata}
      showTags={showTags}
      showStatus={showStatus}
      onClick={onCharacterClick}
      onSelect={onCharacterSelect}
    />
  </div>
);

export const GalleryList: React.FC<GalleryListProps> = ({
  characters,
  loading = false,
  error,
  config: configOverride = {},
  actions,
  selectedCharacters = [],
  selectable = false,
  showAuthor = true,
  showMetadata = true,
  showTags = true,
  showStatus = true,
  onCharacterClick,
  onSelectionChange,
  onLoadMore,
  hasMore = false,
  className = '',
  emptyMessage,
  emptyIcon,
  virtualScroll = false,
  itemHeight,
  overscan = 5,
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Merge configuration
  const config = useMemo(() => ({
    ...defaultConfig,
    ...configOverride,
  }), [configOverride]);

  // Use provided itemHeight or config itemHeight
  const actualItemHeight = itemHeight || config.itemHeight;

  // Handle character selection
  const handleCharacterSelect = useCallback((characterId: string, selected: boolean) => {
    if (!selectable || !onSelectionChange) return;

    const newSelection = selected
      ? [...selectedCharacters, characterId]
      : selectedCharacters.filter(id => id !== characterId);
    
    onSelectionChange(newSelection);
  }, [selectedCharacters, selectable, onSelectionChange]);

  // Handle character click
  const handleCharacterClick = useCallback((character: CharacterDisplayData) => {
    if (selectable && onSelectionChange) {
      // In selectable mode, clicking toggles selection
      const isSelected = selectedCharacters.includes(character.id);
      handleCharacterSelect(character.id, !isSelected);
    } else {
      onCharacterClick?.(character);
    }
  }, [selectable, selectedCharacters, onCharacterClick, onSelectionChange, handleCharacterSelect]);

  // Handle scroll for virtual scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (virtualScroll) {
      setScrollTop(e.currentTarget.scrollTop);
    }
  }, [virtualScroll]);

  // Set up intersection observer for infinite loading
  useEffect(() => {
    if (!onLoadMore || !hasMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { 
        threshold: 0.1,
        rootMargin: '100px' 
      }
    );

    observerRef.current = observer;

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [onLoadMore, hasMore, loading]);

  // Update container height for virtual scrolling
  useEffect(() => {
    if (virtualScroll && listRef.current) {
      const updateHeight = () => {
        setContainerHeight(listRef.current?.clientHeight || 0);
      };
      
      updateHeight();
      window.addEventListener('resize', updateHeight);
      
      return () => window.removeEventListener('resize', updateHeight);
    }
  }, [virtualScroll]);

  // Calculate visible items for virtual scrolling
  const visibleItems = useMemo(() => {
    if (!virtualScroll || containerHeight === 0) {
      return characters.map((character, index) => ({ character, index }));
    }

    const startIndex = Math.max(0, Math.floor(scrollTop / actualItemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / actualItemHeight) + 2 * overscan;
    const endIndex = Math.min(characters.length, startIndex + visibleCount);

    return characters
      .slice(startIndex, endIndex)
      .map((character, i) => ({ character, index: startIndex + i }));
  }, [characters, virtualScroll, containerHeight, scrollTop, actualItemHeight, overscan]);

  // Generate list CSS custom properties
  const listStyle = useMemo(() => ({
    '--gallery-list-item-height': `${actualItemHeight}px`,
    '--gallery-list-spacing': `${config.spacing}px`,
  } as React.CSSProperties), [actualItemHeight, config.spacing]);

  // List classes
  const listClasses = [
    'gallery-list',
    virtualScroll && 'gallery-list--virtual',
    loading && 'gallery-list--loading',
    selectable && 'gallery-list--selectable',
    className,
  ].filter(Boolean).join(' ');

  // Handle retry
  const handleRetry = useCallback(() => {
    onLoadMore?.();
  }, [onLoadMore]);

  // Render error state
  if (error && characters.length === 0) {
    return <ErrorState error={error} onRetry={handleRetry} />;
  }

  // Render empty state
  if (!loading && characters.length === 0) {
    return <EmptyState message={emptyMessage} icon={emptyIcon} />;
  }

  return (
    <div className="gallery-list-container">
      <div 
        ref={listRef}
        className={listClasses}
        style={listStyle}
        onScroll={handleScroll}
      >
        {virtualScroll ? (
          // Virtual scrolling implementation
          <div 
            style={{ 
              height: characters.length * actualItemHeight,
              position: 'relative' 
            }}
          >
            {visibleItems.map(({ character, index }) => (
              <VirtualItem
                key={character.id}
                index={index}
                character={character}
                style={{
                  position: 'absolute',
                  top: index * actualItemHeight,
                  left: 0,
                  right: 0,
                  height: actualItemHeight,
                }}
                selectedCharacters={selectedCharacters}
                selectable={selectable}
                actions={actions}
                showAuthor={showAuthor}
                showMetadata={showMetadata}
                showTags={showTags}
                showStatus={showStatus}
                onCharacterClick={handleCharacterClick}
                onCharacterSelect={handleCharacterSelect}
              />
            ))}
          </div>
        ) : (
          // Regular scrolling implementation
          <>
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                view="list"
                selected={selectedCharacters.includes(character.id)}
                selectable={selectable}
                actions={actions}
                showAuthor={showAuthor}
                showMetadata={showMetadata}
                showTags={showTags}
                showStatus={showStatus}
                onClick={handleCharacterClick}
                onSelect={handleCharacterSelect}
              />
            ))}

            {/* Loading placeholders */}
            {loading && <LoadingPlaceholder count={5} />}
          </>
        )}
      </div>

      {/* Load more trigger */}
      {hasMore && !loading && !virtualScroll && (
        <div
          ref={loadMoreRef}
          className="gallery-list__load-more"
          style={{ height: '20px', margin: '20px 0' }}
        />
      )}

      {/* Load more button (fallback) */}
      {hasMore && !loading && (
        <div className="gallery-list__load-more-button">
          <button 
            type="button"
            onClick={onLoadMore}
            className="load-more-button"
          >
            Load More Characters
          </button>
        </div>
      )}

      {/* Error message for partial load failures */}
      {error && characters.length > 0 && (
        <div className="gallery-list__error">
          <span className="error-message">{error}</span>
          <button 
            type="button"
            onClick={handleRetry}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

// Memoized version for performance
export const MemoizedGalleryList = React.memo(GalleryList, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.characters === nextProps.characters &&
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    prevProps.selectedCharacters === nextProps.selectedCharacters &&
    JSON.stringify(prevProps.config) === JSON.stringify(nextProps.config)
  );
});

export default GalleryList;