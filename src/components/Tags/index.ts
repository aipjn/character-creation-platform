// Tag Management System Components
// Stream C: Issue #5

export { default as TagInput } from './TagInput';
export { default as TagEditor } from './TagEditor';
export { default as CategoryManager } from './CategoryManager';
export { default as TagCloud } from './TagCloud';

// Re-export types for convenience
export type {
  Tag,
  Category,
  TagFormData,
  CategoryFormData,
  TagCloud as TagCloudType,
} from '../../types';

// Re-export hook
export { useTags } from '../../hooks/useTags';