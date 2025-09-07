import React, { useMemo } from 'react';
import { CharacterFilters } from '../../types/character';
import { StyleType, GenerationStatus } from '@prisma/client';

interface FilterChip {
  id: string;
  label: string;
  value: any;
  type: 'style' | 'status' | 'visibility' | 'tag' | 'dateRange' | 'search';
  removable: boolean;
}

interface FilterChipsProps {
  filters: CharacterFilters;
  searchQuery?: string;
  onRemoveFilter: (type: FilterChip['type'], value?: any) => void;
  onClearAll: () => void;
  className?: string;
  maxDisplayed?: number;
  showCount?: boolean;
}

const STYLE_TYPE_LABELS: Record<StyleType, string> = {
  ANIME: 'Anime',
  REALISTIC: 'Realistic',
  CARTOON: 'Cartoon',
  FANTASY: 'Fantasy',
  SCIFI: 'Sci-Fi',
  CYBERPUNK: 'Cyberpunk',
  STEAMPUNK: 'Steampunk',
  MEDIEVAL: 'Medieval',
  MODERN: 'Modern',
  RETRO: 'Retro',
};

const STATUS_LABELS: Record<GenerationStatus, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export const FilterChips: React.FC<FilterChipsProps> = ({
  filters,
  searchQuery,
  onRemoveFilter,
  onClearAll,
  className = '',
  maxDisplayed = 6,
  showCount = true,
}) => {
  const chips: FilterChip[] = useMemo(() => {
    const result: FilterChip[] = [];

    // Search query chip
    if (searchQuery && searchQuery.trim()) {
      result.push({
        id: 'search',
        label: `Search: "${searchQuery}"`,
        value: searchQuery,
        type: 'search',
        removable: true,
      });
    }

    // Style filter chip
    if (filters.styleType) {
      result.push({
        id: 'style',
        label: `Style: ${STYLE_TYPE_LABELS[filters.styleType]}`,
        value: filters.styleType,
        type: 'style',
        removable: true,
      });
    }

    // Status filter chip
    if (filters.status) {
      result.push({
        id: 'status',
        label: `Status: ${STATUS_LABELS[filters.status]}`,
        value: filters.status,
        type: 'status',
        removable: true,
      });
    }

    // Visibility filter chip
    if (filters.isPublic !== undefined) {
      result.push({
        id: 'visibility',
        label: `${filters.isPublic ? 'Public' : 'Private'} only`,
        value: filters.isPublic,
        type: 'visibility',
        removable: true,
      });
    }

    // Tag filter chips
    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach(tag => {
        result.push({
          id: `tag-${tag}`,
          label: `Tag: ${tag}`,
          value: tag,
          type: 'tag',
          removable: true,
        });
      });
    }

    // Date range filter chip
    if (filters.dateRange) {
      const { from, to } = filters.dateRange;
      let dateLabel = 'Date: ';
      
      if (from && to) {
        dateLabel += `${formatDate(from)} - ${formatDate(to)}`;
      } else if (from) {
        dateLabel += `From ${formatDate(from)}`;
      } else if (to) {
        dateLabel += `Until ${formatDate(to)}`;
      }

      if (from || to) {
        result.push({
          id: 'dateRange',
          label: dateLabel,
          value: filters.dateRange,
          type: 'dateRange',
          removable: true,
        });
      }
    }

    return result;
  }, [filters, searchQuery]);

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  };

  const handleRemoveChip = (chip: FilterChip) => {
    switch (chip.type) {
      case 'search':
        onRemoveFilter('search');
        break;
      case 'style':
        onRemoveFilter('style');
        break;
      case 'status':
        onRemoveFilter('status');
        break;
      case 'visibility':
        onRemoveFilter('visibility');
        break;
      case 'tag':
        onRemoveFilter('tag', chip.value);
        break;
      case 'dateRange':
        onRemoveFilter('dateRange');
        break;
    }
  };

  if (chips.length === 0) {
    return null;
  }

  const displayedChips = chips.slice(0, maxDisplayed);
  const remainingCount = chips.length - maxDisplayed;

  return (
    <div className={`filter-chips ${className}`}>
      <div className="filter-chips__container">
        <div className="filter-chips__list">
          {displayedChips.map(chip => (
            <div key={chip.id} className={`filter-chip filter-chip--${chip.type}`}>
              <span className="filter-chip__label">{chip.label}</span>
              {chip.removable && (
                <button
                  type="button"
                  onClick={() => handleRemoveChip(chip)}
                  className="filter-chip__remove"
                  aria-label={`Remove ${chip.label} filter`}
                  title={`Remove ${chip.label} filter`}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          ))}

          {remainingCount > 0 && (
            <div className="filter-chip filter-chip--more">
              <span className="filter-chip__label">+{remainingCount} more</span>
            </div>
          )}
        </div>

        {showCount && chips.length > 1 && (
          <div className="filter-chips__summary">
            <span className="filter-chips__count">
              {chips.length} filter{chips.length !== 1 ? 's' : ''} active
            </span>
          </div>
        )}

        {chips.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="filter-chips__clear"
            aria-label="Clear all filters"
          >
            Clear all
          </button>
        )}
      </div>

      <style jsx>{`
        .filter-chips {
          width: 100%;
        }

        .filter-chips__container {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .filter-chips__list {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          flex: 1;
        }

        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background-color: #f3f4f6;
          color: #374151;
          border: 1px solid #d1d5db;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 500;
          transition: all 0.2s ease;
          max-width: 200px;
        }

        .filter-chip--search {
          background-color: #eff6ff;
          color: #1d4ed8;
          border-color: #bfdbfe;
        }

        .filter-chip--style {
          background-color: #f0fdf4;
          color: #15803d;
          border-color: #bbf7d0;
        }

        .filter-chip--status {
          background-color: #fef3c7;
          color: #d97706;
          border-color: #fde68a;
        }

        .filter-chip--visibility {
          background-color: #f5f3ff;
          color: #7c3aed;
          border-color: #d8b4fe;
        }

        .filter-chip--tag {
          background-color: #fdf2f8;
          color: #be185d;
          border-color: #fbcfe8;
        }

        .filter-chip--dateRange {
          background-color: #ecfdf5;
          color: #059669;
          border-color: #a7f3d0;
        }

        .filter-chip--more {
          background-color: #f9fafb;
          color: #6b7280;
          border-color: #e5e7eb;
          cursor: default;
        }

        .filter-chip__label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .filter-chip__remove {
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 2px;
          border-radius: 50%;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .filter-chip__remove:hover {
          background-color: rgba(0, 0, 0, 0.1);
        }

        .filter-chip__remove:active {
          background-color: rgba(0, 0, 0, 0.2);
        }

        .filter-chips__summary {
          display: flex;
          align-items: center;
        }

        .filter-chips__count {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }

        .filter-chips__clear {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          font-size: 13px;
          text-decoration: underline;
          font-weight: 500;
          padding: 4px 8px;
          border-radius: 4px;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .filter-chips__clear:hover {
          color: #374151;
          background-color: #f3f4f6;
        }

        .filter-chips__clear:active {
          background-color: #e5e7eb;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .filter-chips__container {
            gap: 8px;
          }

          .filter-chips__list {
            gap: 6px;
          }

          .filter-chip {
            padding: 4px 8px;
            font-size: 12px;
            max-width: 150px;
          }

          .filter-chip__remove {
            padding: 1px;
          }

          .filter-chip__remove svg {
            width: 12px;
            height: 12px;
          }

          .filter-chips__count {
            font-size: 11px;
          }

          .filter-chips__clear {
            font-size: 12px;
            padding: 2px 6px;
          }
        }

        @media (max-width: 480px) {
          .filter-chips__container {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .filter-chips__list {
            width: 100%;
          }

          .filter-chip {
            max-width: none;
            min-width: 0;
            flex: 0 1 auto;
          }

          .filter-chips__summary {
            order: -1;
            width: 100%;
            justify-content: space-between;
          }

          .filter-chips__clear {
            margin-left: auto;
          }
        }
      `}</style>
    </div>
  );
};

export default FilterChips;