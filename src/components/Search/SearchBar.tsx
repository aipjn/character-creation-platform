import React, { useState, useCallback, useRef, useEffect } from 'react';
import { SearchOptions } from '../../types/gallery';

interface SearchBarProps {
  value: string;
  onChange: (query: string) => void;
  onClear?: () => void;
  options?: SearchOptions;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  options = {},
  className = '',
  placeholder,
  disabled = false,
  loading = false,
}) => {
  const {
    placeholder: defaultPlaceholder = 'Search characters...',
    debounceMs = 300,
    minLength = 0,
    showClearButton = true,
  } = options;

  const [internalValue, setInternalValue] = useState(value);
  const debounceRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync internal value with external value
  useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Debounced onChange handler
  const debouncedOnChange = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        if (query.length >= minLength) {
          onChange(query);
        } else if (query.length === 0) {
          onChange('');
        }
      }, debounceMs);
    },
    [onChange, debounceMs, minLength]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      debouncedOnChange(newValue);
    },
    [debouncedOnChange]
  );

  const handleClear = useCallback(() => {
    setInternalValue('');
    onChange('');
    if (onClear) {
      onClear();
    }
    inputRef.current?.focus();
  }, [onChange, onClear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleClear();
      }
    },
    [handleClear]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={`search-bar ${className}`}>
      <div className="search-bar__container">
        <div className="search-bar__input-wrapper">
          <svg
            className="search-bar__icon search-bar__icon--search"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          
          <input
            ref={inputRef}
            type="text"
            value={internalValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || defaultPlaceholder}
            disabled={disabled || loading}
            className="search-bar__input"
            aria-label="Search characters"
            autoComplete="off"
            spellCheck="false"
          />

          {loading && (
            <svg
              className="search-bar__icon search-bar__icon--loading"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a9 9 0 11-6.219-8.56" />
            </svg>
          )}

          {showClearButton && internalValue && !loading && (
            <button
              type="button"
              onClick={handleClear}
              className="search-bar__clear"
              aria-label="Clear search"
              title="Clear search"
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {internalValue && minLength > 0 && internalValue.length < minLength && (
          <div className="search-bar__hint">
            Type at least {minLength} characters to search
          </div>
        )}
      </div>

      <style jsx>{`
        .search-bar {
          width: 100%;
        }

        .search-bar__container {
          position: relative;
        }

        .search-bar__input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-bar__input {
          width: 100%;
          padding: 12px 16px;
          padding-left: 44px;
          padding-right: ${showClearButton ? '44px' : '16px'};
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.5;
          background-color: #ffffff;
          color: #1f2937;
          transition: all 0.2s ease;
        }

        .search-bar__input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-bar__input:disabled {
          background-color: #f9fafb;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .search-bar__input::placeholder {
          color: #9ca3af;
        }

        .search-bar__icon {
          position: absolute;
          color: #9ca3af;
          transition: color 0.2s ease;
        }

        .search-bar__icon--search {
          left: 12px;
        }

        .search-bar__icon--loading {
          right: ${showClearButton ? '44px' : '12px'};
          animation: spin 1s linear infinite;
        }

        .search-bar__clear {
          position: absolute;
          right: 12px;
          background: none;
          border: none;
          color: #9ca3af;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .search-bar__clear:hover {
          color: #6b7280;
          background-color: #f3f4f6;
        }

        .search-bar__clear:active {
          background-color: #e5e7eb;
        }

        .search-bar__hint {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          padding: 4px 8px;
          background-color: #1f2937;
          color: #ffffff;
          font-size: 12px;
          border-radius: 4px;
          white-space: nowrap;
          z-index: 10;
        }

        .search-bar__hint::before {
          content: '';
          position: absolute;
          bottom: 100%;
          left: 12px;
          width: 0;
          height: 0;
          border-left: 4px solid transparent;
          border-right: 4px solid transparent;
          border-bottom: 4px solid #1f2937;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 768px) {
          .search-bar__input {
            padding: 10px 14px;
            padding-left: 40px;
            padding-right: ${showClearButton ? '40px' : '14px'};
            font-size: 16px; /* Prevents zoom on iOS */
          }

          .search-bar__icon--search {
            left: 10px;
          }

          .search-bar__clear {
            right: 10px;
          }
        }
      `}</style>
    </div>
  );
};

export default SearchBar;