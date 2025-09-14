import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { CharacterFilters, StyleType } from '../../types/character';

export interface EnhancedSearchAndFilterProps {
  onFiltersChange: (filters: CharacterFilters & { query?: string }) => void;
  initialFilters?: CharacterFilters;
  initialQuery?: string;
  availableTags?: string[];
  availablePersonalityTraits?: string[];
  availableOccupations?: string[];
  showAdvancedFilters?: boolean;
  placeholder?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

type FilterMode = 'basic' | 'advanced';

export const EnhancedSearchAndFilter: React.FC<EnhancedSearchAndFilterProps> = ({
  onFiltersChange,
  initialFilters = {},
  initialQuery = '',
  availableTags = [],
  availablePersonalityTraits = [],
  availableOccupations = [],
  showAdvancedFilters = true,
  placeholder = 'Search characters by name, description, or attributes...',
  disabled = false,
  'data-testid': testId = 'enhanced-search-filter',
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [filters, setFilters] = useState<CharacterFilters>(initialFilters);
  const [filterMode, setFilterMode] = useState<FilterMode>('basic');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(initialFilters.tags || [])
  );
  const [selectedPersonalities, setSelectedPersonalities] = useState<Set<string>>(
    new Set()
  );

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const updatedFilters = {
        ...filters,
        query: query.trim() || undefined,
      };
      onFiltersChange(updatedFilters);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, filters, onFiltersChange]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      filters.styleType ||
      filters.tags?.length ||
      filters.status ||
      filters.isPublic !== undefined ||
      filters.userId ||
      filters.dateRange ||
      selectedPersonalities.size > 0 ||
      query.trim()
    );
  }, [filters, selectedPersonalities, query]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.styleType) count++;
    if (filters.tags?.length) count++;
    if (filters.status) count++;
    if (filters.isPublic !== undefined) count++;
    if (selectedPersonalities.size > 0) count++;
    if (query.trim()) count++;
    return count;
  }, [filters, selectedPersonalities, query]);

  const handleFilterChange = useCallback(<K extends keyof CharacterFilters>(
    key: K, 
    value: CharacterFilters[K]
  ) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const handleTagToggle = useCallback((tag: string) => {
    setSelectedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      
      handleFilterChange('tags', Array.from(newSet));
      return newSet;
    });
  }, [handleFilterChange]);

  const handlePersonalityToggle = useCallback((trait: string) => {
    setSelectedPersonalities(prev => {
      const newSet = new Set(prev);
      if (newSet.has(trait)) {
        newSet.delete(trait);
      } else {
        newSet.add(trait);
      }
      return newSet;
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setQuery('');
    setFilters({});
    setSelectedTags(new Set());
    setSelectedPersonalities(new Set());
    onFiltersChange({});
  }, [onFiltersChange]);

  const handleDateRangeChange = useCallback((type: 'from' | 'to', date: string) => {
    const dateObj = date ? new Date(date) : undefined;
    
    setFilters(prev => ({
      ...prev,
      dateRange: {
        from: type === 'from' ? dateObj! : prev.dateRange?.from || new Date(),
        to: type === 'to' ? dateObj! : prev.dateRange?.to || new Date(),
      }
    }));
  }, []);

  const TagButton = ({ 
    tag, 
    isSelected, 
    onClick, 
    count 
  }: {
    tag: string;
    isSelected: boolean;
    onClick: () => void;
    count?: number;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 12px',
        border: `1px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
        borderRadius: '16px',
        backgroundColor: isSelected ? '#eff6ff' : 'white',
        color: isSelected ? '#1d4ed8' : '#374151',
        fontSize: '12px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {tag}
      {count !== undefined && (
        <span style={{
          backgroundColor: isSelected ? '#3b82f6' : '#9ca3af',
          color: 'white',
          borderRadius: '8px',
          padding: '1px 4px',
          fontSize: '10px',
          fontWeight: '600',
          minWidth: '16px',
          textAlign: 'center'
        }}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="enhanced-search-filter" data-testid={testId} style={{
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      overflow: 'hidden'
    }}>
      {/* Search Bar */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            flex: 1,
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              color: '#9ca3af',
              pointerEvents: 'none'
            }}>
              🔍
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={disabled}
              placeholder={placeholder}
              style={{
                width: '100%',
                padding: '12px 12px 12px 40px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '16px',
                color: '#374151',
                outline: 'none',
                transition: 'border-color 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#3b82f6';
                e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          {showAdvancedFilters && (
            <button
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              disabled={disabled}
              style={{
                padding: '12px 16px',
                border: `1px solid ${isFilterPanelOpen ? '#3b82f6' : '#d1d5db'}`,
                borderRadius: '8px',
                backgroundColor: isFilterPanelOpen ? '#eff6ff' : 'white',
                color: isFilterPanelOpen ? '#1d4ed8' : '#374151',
                fontSize: '14px',
                fontWeight: '500',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease'
              }}
            >
              🔧 Filters
              {activeFilterCount > 0 && (
                <span style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '2px 6px',
                  fontSize: '10px',
                  fontWeight: '600',
                  minWidth: '18px',
                  textAlign: 'center'
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          )}

          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              disabled={disabled}
              style={{
                padding: '12px 16px',
                border: '1px solid #ef4444',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                fontSize: '14px',
                fontWeight: '500',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Quick Filters */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '12px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>
            Quick filters:
          </span>
          
          <button
            onClick={() => handleFilterChange('isPublic', filters.isPublic === true ? undefined : true)}
            disabled={disabled}
            style={{
              padding: '4px 8px',
              border: `1px solid ${filters.isPublic === true ? '#10b981' : '#d1d5db'}`,
              borderRadius: '12px',
              backgroundColor: filters.isPublic === true ? '#ecfdf5' : 'white',
              color: filters.isPublic === true ? '#059669' : '#374151',
              fontSize: '11px',
              fontWeight: '500',
              cursor: disabled ? 'not-allowed' : 'pointer'
            }}
          >
            Public Only
          </button>

          <button
            onClick={() => handleFilterChange('isPublic', filters.isPublic === false ? undefined : false)}
            disabled={disabled}
            style={{
              padding: '4px 8px',
              border: `1px solid ${filters.isPublic === false ? '#f59e0b' : '#d1d5db'}`,
              borderRadius: '12px',
              backgroundColor: filters.isPublic === false ? '#fffbeb' : 'white',
              color: filters.isPublic === false ? '#d97706' : '#374151',
              fontSize: '11px',
              fontWeight: '500',
              cursor: disabled ? 'not-allowed' : 'pointer'
            }}
          >
            Private Only
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {isFilterPanelOpen && (
        <div style={{
          padding: '20px',
          backgroundColor: '#f9fafb',
          borderTop: '1px solid #e5e7eb'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px'
          }}>
            {/* Style Type Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Style Type
              </label>
              <select
                value={filters.styleType || ''}
                onChange={(e) => handleFilterChange('styleType', e.target.value ? e.target.value as StyleType : undefined)}
                disabled={disabled}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">All Styles</option>
                <option value="REALISTIC">Realistic</option>
                <option value="CARTOON">Cartoon</option>
                <option value="ANIME">Anime</option>
                <option value="FANTASY">Fantasy</option>
                <option value="CYBERPUNK">Cyberpunk</option>
                <option value="VINTAGE">Vintage</option>
                <option value="MINIMALIST">Minimalist</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Created Date Range
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="date"
                  onChange={(e) => handleDateRangeChange('from', e.target.value)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
                <span style={{ fontSize: '12px', color: '#6b7280' }}>to</span>
                <input
                  type="date"
                  onChange={(e) => handleDateRangeChange('to', e.target.value)}
                  disabled={disabled}
                  style={{
                    flex: 1,
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Tags Filter */}
          {availableTags.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Tags ({selectedTags.size} selected)
              </label>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '8px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px'
              }}>
                {availableTags.map(tag => (
                  <TagButton
                    key={tag}
                    tag={tag}
                    isSelected={selectedTags.has(tag)}
                    onClick={() => handleTagToggle(tag)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Personality Traits Filter */}
          {availablePersonalityTraits.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Personality Traits ({selectedPersonalities.size} selected)
              </label>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '8px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '6px'
              }}>
                {availablePersonalityTraits.map(trait => (
                  <TagButton
                    key={trait}
                    tag={trait}
                    isSelected={selectedPersonalities.has(trait)}
                    onClick={() => handlePersonalityToggle(trait)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Occupation Filter */}
          {availableOccupations.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Occupation
              </label>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    // This would need additional handling for occupation filtering
                    console.log('Occupation filter:', e.target.value);
                  }
                }}
                disabled={disabled}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="">All Occupations</option>
                {availableOccupations.map(occupation => (
                  <option key={occupation} value={occupation}>{occupation}</option>
                ))}
              </select>
            </div>
          )}

          {/* Filter Actions */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #e5e7eb'
          }}>
            <div style={{
              fontSize: '12px',
              color: '#6b7280'
            }}>
              {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : 'No filters active'}
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleClearFilters}
                disabled={disabled || !hasActiveFilters}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '12px',
                  cursor: (disabled || !hasActiveFilters) ? 'not-allowed' : 'pointer',
                  opacity: (disabled || !hasActiveFilters) ? 0.5 : 1
                }}
              >
                Clear Filters
              </button>
              
              <button
                onClick={() => setIsFilterPanelOpen(false)}
                disabled={disabled}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  fontSize: '12px',
                  cursor: disabled ? 'not-allowed' : 'pointer'
                }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedSearchAndFilter;