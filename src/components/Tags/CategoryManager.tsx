import React, { useState } from 'react';
import { Category, CategoryFormData, Tag } from '../../types';
import { useTags } from '../../hooks/useTags';

interface CategoryManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CategoryEditorProps {
  category?: Category;
  onSave: (category: Category) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const COLOR_OPTIONS = [
  '#6B7280', '#4B5563', '#374151', '#111827', // Grays
  '#EF4444', '#DC2626', '#B91C1C', '#991B1B', // Reds
  '#F97316', '#EA580C', '#C2410C', '#9A3412', // Oranges
  '#EAB308', '#CA8A04', '#A16207', '#854D0E', // Yellows
  '#22C55E', '#16A34A', '#15803D', '#166534', // Greens
  '#3B82F6', '#2563EB', '#1D4ED8', '#1E40AF', // Blues
  '#8B5CF6', '#7C3AED', '#6D28D9', '#5B21B6', // Purples
];

const CategoryEditor: React.FC<CategoryEditorProps> = ({
  category,
  onSave,
  onCancel,
  isOpen,
}) => {
  const { 
    categories, 
    createCategory, 
    updateCategory, 
    validateCategoryName, 
    isLoading 
  } = useTags();
  
  const [formData, setFormData] = useState<CategoryFormData>(() => ({
    name: category?.name || '',
    parentId: category?.parentId,
    color: category?.color || COLOR_OPTIONS[0],
    description: category?.description || '',
  }));
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (category) {
        setFormData({
          name: category.name,
          parentId: category.parentId,
          color: category.color || COLOR_OPTIONS[0],
          description: category.description || '',
        });
      } else {
        setFormData({
          name: '',
          parentId: undefined,
          color: COLOR_OPTIONS[0],
          description: '',
        });
      }
      setErrors({});
    }
  }, [category, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Category name is required';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Category name must be at least 2 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Category name must be less than 50 characters';
    } else if (!validateCategoryName(formData.name) && (!category || category.name !== formData.name)) {
      newErrors.name = 'Category name already exists';
    }

    if (formData.description && formData.description.length > 200) {
      newErrors.description = 'Description must be less than 200 characters';
    }

    if (formData.parentId === category?.id) {
      newErrors.parentId = 'A category cannot be its own parent';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    
    try {
      let savedCategory: Category;
      
      if (category) {
        savedCategory = await updateCategory(category.id, formData);
      } else {
        savedCategory = await createCategory(formData);
      }
      
      onSave(savedCategory);
    } catch (error) {
      setErrors({ 
        submit: error instanceof Error ? error.message : 'Failed to save category' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof CategoryFormData, value: string | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Get available parent categories (exclude self and descendants)
  const availableParentCategories = categories.filter(cat => 
    cat.id !== category?.id && cat.parentId !== category?.id
  );

  if (!isOpen) return null;

  return (
    <div className="category-editor-overlay">
      <div className="category-editor-modal">
        <div className="modal-header">
          <h3 className="modal-title">
            {category ? 'Edit Category' : 'Create New Category'}
          </h3>
          <button onClick={onCancel} className="close-button">×</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`form-input ${errors.name ? 'error' : ''}`}
              placeholder="Category name"
              maxLength={50}
              disabled={isSubmitting || isLoading}
            />
            {errors.name && <span className="error-message">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Parent Category</label>
            <select
              value={formData.parentId || ''}
              onChange={(e) => handleInputChange('parentId', e.target.value || undefined)}
              className="form-input"
              disabled={isSubmitting || isLoading}
            >
              <option value="">None (Top Level)</option>
              {availableParentCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.parentId && <span className="error-message">{errors.parentId}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="color-picker">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleInputChange('color', color)}
                  className={`color-option ${formData.color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  disabled={isSubmitting || isLoading}
                />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={`form-textarea ${errors.description ? 'error' : ''}`}
              placeholder="Optional description"
              maxLength={200}
              rows={3}
              disabled={isSubmitting || isLoading}
            />
            {errors.description && <span className="error-message">{errors.description}</span>}
            <div className="character-count">
              {(formData.description || '').length}/200
            </div>
          </div>

          {errors.submit && (
            <div className="error-banner">{errors.submit}</div>
          )}

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-button">
              Cancel
            </button>
            <button type="submit" className="save-button" disabled={isSubmitting || isLoading}>
              {isSubmitting ? 'Saving...' : (category ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CategoryManager: React.FC<CategoryManagerProps> = ({ isOpen, onClose }) => {
  const { 
    categories, 
    tags, 
    deleteCategory, 
    getTagsByCategory, 
    isLoading, 
    error 
  } = useTags();
  
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [showEditor, setShowEditor] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setShowEditor(true);
  };

  const handleCreate = () => {
    setEditingCategory(undefined);
    setShowEditor(true);
  };

  const handleSave = () => {
    setShowEditor(false);
    setEditingCategory(undefined);
  };

  const handleDelete = async (categoryId: string) => {
    try {
      await deleteCategory(categoryId);
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const getCategoryHierarchy = () => {
    const topLevelCategories = categories.filter(cat => !cat.parentId);
    
    const buildTree = (parentId?: string): Category[] => {
      return categories
        .filter(cat => cat.parentId === parentId)
        .map(cat => ({
          ...cat,
          children: buildTree(cat.id)
        }));
    };
    
    return topLevelCategories.map(cat => ({
      ...cat,
      children: buildTree(cat.id)
    }));
  };

  const renderCategory = (category: Category, level = 0) => {
    const categoryTags = getTagsByCategory(category.id);
    
    return (
      <div key={category.id} className={`category-item level-${level}`}>
        <div className="category-header">
          <div className="category-info">
            <div 
              className="category-color" 
              style={{ backgroundColor: category.color || '#6B7280' }}
            />
            <div className="category-details">
              <h4 className="category-name">{category.name}</h4>
              {category.description && (
                <p className="category-description">{category.description}</p>
              )}
              <div className="category-stats">
                {categoryTags.length} tag{categoryTags.length !== 1 ? 's' : ''}
                {category.children?.length ? ` • ${category.children.length} subcategories` : ''}
              </div>
            </div>
          </div>
          
          <div className="category-actions">
            <button onClick={() => handleEdit(category)} className="edit-button">
              Edit
            </button>
            <button 
              onClick={() => setDeleteConfirm(category.id)}
              className="delete-button"
              disabled={categoryTags.length > 0}
              title={categoryTags.length > 0 ? 'Cannot delete category with tags' : 'Delete category'}
            >
              Delete
            </button>
          </div>
        </div>
        
        {category.children?.map(child => renderCategory(child, level + 1))}
      </div>
    );
  };

  if (!isOpen) return null;

  const categoryHierarchy = getCategoryHierarchy();

  return (
    <>
      <div className="category-manager-overlay">
        <div className="category-manager-modal">
          <div className="modal-header">
            <h2 className="modal-title">Category Manager</h2>
            <button onClick={onClose} className="close-button">×</button>
          </div>

          <div className="modal-content">
            <div className="toolbar">
              <button onClick={handleCreate} className="create-button">
                Create Category
              </button>
              {error && <div className="error-message">{error}</div>}
            </div>

            {isLoading ? (
              <div className="loading">Loading categories...</div>
            ) : categoryHierarchy.length === 0 ? (
              <div className="empty-state">
                <p>No categories yet. Create your first category to organize tags.</p>
              </div>
            ) : (
              <div className="categories-list">
                {categoryHierarchy.map(category => renderCategory(category))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CategoryEditor
        category={editingCategory}
        isOpen={showEditor}
        onSave={handleSave}
        onCancel={() => setShowEditor(false)}
      />

      {deleteConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h3>Delete Category</h3>
            <p>Are you sure you want to delete this category? This action cannot be undone.</p>
            <div className="confirm-actions">
              <button onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="delete-confirm">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .category-manager-overlay,
        .category-editor-overlay,
        .confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .category-manager-modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 800px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .category-editor-modal,
        .confirm-modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-title {
          font-size: 20px;
          font-weight: 600;
          margin: 0;
        }

        .close-button {
          width: 32px;
          height: 32px;
          border: none;
          background: #f3f4f6;
          border-radius: 8px;
          font-size: 18px;
          cursor: pointer;
        }

        .modal-content {
          padding: 24px;
        }

        .toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .create-button {
          padding: 10px 16px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        }

        .categories-list {
          space-y: 16px;
        }

        .category-item {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 8px;
        }

        .category-item.level-1 {
          margin-left: 24px;
          border-left: 3px solid #d1d5db;
        }

        .category-item.level-2 {
          margin-left: 48px;
          border-left: 3px solid #d1d5db;
        }

        .category-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .category-info {
          display: flex;
          gap: 12px;
          flex: 1;
        }

        .category-color {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
        }

        .category-name {
          font-size: 16px;
          font-weight: 500;
          margin: 0 0 4px 0;
        }

        .category-description {
          font-size: 14px;
          color: #6b7280;
          margin: 0 0 8px 0;
        }

        .category-stats {
          font-size: 12px;
          color: #9ca3af;
        }

        .category-actions {
          display: flex;
          gap: 8px;
        }

        .edit-button,
        .delete-button {
          padding: 6px 12px;
          border: 1px solid #d1d5db;
          background: white;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
        }

        .delete-button {
          color: #dc2626;
          border-color: #fecaca;
        }

        .delete-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .loading,
        .empty-state {
          text-align: center;
          padding: 48px 24px;
          color: #6b7280;
        }

        /* Form styles */
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
          margin-bottom: 6px;
        }

        .form-input,
        .form-textarea {
          width: 100%;
          padding: 10px 12px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
        }

        .form-input:focus,
        .form-textarea:focus {
          outline: none;
          border-color: #3b82f6;
        }

        .form-input.error,
        .form-textarea.error {
          border-color: #ef4444;
        }

        .color-picker {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 8px;
          margin-top: 8px;
        }

        .color-option {
          width: 24px;
          height: 24px;
          border: 2px solid transparent;
          border-radius: 4px;
          cursor: pointer;
        }

        .color-option.selected {
          border-color: #111827;
        }

        .character-count {
          font-size: 12px;
          color: #6b7280;
          text-align: right;
          margin-top: 4px;
        }

        .error-message {
          display: block;
          font-size: 12px;
          color: #ef4444;
          margin-top: 4px;
        }

        .error-banner {
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          color: #dc2626;
          margin-bottom: 20px;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }

        .cancel-button,
        .save-button {
          padding: 10px 20px;
          border-radius: 8px;
          font-weight: 500;
          cursor: pointer;
        }

        .cancel-button {
          border: 2px solid #e5e7eb;
          background: white;
          color: #6b7280;
        }

        .save-button {
          border: 2px solid #3b82f6;
          background: #3b82f6;
          color: white;
        }

        .confirm-modal {
          padding: 24px;
          text-align: center;
        }

        .confirm-actions {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-top: 20px;
        }

        .delete-confirm {
          background: #dc2626;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
        }
      `}</style>
    </>
  );
};

export default CategoryManager;