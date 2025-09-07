import React, { useState, useCallback } from 'react';
import { CharacterFilters } from '../../types/character';
import { FilterOptions } from '../../types/gallery';
import { StyleType, GenerationStatus } from '@prisma/client';

interface FilterPanelProps {
  filters: CharacterFilters;
  onChange: (filters: Partial<CharacterFilters>) => void;
  onClear: () => void;
  options?: FilterOptions;
  availableTags?: string[];
  className?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
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

export const FilterPanel: React.FC<FilterPanelProps> = ({
  filters,
  onChange,
  onClear,
  options = {},
  availableTags = [],
  className = '',
  collapsible = true,
  defaultCollapsed = false,
}) => {
  const {
    showStyleFilter = true,
    showTagFilter = true,
    showStatusFilter = true,
    showDateFilter = true,
    showVisibilityFilter = true,
  } = options;

  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [tagInput, setTagInput] = useState('');

  const hasActiveFilters = Boolean(
    filters.styleType ||
    filters.tags?.length ||
    filters.status ||
    filters.isPublic !== undefined ||
    filters.dateRange ||
    filters.userId
  );

  const handleStyleChange = useCallback(
    (styleType: StyleType | undefined) => {
      onChange({ styleType });
    },
    [onChange]
  );

  const handleStatusChange = useCallback(
    (status: GenerationStatus | undefined) => {
      onChange({ status });
    },
    [onChange]
  );

  const handleVisibilityChange = useCallback(
    (isPublic: boolean | undefined) => {
      onChange({ isPublic });
    },
    [onChange]
  );

  const handleTagAdd = useCallback(
    (tag: string) => {
      const currentTags = filters.tags || [];
      if (!currentTags.includes(tag)) {
        onChange({ tags: [...currentTags, tag] });
      }
      setTagInput('');
    },
    [filters.tags, onChange]
  );

  const handleTagRemove = useCallback(
    (tagToRemove: string) => {
      const currentTags = filters.tags || [];
      onChange({ tags: currentTags.filter(tag => tag !== tagToRemove) });
    },
    [filters.tags, onChange]
  );

  const handleDateRangeChange = useCallback(
    (field: 'from' | 'to', value: string) => {
      const currentRange = filters.dateRange || {};
      const date = value ? new Date(value) : undefined;
      
      onChange({
        dateRange: {
          ...currentRange,
          [field]: date,
        },
      });
    },
    [filters.dateRange, onChange]
  );

  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  if (collapsible && isCollapsed) {
    return (
      <div className={`filter-panel filter-panel--collapsed ${className}`}>
        <div className="filter-panel__header">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="filter-panel__toggle"
            aria-expanded={false}
            aria-label="Show filters"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filters</span>
            {hasActiveFilters && <span className="filter-panel__badge" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`filter-panel ${className}`}>
      <div className="filter-panel__header">
        <h3 className="filter-panel__title">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
        </h3>
        
        <div className="filter-panel__actions">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClear}
              className="filter-panel__clear"
            >
              Clear all
            </button>
          )}
          
          {collapsible && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="filter-panel__toggle"
              aria-expanded={true}
              aria-label="Hide filters"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: 'rotate(180deg)' }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="filter-panel__content">
        {showStyleFilter && (
          <div className="filter-group">
            <label className="filter-group__label">Style</label>
            <div className="filter-group__content">
              <select
                value={filters.styleType || ''}
                onChange={(e) => handleStyleChange(e.target.value as StyleType || undefined)}
                className="filter-select"
              >
                <option value="">All styles</option>
                {Object.entries(STYLE_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {showStatusFilter && (
          <div className="filter-group">
            <label className="filter-group__label">Status</label>
            <div className="filter-group__content">
              <select
                value={filters.status || ''}
                onChange={(e) => handleStatusChange(e.target.value as GenerationStatus || undefined)}
                className="filter-select"
              >
                <option value="">All statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {showVisibilityFilter && (
          <div className="filter-group">
            <label className="filter-group__label">Visibility</label>
            <div className="filter-group__content">
              <select
                value={filters.isPublic !== undefined ? String(filters.isPublic) : ''}
                onChange={(e) => {
                  const value = e.target.value;
                  handleVisibilityChange(value === '' ? undefined : value === 'true');
                }}
                className="filter-select"
              >
                <option value="">All characters</option>
                <option value="true">Public only</option>
                <option value="false">Private only</option>
              </select>
            </div>
          </div>
        )}

        {showTagFilter && (
          <div className="filter-group">
            <label className="filter-group__label">Tags</label>
            <div className="filter-group__content">
              <div className="tag-input">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && tagInput.trim()) {
                      handleTagAdd(tagInput.trim());
                    }
                  }}
                  placeholder="Add tag and press Enter"
                  className="tag-input__field"
                  list="available-tags"
                />
                
                {availableTags.length > 0 && (
                  <datalist id="available-tags">
                    {availableTags.map(tag => (
                      <option key={tag} value={tag} />
                    ))}
                  </datalist>
                )}
                
                {tagInput.trim() && (
                  <button
                    type="button"
                    onClick={() => handleTagAdd(tagInput.trim())}
                    className="tag-input__add"
                  >
                    Add
                  </button>
                )}
              </div>
              
              {filters.tags && filters.tags.length > 0 && (
                <div className="selected-tags">
                  {filters.tags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagRemove(tag)}
                      className="tag-chip"
                      title={`Remove ${tag} filter`}
                    >
                      {tag}
                      <svg
                        width="12"
                        height="12"
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
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showDateFilter && (
          <div className="filter-group">
            <label className="filter-group__label">Date Range</label>
            <div className="filter-group__content">
              <div className="date-range">
                <input
                  type="date"
                  value={formatDateForInput(filters.dateRange?.from)}
                  onChange={(e) => handleDateRangeChange('from', e.target.value)}
                  className="date-input"
                  placeholder="From"
                />
                <span className="date-separator">to</span>
                <input
                  type="date"
                  value={formatDateForInput(filters.dateRange?.to)}
                  onChange={(e) => handleDateRangeChange('to', e.target.value)}
                  className="date-input"
                  placeholder="To"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .filter-panel {
          background-color: #ffffff;
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          overflow: hidden;
        }

        .filter-panel--collapsed {
          background-color: transparent;
          border: none;
        }

        .filter-panel__header {
          padding: 16px;
          border-bottom: 1px solid #e1e5e9;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .filter-panel--collapsed .filter-panel__header {
          padding: 0;
          border-bottom: none;
        }

        .filter-panel__title {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
        }

        .filter-panel__actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-panel__clear {
          background: none;
          border: none;
          color: #6b7280;
          cursor: pointer;
          font-size: 14px;
          text-decoration: underline;
          transition: color 0.2s ease;
        }

        .filter-panel__clear:hover {
          color: #374151;
        }

        .filter-panel__toggle {
          background: none;
          border: 1px solid #e1e5e9;
          border-radius: 6px;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 14px;
          color: #6b7280;
          transition: all 0.2s ease;
          position: relative;
        }

        .filter-panel--collapsed .filter-panel__toggle {
          border-color: transparent;
          background-color: #f9fafb;
        }

        .filter-panel__toggle:hover {
          border-color: #d1d5db;
          background-color: #f9fafb;
        }

        .filter-panel__badge {
          position: absolute;
          top: -2px;
          right: -2px;
          width: 8px;
          height: 8px;
          background-color: #ef4444;
          border-radius: 50%;
        }

        .filter-panel__content {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .filter-group__label {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin: 0;
        }

        .filter-group__content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .filter-select {
          padding: 8px 12px;
          border: 1px solid #e1e5e9;
          border-radius: 6px;
          font-size: 14px;
          color: #1f2937;
          background-color: #ffffff;
          cursor: pointer;
          transition: border-color 0.2s ease;
        }

        .filter-select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .tag-input {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tag-input__field {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #e1e5e9;
          border-radius: 6px;
          font-size: 14px;
          color: #1f2937;
          transition: border-color 0.2s ease;
        }

        .tag-input__field:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .tag-input__add {
          padding: 8px 16px;
          background-color: #3b82f6;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .tag-input__add:hover {
          background-color: #2563eb;
        }

        .selected-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .tag-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background-color: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          border-radius: 16px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tag-chip:hover {
          background-color: #dbeafe;
          border-color: #93c5fd;
        }

        .date-range {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .date-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #e1e5e9;
          border-radius: 6px;
          font-size: 14px;
          color: #1f2937;
          transition: border-color 0.2s ease;
        }

        .date-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .date-separator {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .filter-panel__header {
            padding: 12px;
          }

          .filter-panel__content {
            padding: 12px;
            gap: 16px;
          }

          .tag-input {
            flex-direction: column;
            align-items: stretch;
          }

          .date-range {
            flex-direction: column;
            align-items: stretch;
          }

          .date-separator {
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default FilterPanel;