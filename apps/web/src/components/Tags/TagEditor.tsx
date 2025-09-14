import React, { useState, useEffect } from 'react';
import { Tag, TagFormData, Category } from '../../types';
import { useTags } from '../../hooks/useTags';

interface TagEditorProps {
  tag?: Tag; // If provided, we're editing; otherwise creating
  onSave: (tag: Tag) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const COLOR_OPTIONS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#EAB308', // Yellow
  '#84CC16', // Lime
  '#22C55E', // Green
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#6366F1', // Indigo
  '#8B5CF6', // Violet
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#F43F5E', // Rose
  '#6B7280', // Gray
  '#374151', // Gray Dark
];

const TagEditor: React.FC<TagEditorProps> = ({
  tag,
  onSave,
  onCancel,
  isOpen,
}) => {
  const { 
    categories, 
    createTag, 
    updateTag, 
    validateTagName, 
    isLoading,
    error 
  } = useTags();
  
  const [formData, setFormData] = useState<TagFormData>({
    name: '',
    color: COLOR_OPTIONS[0],
    categoryId: undefined,
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form when tag or modal state changes
  useEffect(() => {
    if (isOpen) {
      if (tag) {
        // Editing existing tag
        setFormData({
          name: tag.name,
          color: tag.color || COLOR_OPTIONS[0],
          categoryId: tag.categoryId,
        });
      } else {
        // Creating new tag
        setFormData({
          name: '',
          color: COLOR_OPTIONS[0],
          categoryId: undefined,
        });
      }
      setErrors({});
    }
  }, [tag, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Tag name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Tag name must be at least 2 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Tag name must be less than 50 characters';
    } else if (!validateTagName(formData.name) && (!tag || tag.name !== formData.name)) {
      newErrors.name = 'Tag name already exists';
    }

    // Color validation
    if (!formData.color) {
      newErrors.color = 'Please select a color';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      let savedTag: Tag;
      
      if (tag) {
        // Update existing tag
        savedTag = await updateTag(tag.id, formData);
      } else {
        // Create new tag
        savedTag = await createTag(formData);
      }
      
      onSave(savedTag);
    } catch (error) {
      console.error('Failed to save tag:', error);
      setErrors({ 
        submit: error instanceof Error ? error.message : 'Failed to save tag' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof TagFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleColorSelect = (color: string) => {
    handleInputChange('color', color);
  };

  const handleCategorySelect = (categoryId: string) => {
    handleInputChange('categoryId', categoryId === '' ? undefined : categoryId);
  };

  if (!isOpen) return null;

  return (
    <div className="tag-editor-overlay">
      <div className="tag-editor-modal">
        <div className="modal-header">
          <h2 className="modal-title">
            {tag ? 'Edit Tag' : 'Create New Tag'}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="close-button"
            aria-label="Close modal"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* Name field */}
          <div className="form-group">
            <label htmlFor="tag-name" className="form-label">
              Tag Name *
            </label>
            <input
              id="tag-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="Enter tag name"
              maxLength={50}
              disabled={isSubmitting || isLoading}
            />
            {errors.name && (
              <span className="error-message">{errors.name}</span>
            )}
          </div>

          {/* Color field */}
          <div className="form-group">
            <label className="form-label">Color *</label>
            <div className="color-picker">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className={`color-option ${
                    formData.color === color ? 'selected' : ''
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                  disabled={isSubmitting || isLoading}
                />
              ))}
            </div>
            {errors.color && (
              <span className="error-message">{errors.color}</span>
            )}
          </div>

          {/* Category field */}
          <div className="form-group">
            <label htmlFor="tag-category" className="form-label">
              Category (Optional)
            </label>
            <select
              id="tag-category"
              value={formData.categoryId || ''}
              onChange={(e) => handleCategorySelect(e.target.value)}
              className="form-input"
              disabled={isSubmitting || isLoading}
            >
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Preview */}
          <div className="form-group">
            <label className="form-label">Preview</label>
            <div className="tag-preview">
              <div
                className="preview-tag"
                style={{ backgroundColor: formData.color }}
              >
                {formData.name || 'Tag Name'}
              </div>
            </div>
          </div>

          {/* Error messages */}
          {(errors.submit || error) && (
            <div className="error-banner">
              {errors.submit || error}
            </div>
          )}

          {/* Form actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="cancel-button"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? 'Saving...' : (tag ? 'Update Tag' : 'Create Tag')}
            </button>
          </div>
        </form>
      </div>

      <style jsx>{`
        .tag-editor-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .tag-editor-modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 24px 24px 0;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        .close-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border: none;
          background: #f3f4f6;
          color: #6b7280;
          border-radius: 8px;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .close-button:hover {
          background: #e5e7eb;
          color: #374151;
        }

        .modal-form {
          padding: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }

        .form-input {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          transition: border-color 0.2s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-input.error {
          border-color: #ef4444;
        }

        .form-input:disabled {
          background-color: #f9fafb;
          color: #6b7280;
          cursor: not-allowed;
        }

        .error-message {
          display: block;
          font-size: 12px;
          color: #ef4444;
          margin-top: 4px;
        }

        .color-picker {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 8px;
          margin-top: 8px;
        }

        .color-option {
          width: 32px;
          height: 32px;
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }

        .color-option:hover {
          transform: scale(1.1);
        }

        .color-option.selected {
          border-color: #111827;
          transform: scale(1.1);
        }

        .color-option.selected::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-weight: bold;
          font-size: 14px;
          text-shadow: 0 0 2px rgba(0, 0, 0, 0.5);
        }

        .color-option:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .tag-preview {
          padding: 8px 0;
        }

        .preview-tag {
          display: inline-flex;
          align-items: center;
          padding: 6px 12px;
          border-radius: 16px;
          font-size: 14px;
          font-weight: 500;
          color: white;
        }

        .error-banner {
          padding: 12px 16px;
          background-color: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .cancel-button {
          padding: 10px 20px;
          border: 2px solid #e5e7eb;
          background: white;
          color: #6b7280;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-button:hover:not(:disabled) {
          border-color: #d1d5db;
          color: #374151;
        }

        .save-button {
          padding: 10px 20px;
          border: 2px solid #3b82f6;
          background: #3b82f6;
          color: white;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .save-button:hover:not(:disabled) {
          background: #2563eb;
          border-color: #2563eb;
        }

        .save-button:disabled,
        .cancel-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
};

export default TagEditor;