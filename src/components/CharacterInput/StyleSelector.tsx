import React, { useCallback } from 'react';
import { StyleType } from '../../types';

export interface StyleOption {
  value: StyleType;
  label: string;
  description: string;
  icon: string;
}

export interface StyleSelectorProps {
  value: StyleType;
  onChange: (style: StyleType) => void;
  disabled?: boolean;
  error?: string;
  'data-testid'?: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    value: 'cartoon',
    label: 'Cartoon',
    description: 'Animated, stylized characters with vibrant colors',
    icon: '🎨',
  },
  {
    value: 'realistic',
    label: 'Realistic',
    description: 'Photorealistic characters with natural details',
    icon: '📷',
  },
];

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  error,
  'data-testid': testId = 'style-selector',
}) => {
  const handleStyleChange = useCallback((style: StyleType) => {
    if (!disabled) {
      onChange(style);
    }
  }, [onChange, disabled]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent, style: StyleType) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleStyleChange(style);
    }
  }, [handleStyleChange]);

  return (
    <div className="style-selector-container" data-testid={testId}>
      <label className="style-selector-label" style={{
        display: 'block',
        fontSize: '16px',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '8px',
      }}>
        Character Style
      </label>
      
      <div className="style-options" style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '12px',
        marginBottom: '8px',
      }}>
        {STYLE_OPTIONS.map((option) => {
          const isSelected = value === option.value;
          
          return (
            <div
              key={option.value}
              className={`style-option ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              role="radio"
              tabIndex={disabled ? -1 : 0}
              aria-checked={isSelected}
              data-testid={`style-option-${option.value}`}
              onClick={() => handleStyleChange(option.value)}
              onKeyPress={(e) => handleKeyPress(e, option.value)}
              style={{
                padding: '16px',
                border: `2px solid ${isSelected ? '#3b82f6' : error ? '#ef4444' : '#d1d5db'}`,
                borderRadius: '12px',
                backgroundColor: isSelected ? '#eff6ff' : disabled ? '#f9fafb' : 'white',
                cursor: disabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none',
                position: 'relative',
                opacity: disabled ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!disabled && !isSelected) {
                  e.currentTarget.style.borderColor = '#9ca3af';
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (!disabled && !isSelected) {
                  e.currentTarget.style.borderColor = error ? '#ef4444' : '#d1d5db';
                  e.currentTarget.style.backgroundColor = 'white';
                }
              }}
              onFocus={(e) => {
                if (!disabled) {
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div
                  className="selection-indicator"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#3b82f6',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '12px',
                  }}
                  data-testid={`selected-indicator-${option.value}`}
                >
                  ✓
                </div>
              )}
              
              <div className="style-option-content">
                <div className="style-icon" style={{
                  fontSize: '32px',
                  marginBottom: '8px',
                  textAlign: 'center' as const,
                }}>
                  {option.icon}
                </div>
                
                <div className="style-title" style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: isSelected ? '#1d4ed8' : '#374151',
                  marginBottom: '4px',
                  textAlign: 'center' as const,
                }}>
                  {option.label}
                </div>
                
                <div className="style-description" style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  textAlign: 'center' as const,
                  lineHeight: '1.4',
                }}>
                  {option.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {error && (
        <div className="error-message" style={{
          color: '#ef4444',
          fontSize: '14px',
          marginTop: '4px',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default StyleSelector;