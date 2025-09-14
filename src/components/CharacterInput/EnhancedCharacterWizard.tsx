import React, { useState, useCallback, useMemo } from 'react';
import { StyleType } from '../../types';
import { CharacterCreateFormData } from '../../types/character';
import TextInput from './TextInput';
import StyleSelector from './StyleSelector';
import CharacterAttributesForm, { CharacterAttributesFormData } from './CharacterAttributesForm';
import TagInput from '../Tags/TagInput';

export interface EnhancedCharacterFormData extends CharacterCreateFormData {
  batchSize: number;
}

export interface EnhancedCharacterWizardProps {
  onSubmit: (data: EnhancedCharacterFormData) => void;
  onSaveDraft?: (data: Partial<EnhancedCharacterFormData>) => void;
  isLoading?: boolean;
  initialData?: Partial<EnhancedCharacterFormData>;
  maxBatchSize?: number;
  disabled?: boolean;
  'data-testid'?: string;
}

type WizardStep = 'basic' | 'attributes' | 'review';

const STEP_TITLES = {
  basic: 'Basic Character',
  attributes: 'Character Details',
  review: 'Review & Generate'
};

const STEP_DESCRIPTIONS = {
  basic: 'Start with a description and visual style for your character',
  attributes: 'Add detailed attributes to make your character unique',
  review: 'Review your character and generate variations'
};

export const EnhancedCharacterWizard: React.FC<EnhancedCharacterWizardProps> = ({
  onSubmit,
  onSaveDraft,
  isLoading = false,
  initialData = {},
  maxBatchSize = 4,
  disabled = false,
  'data-testid': testId = 'enhanced-character-wizard',
}) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [formData, setFormData] = useState<EnhancedCharacterFormData>({
    name: initialData.name || '',
    prompt: initialData.prompt || '',
    styleType: initialData.styleType || 'REALISTIC',
    referenceImageUrl: initialData.referenceImageUrl,
    tags: initialData.tags || [],
    isPublic: initialData.isPublic || false,
    batchSize: initialData.batchSize || 1,
    
    // Character attributes
    age: initialData.age,
    gender: initialData.gender,
    occupation: initialData.occupation,
    personality: initialData.personality || [],
    physicalTraits: initialData.physicalTraits,
    clothing: initialData.clothing,
    background: initialData.background,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateBasicStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.prompt.trim()) {
      newErrors.prompt = 'Character description is required';
    } else if (formData.prompt.trim().length < 5) {
      newErrors.prompt = 'Description must be at least 5 characters long';
    }
    
    if (!formData.styleType) {
      newErrors.styleType = 'Please select a character style';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.prompt, formData.styleType]);

  const validateReviewStep = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (formData.batchSize < 1 || formData.batchSize > maxBatchSize) {
      newErrors.batchSize = `Batch size must be between 1 and ${maxBatchSize}`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.batchSize, maxBatchSize]);

  const handleInputChange = useCallback(<K extends keyof EnhancedCharacterFormData>(
    field: K, 
    value: EnhancedCharacterFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    
    // Auto-save draft
    if (onSaveDraft) {
      const updatedData = { ...formData, [field]: value };
      onSaveDraft(updatedData);
    }
  }, [formData, errors, onSaveDraft]);

  const handleAttributesChange = useCallback((attributes: CharacterAttributesFormData) => {
    const updatedFormData = {
      ...formData,
      ...attributes
    };
    setFormData(updatedFormData);
    
    if (onSaveDraft) {
      onSaveDraft(updatedFormData);
    }
  }, [formData, onSaveDraft]);

  const handleTagsChange = useCallback((tags: string[]) => {
    handleInputChange('tags', tags);
  }, [handleInputChange]);

  const handleNextStep = useCallback(() => {
    let canProceed = true;
    
    if (currentStep === 'basic') {
      canProceed = validateBasicStep();
    }
    
    if (canProceed) {
      if (currentStep === 'basic') {
        setCurrentStep('attributes');
      } else if (currentStep === 'attributes') {
        setCurrentStep('review');
      }
    }
  }, [currentStep, validateBasicStep]);

  const handlePrevStep = useCallback(() => {
    if (currentStep === 'attributes') {
      setCurrentStep('basic');
    } else if (currentStep === 'review') {
      setCurrentStep('attributes');
    }
  }, [currentStep]);

  const handleSubmit = useCallback(() => {
    if (validateReviewStep()) {
      onSubmit(formData);
    }
  }, [formData, onSubmit, validateReviewStep]);

  // Generate enhanced prompt with attributes
  const enhancedPrompt = useMemo(() => {
    let prompt = formData.prompt;
    
    if (formData.age) prompt += ` (${formData.age})`;
    if (formData.gender) prompt += ` ${formData.gender}`;
    if (formData.occupation) prompt += ` ${formData.occupation}`;
    
    if (formData.personality && formData.personality.length > 0) {
      prompt += `, personality: ${formData.personality.join(', ')}`;
    }
    
    if (formData.physicalTraits) {
      const traits = [];
      if (formData.physicalTraits.height) traits.push(formData.physicalTraits.height);
      if (formData.physicalTraits.build) traits.push(formData.physicalTraits.build);
      if (formData.physicalTraits.hairColor) traits.push(`${formData.physicalTraits.hairColor} hair`);
      if (formData.physicalTraits.eyeColor) traits.push(`${formData.physicalTraits.eyeColor} eyes`);
      if (traits.length > 0) {
        prompt += `, appearance: ${traits.join(', ')}`;
      }
    }
    
    if (formData.clothing) prompt += `, wearing ${formData.clothing}`;
    if (formData.background) prompt += `. Background: ${formData.background}`;
    
    return prompt;
  }, [formData]);

  const StepIndicator = () => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      marginBottom: '32px',
      padding: '0 24px'
    }}>
      {(['basic', 'attributes', 'review'] as WizardStep[]).map((step, index) => {
        const isActive = step === currentStep;
        const isCompleted = (
          (step === 'basic' && ['attributes', 'review'].includes(currentStep)) ||
          (step === 'attributes' && currentStep === 'review')
        );
        
        return (
          <React.Fragment key={step}>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: isCompleted ? '#10b981' : (isActive ? '#3b82f6' : '#e5e7eb'),
                color: isCompleted || isActive ? 'white' : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                fontWeight: '600',
                marginBottom: '8px',
                transition: 'all 0.3s ease'
              }}>
                {isCompleted ? '✓' : index + 1}
              </div>
              <div style={{
                fontSize: '12px',
                fontWeight: '500',
                color: isActive ? '#3b82f6' : '#6b7280',
                textAlign: 'center'
              }}>
                {STEP_TITLES[step]}
              </div>
            </div>
            {index < 2 && (
              <div style={{
                flex: 1,
                height: '2px',
                backgroundColor: isCompleted ? '#10b981' : '#e5e7eb',
                marginBottom: '32px',
                transition: 'all 0.3s ease'
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const isFormDisabled = disabled || isLoading;

  return (
    <div 
      className="enhanced-character-wizard" 
      data-testid={testId}
      style={{
        maxWidth: '900px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '16px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{
        backgroundColor: '#f8fafc',
        padding: '24px',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 8px 0',
          textAlign: 'center'
        }}>
          Create Your Character
        </h1>
        <p style={{
          fontSize: '16px',
          color: '#6b7280',
          margin: 0,
          textAlign: 'center'
        }}>
          {STEP_DESCRIPTIONS[currentStep]}
        </p>
      </div>

      {/* Step Indicator */}
      <div style={{ padding: '24px 0' }}>
        <StepIndicator />
      </div>

      {/* Step Content */}
      <div style={{ padding: '0 24px 24px' }}>
        {currentStep === 'basic' && (
          <div className="basic-step">
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Character Name (Optional)
              </label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                disabled={isFormDisabled}
                placeholder="Give your character a name..."
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '16px',
                  color: '#374151'
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <TextInput
                value={formData.prompt}
                onChange={(prompt) => handleInputChange('prompt', prompt)}
                error={errors.prompt}
                disabled={isFormDisabled}
                placeholder="Describe your character (e.g., 'A brave knight with golden armor and a magical sword')"
                data-testid="wizard-prompt-input"
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <StyleSelector
                value={formData.styleType}
                onChange={(styleType) => handleInputChange('styleType', styleType)}
                error={errors.styleType}
                disabled={isFormDisabled}
                data-testid="wizard-style-selector"
              />
            </div>

            <div>
              <label style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Tags (Optional)
              </label>
              <TagInput
                value={formData.tags}
                onChange={handleTagsChange}
                disabled={isFormDisabled}
                placeholder="Add tags to categorize your character..."
              />
            </div>
          </div>
        )}

        {currentStep === 'attributes' && (
          <CharacterAttributesForm
            value={{
              age: formData.age,
              gender: formData.gender,
              occupation: formData.occupation,
              personality: formData.personality,
              physicalTraits: formData.physicalTraits,
              clothing: formData.clothing,
              background: formData.background,
              referenceImageUrl: formData.referenceImageUrl,
            }}
            onChange={handleAttributesChange}
            disabled={isFormDisabled}
            data-testid="wizard-attributes-form"
          />
        )}

        {currentStep === 'review' && (
          <div className="review-step">
            <div style={{
              backgroundColor: '#f8fafc',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '12px' }}>
                Generated Prompt Preview
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#374151',
                lineHeight: '1.6',
                margin: 0,
                padding: '12px',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                {enhancedPrompt}
              </p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '16px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '12px'
              }}>
                Number of Variations
              </label>
              
              <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '8px'
              }}>
                {Array.from({ length: maxBatchSize }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleInputChange('batchSize', num)}
                    disabled={isFormDisabled}
                    style={{
                      width: '60px',
                      height: '60px',
                      border: `2px solid ${formData.batchSize === num ? '#3b82f6' : '#d1d5db'}`,
                      borderRadius: '12px',
                      backgroundColor: formData.batchSize === num ? '#eff6ff' : 'white',
                      color: formData.batchSize === num ? '#1d4ed8' : '#374151',
                      fontSize: '18px',
                      fontWeight: '600',
                      cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
              
              {errors.batchSize && (
                <div style={{ color: '#ef4444', fontSize: '14px' }}>
                  {errors.batchSize}
                </div>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              backgroundColor: '#fefce8',
              border: '1px solid #facc15',
              borderRadius: '8px'
            }}>
              <input
                type="checkbox"
                id="make-public"
                checked={formData.isPublic}
                onChange={(e) => handleInputChange('isPublic', e.target.checked)}
                disabled={isFormDisabled}
              />
              <label htmlFor="make-public" style={{
                fontSize: '14px',
                color: '#374151',
                cursor: isFormDisabled ? 'not-allowed' : 'pointer'
              }}>
                Make this character public (others can see it in the gallery)
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{
        padding: '24px',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: '#f8fafc',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <button
          type="button"
          onClick={handlePrevStep}
          disabled={currentStep === 'basic' || isFormDisabled}
          style={{
            padding: '12px 24px',
            border: '1px solid #d1d5db',
            borderRadius: '8px',
            backgroundColor: 'white',
            color: '#374151',
            fontSize: '16px',
            fontWeight: '500',
            cursor: (currentStep === 'basic' || isFormDisabled) ? 'not-allowed' : 'pointer',
            opacity: (currentStep === 'basic' || isFormDisabled) ? 0.5 : 1,
            transition: 'all 0.2s ease'
          }}
        >
          ← Previous
        </button>

        {currentStep === 'review' ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isFormDisabled}
            style={{
              padding: '12px 32px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: isFormDisabled ? '#9ca3af' : '#3b82f6',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isFormDisabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {isLoading && (
              <div
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
        ) : (
          <button
            type="button"
            onClick={handleNextStep}
            disabled={isFormDisabled}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              backgroundColor: isFormDisabled ? '#9ca3af' : '#3b82f6',
              color: 'white',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isFormDisabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Next →
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EnhancedCharacterWizard;