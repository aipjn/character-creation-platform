import React, { useState, useCallback } from 'react';
import { CharacterCardProps } from '../../types/gallery';
import { formatDate } from '../../utils/date';
import '../../styles/gallery.scss';

// Action button component
interface ActionButtonProps {
  onClick: (e: React.MouseEvent) => void;
  icon: string;
  title: string;
  variant?: 'primary' | 'secondary' | 'danger';
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
  onClick, 
  icon, 
  title, 
  variant = 'secondary' 
}) => (
  <button
    type="button"
    className={`action-button action-button--${variant}`}
    onClick={onClick}
    title={title}
    aria-label={title}
  >
    {icon}
  </button>
);

// Character status badge
interface StatusBadgeProps {
  status: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span className={`character-card__status character-card__status--${status.toLowerCase()}`}>
    {status}
  </span>
);

// Main CharacterCard component
export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  view = 'grid',
  selected = false,
  selectable = false,
  actions,
  showAuthor = true,
  showMetadata = true,
  showTags = true,
  showStatus = true,
  compact = false,
  onClick,
  onSelect,
}) => {
  const [imageLoading, setImageLoading] = useState(!!character.imageUrl || !!character.thumbnailUrl);
  const [imageError, setImageError] = useState(false);

  // Handle card click
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('.character-card__actions, .character-card__select')) {
      return; // Don't trigger card click for action buttons
    }
    onClick?.(character);
  }, [onClick, character]);

  // Handle selection
  const handleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const checkbox = e.target as HTMLInputElement;
    onSelect?.(character.id, checkbox.checked);
  }, [onSelect, character.id]);

  // Handle image load
  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
    setImageError(false);
  }, []);

  // Handle image error
  const handleImageError = useCallback(() => {
    setImageLoading(false);
    setImageError(true);
  }, []);

  // Action handlers
  const handleAction = useCallback((action: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    switch (action) {
      case 'view':
        actions?.onView?.(character);
        break;
      case 'edit':
        actions?.onEdit?.(character);
        break;
      case 'delete':
        actions?.onDelete?.(character);
        break;
      case 'download':
        actions?.onDownload?.(character);
        break;
      case 'share':
        actions?.onShare?.(character);
        break;
    }
  }, [actions, character]);

  // Get display image URL
  const imageUrl = character.thumbnailUrl || character.imageUrl;

  // Generate card classes
  const cardClasses = [
    'character-card',
    view === 'list' && 'character-card--list',
    selected && 'selected',
    selectable && 'selectable',
    imageLoading && 'loading',
    compact && 'character-card--compact',
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses} onClick={handleClick}>
      {/* Selection checkbox */}
      {selectable && (
        <div className="character-card__select">
          <input
            type="checkbox"
            checked={selected}
            onChange={handleSelect}
            aria-label={`Select character ${character.name || character.prompt}`}
          />
        </div>
      )}

      {/* Status badge */}
      {showStatus && character.status !== 'completed' && (
        <StatusBadge status={character.status} />
      )}

      {/* Character image */}
      <div className="character-card__image">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={character.name || character.prompt}
            loading="lazy"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <div className="placeholder">
            {imageLoading ? '⏳' : imageError ? '❌' : '🎭'}
          </div>
        )}
      </div>

      {/* Card content */}
      <div className="character-card__content">
        {/* Header with title and actions */}
        <div className="character-card__header">
          <h3 className="character-card__title">
            {character.name || (compact ? 
              character.prompt.substring(0, 30) + '...' : 
              character.prompt.substring(0, 50) + (character.prompt.length > 50 ? '...' : '')
            )}
          </h3>
          
          {/* Action buttons */}
          <div className="character-card__actions">
            {actions?.onView && (
              <ActionButton
                onClick={handleAction('view')}
                icon="👁"
                title="View character"
              />
            )}
            {actions?.onEdit && (
              <ActionButton
                onClick={handleAction('edit')}
                icon="✏️"
                title="Edit character"
              />
            )}
            {actions?.onDownload && (
              <ActionButton
                onClick={handleAction('download')}
                icon="⬇️"
                title="Download character"
              />
            )}
            {actions?.onShare && (
              <ActionButton
                onClick={handleAction('share')}
                icon="🔗"
                title="Share character"
              />
            )}
            {actions?.onDelete && (
              <ActionButton
                onClick={handleAction('delete')}
                icon="🗑"
                title="Delete character"
                variant="danger"
              />
            )}
          </div>
        </div>

        {/* Description */}
        {!compact && character.name && (
          <div className="character-card__description">
            {character.prompt}
          </div>
        )}

        {/* Tags */}
        {showTags && character.tags.length > 0 && (
          <div className="character-card__tags">
            {character.tags.slice(0, compact ? 2 : 4).map((tag) => (
              <span key={tag} className="character-card__tag">
                {tag}
              </span>
            ))}
            {character.tags.length > (compact ? 2 : 4) && (
              <span className="character-card__tag">
                +{character.tags.length - (compact ? 2 : 4)}
              </span>
            )}
          </div>
        )}

        {/* Metadata footer */}
        {showMetadata && (
          <div className="character-card__meta">
            {showAuthor && character.author && (
              <div className="character-card__author">
                <span>👤</span>
                <span>{character.author.name || 'Anonymous'}</span>
              </div>
            )}
            <div className="character-card__date">
              {formatDate(character.createdAt)}
            </div>
          </div>
        )}

        {/* Additional metadata for list view */}
        {view === 'list' && !compact && (
          <div className="character-card__extra-meta">
            <div className="character-card__style">
              Style: {character.styleType}
            </div>
            {character.isPublic && (
              <div className="character-card__visibility">
                🌐 Public
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterCard;