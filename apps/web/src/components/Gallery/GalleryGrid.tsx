import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { CharacterDisplayData } from '../../types/character';
import { GalleryActions, GalleryGridConfig } from '../../types/gallery';
import { CharacterCard } from './CharacterCard';
import '../../styles/gallery.scss';

interface GalleryGridProps {
  characters: CharacterDisplayData[];
  loading?: boolean;
  error?: string;
  config?: Partial<GalleryGridConfig>;
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
}

// Default grid configuration
const defaultConfig: GalleryGridConfig = {
  columns: 4,
  gap: 16,
  minCardWidth: 280,
  maxCardWidth: 400,
  aspectRatio: 0.75,
};

// Loading placeholder component
const LoadingPlaceholder: React.FC<{ count?: number }> = ({ count = 8 }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={`loading-${i}`} className="character-card character-card--loading">
        <div className="character-card__image">
          <div className="placeholder">⏳</div>
        </div>
        <div className="character-card__content">
          <div className="character-card__title loading-skeleton"></div>
          <div className="character-card__description loading-skeleton"></div>
          <div className="character-card__meta loading-skeleton"></div>
        </div>
      </div>
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

export const GalleryGrid: React.FC<GalleryGridProps> = ({
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
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Merge configuration
  const config = useMemo(() => ({
    ...defaultConfig,
    ...configOverride,
  }), [configOverride]);

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

  // Generate grid CSS custom properties
  const gridStyle = useMemo(() => ({
    '--gallery-grid-columns': config.columns,
    '--gallery-grid-gap': `${config.gap}px`,
    '--gallery-card-min-width': `${config.minCardWidth}px`,
    '--gallery-card-max-width': `${config.maxCardWidth}px`,
    '--gallery-card-aspect-ratio': config.aspectRatio,
  } as React.CSSProperties), [config]);

  // Grid classes
  const gridClasses = [
    'gallery-grid',
    loading && 'gallery-grid--loading',
    selectable && 'gallery-grid--selectable',
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
    <div className="gallery-grid-container">
      <div 
        ref={gridRef}
        className={gridClasses}
        style={gridStyle}
      >
        {/* Character cards */}
        {characters.map((character) => (
          <CharacterCard
            key={character.id}
            character={character}
            view="grid"
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
        {loading && <LoadingPlaceholder count={config.columns * 2} />}
      </div>

      {/* Load more trigger */}
      {hasMore && !loading && (
        <div
          ref={loadMoreRef}
          className="gallery-grid__load-more"
          style={{ height: '20px', margin: '20px 0' }}
        />
      )}

      {/* Load more button (fallback) */}
      {hasMore && !loading && (
        <div className="gallery-grid__load-more-button">
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
        <div className="gallery-grid__error">
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
export const MemoizedGalleryGrid = React.memo(GalleryGrid, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.characters === nextProps.characters &&
    prevProps.loading === nextProps.loading &&
    prevProps.error === nextProps.error &&
    prevProps.selectedCharacters === nextProps.selectedCharacters &&
    JSON.stringify(prevProps.config) === JSON.stringify(nextProps.config)
  );
});

export default GalleryGrid;