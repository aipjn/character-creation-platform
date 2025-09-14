import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Tag, Category } from '../../types';
import { useTags } from '../../hooks/useTags';

interface TagInputProps {
  selectedTags: Tag[];
  onTagsChange: (tags: Tag[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
  showCategories?: boolean;
  className?: string;
}

interface SuggestionItem {
  id: string;
  name: string;
  type: 'tag' | 'category';
  color?: string;
}

const TagInput: React.FC<TagInputProps> = ({
  selectedTags,
  onTagsChange,
  placeholder = "Add tags...",
  maxTags = 20,
  disabled = false,
  showCategories = true,
  className = "",
}) => {
  const { tags, categories, createTag, validateTagName } = useTags();
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate suggestions based on input
  const generateSuggestions = useCallback((value: string): SuggestionItem[] => {
    if (!value.trim()) return [];

    const lowercaseValue = value.toLowerCase();
    const suggestions: SuggestionItem[] = [];

    // Add matching tags that aren't already selected
    const matchingTags = tags.filter(tag =>
      tag.name.toLowerCase().includes(lowercaseValue) &&
      !selectedTags.some(selectedTag => selectedTag.id === tag.id)
    ).map(tag => ({
      id: tag.id,
      name: tag.name,
      type: 'tag' as const,
      color: tag.color,
    }));

    suggestions.push(...matchingTags);

    // Add matching categories if enabled
    if (showCategories) {
      const matchingCategories = categories.filter(category =>
        category.name.toLowerCase().includes(lowercaseValue)
      ).map(category => ({
        id: category.id,
        name: `Category: ${category.name}`,
        type: 'category' as const,
        color: category.color,
      }));

      suggestions.push(...matchingCategories);
    }

    // If no exact match and input is valid, suggest creating a new tag
    const exactMatch = tags.some(tag => tag.name.toLowerCase() === lowercaseValue);
    if (!exactMatch && validateTagName(value.trim())) {
      suggestions.push({
        id: 'create-new',
        name: `Create "${value.trim()}"`,
        type: 'tag' as const,
      });
    }

    return suggestions.slice(0, 8); // Limit suggestions
  }, [tags, categories, selectedTags, showCategories, validateTagName]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    const newSuggestions = generateSuggestions(value);
    setSuggestions(newSuggestions);
    setShowSuggestions(newSuggestions.length > 0);
    setSelectedSuggestionIndex(-1);
  };

  const handleInputFocus = () => {
    if (inputValue) {
      const newSuggestions = generateSuggestions(inputValue);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => setShowSuggestions(false), 200);
  };

  const addTag = async (suggestion: SuggestionItem) => {
    if (selectedTags.length >= maxTags) return;

    if (suggestion.type === 'tag') {
      if (suggestion.id === 'create-new') {
        try {
          const newTag = await createTag({ name: inputValue.trim() });
          onTagsChange([...selectedTags, newTag]);
        } catch (error) {
          console.error('Failed to create tag:', error);
        }
      } else {
        const existingTag = tags.find(tag => tag.id === suggestion.id);
        if (existingTag && !selectedTags.some(tag => tag.id === existingTag.id)) {
          onTagsChange([...selectedTags, existingTag]);
        }
      }
    } else if (suggestion.type === 'category') {
      // Add all tags from this category
      const categoryTags = tags.filter(tag => tag.categoryId === suggestion.id);
      const newTags = categoryTags.filter(tag =>
        !selectedTags.some(selectedTag => selectedTag.id === tag.id)
      );
      const updatedTags = [...selectedTags, ...newTags].slice(0, maxTags);
      onTagsChange(updatedTags);
    }

    setInputValue('');
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
  };

  const removeTag = (tagId: string) => {
    onTagsChange(selectedTags.filter(tag => tag.id !== tagId));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
      e.preventDefault();
      addTag(suggestions[selectedSuggestionIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    } else if (e.key === 'Backspace' && inputValue === '' && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1].id);
    }
  };

  const getTagStyle = (tag: Tag) => ({
    backgroundColor: tag.color || '#6B7280',
    color: 'white',
  });

  return (
    <div className={`tag-input-container ${className}`}>
      <div className="tag-input-field">
        {/* Selected tags */}
        <div className="selected-tags">
          {selectedTags.map((tag) => (
            <div
              key={tag.id}
              className="selected-tag"
              style={getTagStyle(tag)}
            >
              <span className="tag-name">{tag.name}</span>
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="tag-remove-btn"
                aria-label={`Remove ${tag.name} tag`}
                disabled={disabled}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? placeholder : ""}
          disabled={disabled || selectedTags.length >= maxTags}
          className="tag-input"
        />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="suggestions-dropdown">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.type}-${suggestion.id}`}
              type="button"
              onClick={() => addTag(suggestion)}
              className={`suggestion-item ${
                index === selectedSuggestionIndex ? 'selected' : ''
              } ${suggestion.type === 'category' ? 'category-suggestion' : ''}`}
            >
              {suggestion.color && (
                <div
                  className="suggestion-color"
                  style={{ backgroundColor: suggestion.color }}
                />
              )}
              <span className="suggestion-name">{suggestion.name}</span>
              {suggestion.type === 'category' && (
                <span className="suggestion-type">Category</span>
              )}
            </button>
          ))}
        </div>
      )}

      <style jsx>{`
        .tag-input-container {
          position: relative;
          width: 100%;
        }

        .tag-input-field {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          min-height: 42px;
          padding: 6px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          background-color: white;
          cursor: text;
          transition: border-color 0.2s ease;
        }

        .tag-input-field:focus-within {
          border-color: #3b82f6;
          outline: none;
        }

        .selected-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-right: 8px;
        }

        .selected-tag {
          display: flex;
          align-items: center;
          padding: 4px 8px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 500;
          white-space: nowrap;
        }

        .tag-name {
          margin-right: 6px;
        }

        .tag-remove-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border: none;
          background: rgba(255, 255, 255, 0.3);
          color: white;
          border-radius: 50%;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .tag-remove-btn:hover {
          background: rgba(255, 255, 255, 0.5);
        }

        .tag-input {
          flex: 1;
          min-width: 120px;
          border: none;
          outline: none;
          padding: 4px 0;
          font-size: 14px;
          background: transparent;
        }

        .tag-input::placeholder {
          color: #9ca3af;
        }

        .suggestions-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 1000;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          max-height: 200px;
          overflow-y: auto;
          margin-top: 4px;
        }

        .suggestion-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 12px 16px;
          border: none;
          background: white;
          text-align: left;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .suggestion-item:hover,
        .suggestion-item.selected {
          background-color: #f3f4f6;
        }

        .suggestion-item.category-suggestion {
          border-left: 3px solid #6b7280;
        }

        .suggestion-color {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          margin-right: 8px;
          flex-shrink: 0;
        }

        .suggestion-name {
          flex: 1;
          margin-right: 8px;
        }

        .suggestion-type {
          font-size: 12px;
          color: #6b7280;
          font-style: italic;
        }

        .tag-input-field:disabled {
          background-color: #f9fafb;
          cursor: not-allowed;
        }

        .tag-input:disabled {
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default TagInput;