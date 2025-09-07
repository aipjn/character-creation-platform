import React, { useState, useCallback, ChangeEvent } from 'react';
import { ValidationError } from '../../types';

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  'data-testid'?: string;
}

const validateTextInput = (
  value: string,
  options: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
  } = {}
): ValidationError | null => {
  const { required = false, minLength = 0, maxLength = 1000 } = options;

  if (required && !value.trim()) {
    return { field: 'text-input', message: 'This field is required' };
  }

  if (value.length < minLength) {
    return { field: 'text-input', message: `Minimum length is ${minLength} characters` };
  }

  if (value.length > maxLength) {
    return { field: 'text-input', message: `Maximum length is ${maxLength} characters` };
  }

  return null;
};

export const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  onBlur,
  placeholder = 'Describe your character...',
  maxLength = 500,
  minLength = 5,
  required = true,
  disabled = false,
  error,
  'data-testid': testId = 'character-text-input',
}) => {
  const [internalError, setInternalError] = useState<string>('');
  const [isTouched, setIsTouched] = useState(false);

  const handleChange = useCallback((event: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = event.target.value;
    onChange(newValue);

    // Clear internal error when user starts typing
    if (internalError) {
      setInternalError('');
    }
  }, [onChange, internalError]);

  const handleBlur = useCallback(() => {
    setIsTouched(true);
    
    const validation = validateTextInput(value, {
      required,
      minLength,
      maxLength,
    });

    if (validation) {
      setInternalError(validation.message);
    } else {
      setInternalError('');
    }

    onBlur?.();
  }, [value, required, minLength, maxLength, onBlur]);

  const displayError = error || (isTouched ? internalError : '');
  const characterCount = value.length;
  const isOverLimit = characterCount > maxLength;

  return (
    <div className="text-input-container">
      <div className="text-input-wrapper">
        <textarea
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={maxLength + 50} // Allow slightly over for better UX
          disabled={disabled}
          data-testid={testId}
          className={`text-input ${displayError ? 'error' : ''} ${disabled ? 'disabled' : ''}`}
          rows={4}
          style={{
            width: '100%',
            padding: '12px',
            border: `2px solid ${displayError ? '#ef4444' : '#d1d5db'}`,
            borderRadius: '8px',
            fontSize: '16px',
            fontFamily: 'inherit',
            resize: 'vertical',
            minHeight: '100px',
            outline: 'none',
            transition: 'border-color 0.2s ease',
            backgroundColor: disabled ? '#f9fafb' : 'white',
            color: disabled ? '#9ca3af' : '#111827',
          }}
        />
        
        <div className="text-input-footer" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '8px',
        }}>
          <div className="error-message" style={{
            color: '#ef4444',
            fontSize: '14px',
            minHeight: '20px',
            flex: 1,
          }}>
            {displayError}
          </div>
          
          <div
            className="character-count"
            style={{
              fontSize: '14px',
              color: isOverLimit ? '#ef4444' : '#6b7280',
              fontWeight: isOverLimit ? 'bold' : 'normal',
            }}
          >
            {characterCount}/{maxLength}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextInput;