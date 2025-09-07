import React, { useState, useMemo } from 'react';
import { Tag, Category } from '../../types';
import { useTags } from '../../hooks/useTags';

interface TagCloudProps {
  selectedTags?: string[];
  selectedCategories?: string[];
  onTagSelect?: (tagId: string) => void;
  onTagDeselect?: (tagId: string) => void;
  onCategorySelect?: (categoryId: string) => void;
  onCategoryDeselect?: (categoryId: string) => void;
  maxTags?: number;
  showCategories?: boolean;
  allowMultiSelect?: boolean;
  size?: 'small' | 'medium' | 'large';
  layout?: 'cloud' | 'grid' | 'list';
  sortBy?: 'name' | 'usage' | 'recent';
  className?: string;
}

interface TagWithUsage extends Tag {
  usageCount?: number;
}

const TagCloud: React.FC<TagCloudProps> = ({
  selectedTags = [],
  selectedCategories = [],
  onTagSelect,
  onTagDeselect,
  onCategorySelect,
  onCategoryDeselect,
  maxTags = 50,
  showCategories = true,
  allowMultiSelect = true,
  size = 'medium',
  layout = 'cloud',
  sortBy = 'name',
  className = '',
}) => {
  const { tags, categories, getTagsByCategory } = useTags();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Mock usage data - in real implementation, this would come from API
  const tagUsageData = useMemo(() => {
    const usageMap: Record<string, number> = {};
    tags.forEach((tag, index) => {
      usageMap[tag.id] = Math.floor(Math.random() * 100) + 1; // Mock usage count
    });
    return usageMap;
  }, [tags]);

  const filteredAndSortedTags = useMemo(() => {
    let filtered = tags;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tag =>
        tag.name.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (categoryFilter && categoryFilter !== 'all') {
      if (categoryFilter === 'uncategorized') {
        filtered = filtered.filter(tag => !tag.categoryId);
      } else {
        filtered = filtered.filter(tag => tag.categoryId === categoryFilter);
      }
    }

    // Add usage data
    const tagsWithUsage: TagWithUsage[] = filtered.map(tag => ({
      ...tag,
      usageCount: tagUsageData[tag.id] || 0,
    }));

    // Sort tags
    tagsWithUsage.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return tagsWithUsage.slice(0, maxTags);
  }, [tags, searchQuery, categoryFilter, sortBy, maxTags, tagUsageData]);

  const handleTagClick = (tag: Tag) => {
    const isSelected = selectedTags.includes(tag.id);
    
    if (isSelected) {
      onTagDeselect?.(tag.id);
    } else {
      if (!allowMultiSelect && selectedTags.length > 0) {
        // Deselect all other tags first
        selectedTags.forEach(tagId => onTagDeselect?.(tagId));
      }
      onTagSelect?.(tag.id);
    }
  };

  const handleCategoryClick = (category: Category) => {
    const isSelected = selectedCategories.includes(category.id);
    
    if (isSelected) {
      onCategoryDeselect?.(category.id);
    } else {
      onCategorySelect?.(category.id);
    }
  };

  const getTagSize = (usageCount: number = 0) => {
    if (layout !== 'cloud') return '';
    
    const maxUsage = Math.max(...Object.values(tagUsageData));
    const minUsage = Math.min(...Object.values(tagUsageData));
    const normalized = maxUsage === minUsage ? 0.5 : (usageCount - minUsage) / (maxUsage - minUsage);
    
    if (normalized > 0.8) return 'tag-xl';
    if (normalized > 0.6) return 'tag-lg';
    if (normalized > 0.4) return 'tag-md';
    if (normalized > 0.2) return 'tag-sm';
    return 'tag-xs';
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'size-small';
      case 'large': return 'size-large';
      case 'medium':
      default: return 'size-medium';
    }
  };

  const getLayoutClass = () => {
    switch (layout) {
      case 'grid': return 'layout-grid';
      case 'list': return 'layout-list';
      case 'cloud':
      default: return 'layout-cloud';
    }
  };

  return (
    <div className={`tag-cloud ${getSizeClass()} ${getLayoutClass()} ${className}`}>
      {/* Search and filters */}
      <div className="tag-cloud-controls">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search tags..."
          className="search-input"
        />
        
        {showCategories && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="category-filter"
          >
            <option value="all">All categories</option>
            <option value="uncategorized">Uncategorized</option>
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        )}
        
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="sort-select"
        >
          <option value="name">Sort by name</option>
          <option value="usage">Sort by usage</option>
          <option value="recent">Sort by recent</option>
        </select>
      </div>

      {/* Categories (if enabled and not filtered by category) */}
      {showCategories && categoryFilter === 'all' && categories.length > 0 && (
        <div className="categories-section">
          <h4 className="section-title">Categories</h4>
          <div className="categories-list">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category)}
                className={`category-tag ${
                  selectedCategories.includes(category.id) ? 'selected' : ''
                }`}
                style={{ 
                  backgroundColor: category.color || '#6B7280',
                  borderColor: category.color || '#6B7280'
                }}
              >
                <span className="category-name">{category.name}</span>
                <span className="category-count">
                  {getTagsByCategory(category.id).length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="tags-section">
        {filteredAndSortedTags.length === 0 ? (
          <div className="empty-state">
            {searchQuery ? 
              `No tags found matching "${searchQuery}"` : 
              'No tags available'
            }
          </div>
        ) : (
          <div className="tags-container">
            {filteredAndSortedTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              const tagSizeClass = getTagSize(tag.usageCount);
              
              return (
                <button
                  key={tag.id}
                  onClick={() => handleTagClick(tag)}
                  className={`tag-item ${tagSizeClass} ${isSelected ? 'selected' : ''}`}
                  style={{ 
                    backgroundColor: tag.color || '#6B7280',
                    borderColor: tag.color || '#6B7280'
                  }}
                  title={`${tag.name} (used ${tag.usageCount || 0} times)`}
                >
                  <span className="tag-name">{tag.name}</span>
                  {layout === 'list' && (
                    <span className="tag-usage">{tag.usageCount || 0}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        .tag-cloud {
          width: 100%;
        }

        .tag-cloud-controls {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }

        .search-input,
        .category-filter,
        .sort-select {
          padding: 8px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 6px;
          font-size: 14px;
          background: white;
        }

        .search-input {
          flex: 1;
          min-width: 200px;
        }

        .search-input:focus,
        .category-filter:focus,
        .sort-select:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .categories-section {
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 12px 0;
          color: #374151;
        }

        .categories-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .category-tag {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: 2px solid;
          border-radius: 20px;
          background: white;
          color: #374151;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .category-tag:hover {
          opacity: 0.8;
        }

        .category-tag.selected {
          color: white;
        }

        .category-count {
          font-size: 12px;
          background: rgba(255, 255, 255, 0.3);
          padding: 2px 6px;
          border-radius: 10px;
        }

        .category-tag.selected .category-count {
          background: rgba(255, 255, 255, 0.3);
        }

        .tags-container.layout-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
          justify-content: flex-start;
        }

        .tags-container.layout-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 12px;
        }

        .tags-container.layout-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .tag-item {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px 12px;
          border: 2px solid;
          border-radius: 16px;
          background: white;
          color: #374151;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .tag-item:hover {
          opacity: 0.8;
          transform: translateY(-1px);
        }

        .tag-item.selected {
          color: white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        /* Size variations for cloud layout */
        .layout-cloud .tag-item.tag-xs {
          font-size: 12px;
          padding: 4px 8px;
        }

        .layout-cloud .tag-item.tag-sm {
          font-size: 13px;
          padding: 5px 10px;
        }

        .layout-cloud .tag-item.tag-md {
          font-size: 14px;
          padding: 6px 12px;
        }

        .layout-cloud .tag-item.tag-lg {
          font-size: 16px;
          padding: 8px 16px;
        }

        .layout-cloud .tag-item.tag-xl {
          font-size: 18px;
          padding: 10px 20px;
          font-weight: 600;
        }

        /* List layout specific styling */
        .layout-list .tag-item {
          justify-content: space-between;
          border-radius: 8px;
          padding: 12px 16px;
        }

        .tag-usage {
          font-size: 12px;
          background: rgba(0, 0, 0, 0.1);
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: 8px;
        }

        .tag-item.selected .tag-usage {
          background: rgba(255, 255, 255, 0.3);
        }

        /* Size variations */
        .size-small {
          font-size: 12px;
        }

        .size-small .tag-item {
          font-size: 12px;
          padding: 4px 8px;
        }

        .size-large {
          font-size: 16px;
        }

        .size-large .tag-item {
          font-size: 16px;
          padding: 8px 16px;
        }

        .empty-state {
          text-align: center;
          color: #6b7280;
          font-style: italic;
          padding: 40px 20px;
        }

        /* Grid layout specific styling */
        .layout-grid .tag-item {
          justify-content: center;
          padding: 12px 8px;
          border-radius: 8px;
          text-align: center;
          min-height: 40px;
        }

        /* Responsive adjustments */
        @media (max-width: 768px) {
          .tag-cloud-controls {
            flex-direction: column;
          }

          .search-input {
            min-width: unset;
          }

          .layout-grid .tags-container {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          }

          .layout-cloud .tag-item.tag-xl {
            font-size: 16px;
            padding: 8px 16px;
          }
        }
      `}</style>
    </div>
  );
};

export default TagCloud;