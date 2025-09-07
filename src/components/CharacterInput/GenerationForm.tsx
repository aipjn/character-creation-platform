import React, { useState, useCallback, FormEvent } from 'react';
import { StyleType, GenerationRequest, ValidationError, FormState } from '../../types';
import TextInput from './TextInput';
import StyleSelector from './StyleSelector';

export interface GenerationFormData {
  prompt: string;
  style: StyleType;
  batchSize: number;
}

export interface GenerationFormProps {
  onSubmit: (data: GenerationFormData) => void;
  isLoading?: boolean;
  initialData?: Partial<GenerationFormData>;
  maxBatchSize?: number;
  disabled?: boolean;
  'data-testid'?: string;
}

const validateForm = (data: GenerationFormData): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!data.prompt.trim()) {
    errors.push({ field: 'prompt', message: 'Character description is required' });
  } else if (data.prompt.trim().length < 5) {
    errors.push({ field: 'prompt', message: 'Description must be at least 5 characters long' });
  } else if (data.prompt.length > 500) {
    errors.push({ field: 'prompt', message: 'Description must be less than 500 characters' });
  }

  if (!data.style) {
    errors.push({ field: 'style', message: 'Please select a character style' });
  }

  if (data.batchSize < 1 || data.batchSize > 4) {
    errors.push({ field: 'batchSize', message: 'Batch size must be between 1 and 4' });
  }

  return errors;
};

export const GenerationForm: React.FC<GenerationFormProps> = ({
  onSubmit,
  isLoading = false,
  initialData = {},
  maxBatchSize = 4,
  disabled = false,
  'data-testid': testId = 'generation-form',
}) => {
  const [formData, setFormData] = useState<GenerationFormData>({
    prompt: initialData.prompt || '',
    style: initialData.style || 'cartoon',
    batchSize: initialData.batchSize || 1,
  });

  const [formState, setFormState] = useState<FormState>({
    isValid: false,
    errors: [],
    touched: {},
  });

  const updateFormState = useCallback((newFormData: GenerationFormData) => {
    const errors = validateForm(newFormData);
    setFormState({
      isValid: errors.length === 0,
      errors,
      touched: formState.touched,
    });
  }, [formState.touched]);

  const handlePromptChange = useCallback((prompt: string) => {
    const newFormData = { ...formData, prompt };
    setFormData(newFormData);
    updateFormState(newFormData);
  }, [formData, updateFormState]);

  const handleStyleChange = useCallback((style: StyleType) => {
    const newFormData = { ...formData, style };
    setFormData(newFormData);
    updateFormState(newFormData);
    
    // Mark style as touched
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, style: true },
    }));
  }, [formData, updateFormState]);

  const handleBatchSizeChange = useCallback((batchSize: number) => {
    const newFormData = { ...formData, batchSize };
    setFormData(newFormData);
    updateFormState(newFormData);
    
    // Mark batch size as touched
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, batchSize: true },
    }));
  }, [formData, updateFormState]);

  const handlePromptBlur = useCallback(() => {
    setFormState(prev => ({
      ...prev,
      touched: { ...prev.touched, prompt: true },
    }));
  }, []);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    
    // Mark all fields as touched
    setFormState(prev => ({
      ...prev,
      touched: {
        prompt: true,
        style: true,
        batchSize: true,
      },
    }));

    const errors = validateForm(formData);
    setFormState(prev => ({
      ...prev,
      errors,
      isValid: errors.length === 0,
    }));

    if (errors.length === 0) {
      onSubmit(formData);
    }
  }, [formData, onSubmit]);

  const getFieldError = (fieldName: string): string | undefined => {
    return formState.errors.find(error => error.field === fieldName)?.message;
  };

  const isFieldTouched = (fieldName: string): boolean => {
    return !!formState.touched[fieldName];
  };

  const isFormDisabled = disabled || isLoading;

  return (
    <form
      className="generation-form"
      onSubmit={handleSubmit}
      data-testid={testId}
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '24px',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="form-header" style={{ marginBottom: '24px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 8px 0',
        }}>
          Generate Character
        </h2>
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          margin: 0,
        }}>
          Describe your character and choose a style to generate up to {maxBatchSize} variations.
        </p>
      </div>

      <div className="form-fields" style={{ marginBottom: '24px' }}>
        <div className="field-group" style={{ marginBottom: '20px' }}>
          <TextInput
            value={formData.prompt}
            onChange={handlePromptChange}
            onBlur={handlePromptBlur}
            error={isFieldTouched('prompt') ? getFieldError('prompt') : undefined}
            disabled={isFormDisabled}
            placeholder="Describe your character (e.g., 'A brave knight with golden armor and a magical sword')"
            data-testid="generation-form-prompt"
          />
        </div>

        <div className="field-group" style={{ marginBottom: '20px' }}>
          <StyleSelector
            value={formData.style}
            onChange={handleStyleChange}
            error={isFieldTouched('style') ? getFieldError('style') : undefined}
            disabled={isFormDisabled}
            data-testid="generation-form-style"
          />
        </div>

        <div className="field-group">
          <label
            htmlFor="batch-size"
            className="batch-size-label"
            style={{
              display: 'block',
              fontSize: '16px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
            }}
          >
            Number of Variations
          </label>
          
          <div className="batch-size-selector" style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '8px',
          }}>
            {Array.from({ length: maxBatchSize }, (_, i) => i + 1).map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleBatchSizeChange(num)}
                disabled={isFormDisabled}
                data-testid={`batch-size-${num}`}
                className={`batch-size-option ${formData.batchSize === num ? 'selected' : ''}`}
                style={{
                  width: '48px',
                  height: '48px',
                  border: `2px solid ${formData.batchSize === num ? '#3b82f6' : '#d1d5db'}`,
                  borderRadius: '8px',
                  backgroundColor: formData.batchSize === num ? '#eff6ff' : 'white',
                  color: formData.batchSize === num ? '#1d4ed8' : '#374151',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  opacity: isFormDisabled ? 0.6 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isFormDisabled && formData.batchSize !== num) {
                    e.currentTarget.style.borderColor = '#9ca3af';
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isFormDisabled && formData.batchSize !== num) {
                    e.currentTarget.style.borderColor = '#d1d5db';
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
                onFocus={(e) => {
                  if (!isFormDisabled) {
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                  }
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {num}
              </button>
            ))}
          </div>
          
          {isFieldTouched('batchSize') && getFieldError('batchSize') && (
            <div style={{ color: '#ef4444', fontSize: '14px' }}>
              {getFieldError('batchSize')}
            </div>
          )}
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          disabled={isFormDisabled}
          data-testid="generate-button"
          className="generate-button"
          style={{
            width: '100%',
            padding: '16px 24px',
            backgroundColor: isFormDisabled ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: isFormDisabled ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s ease',
            outline: 'none',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            if (!isFormDisabled) {
              e.currentTarget.style.backgroundColor = '#2563eb';
            }
          }}
          onMouseLeave={(e) => {
            if (!isFormDisabled) {
              e.currentTarget.style.backgroundColor = '#3b82f6';
            }
          }}
          onFocus={(e) => {
            if (!isFormDisabled) {
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {isLoading && (
            <div
              className="loading-spinner"
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid transparent',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
          )}
          {isLoading ? 'Generating...' : `Generate ${formData.batchSize} Variation${formData.batchSize > 1 ? 's' : ''}`}
        </button>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </form>
  );
};

export default GenerationForm;