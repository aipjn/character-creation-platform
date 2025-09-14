import { useState, useEffect, useCallback } from 'react';
import { Tag, Category, TagFormData, CategoryFormData } from '../types';

// Mock data for development - will be replaced with API calls
const mockTags: Tag[] = [
  { id: '1', name: 'Fantasy', color: '#8B5CF6', categoryId: '1', createdAt: new Date(), updatedAt: new Date() },
  { id: '2', name: 'Sci-Fi', color: '#3B82F6', categoryId: '1', createdAt: new Date(), updatedAt: new Date() },
  { id: '3', name: 'Medieval', color: '#A855F7', categoryId: '2', createdAt: new Date(), updatedAt: new Date() },
  { id: '4', name: 'Modern', color: '#10B981', categoryId: '2', createdAt: new Date(), updatedAt: new Date() },
  { id: '5', name: 'Warrior', color: '#EF4444', categoryId: '3', createdAt: new Date(), updatedAt: new Date() },
  { id: '6', name: 'Mage', color: '#F59E0B', categoryId: '3', createdAt: new Date(), updatedAt: new Date() },
];

const mockCategories: Category[] = [
  { 
    id: '1', 
    name: 'Genre', 
    color: '#6B7280', 
    description: 'Character genre categories',
    createdAt: new Date(), 
    updatedAt: new Date() 
  },
  { 
    id: '2', 
    name: 'Time Period', 
    color: '#9CA3AF', 
    description: 'Historical and temporal settings',
    createdAt: new Date(), 
    updatedAt: new Date() 
  },
  { 
    id: '3', 
    name: 'Class', 
    color: '#4B5563', 
    description: 'Character classes and roles',
    createdAt: new Date(), 
    updatedAt: new Date() 
  },
];

export interface UseTagsReturn {
  // Data
  tags: Tag[];
  categories: Category[];
  
  // Loading states
  isLoading: boolean;
  error: string | null;
  
  // Tag operations
  createTag: (tagData: TagFormData) => Promise<Tag>;
  updateTag: (id: string, tagData: Partial<TagFormData>) => Promise<Tag>;
  deleteTag: (id: string) => Promise<void>;
  
  // Category operations
  createCategory: (categoryData: CategoryFormData) => Promise<Category>;
  updateCategory: (id: string, categoryData: Partial<CategoryFormData>) => Promise<Category>;
  deleteCategory: (id: string) => Promise<void>;
  
  // Utility functions
  getTagsByCategory: (categoryId: string) => Tag[];
  getCategoryChildren: (categoryId: string) => Category[];
  searchTags: (query: string) => Tag[];
  searchCategories: (query: string) => Category[];
  
  // Validation
  validateTagName: (name: string) => boolean;
  validateCategoryName: (name: string) => boolean;
}

export const useTags = (): UseTagsReturn => {
  const [tags, setTags] = useState<Tag[]>(mockTags);
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // In the future, replace with actual API calls:
        // const [tagsResponse, categoriesResponse] = await Promise.all([
        //   fetch('/api/tags'),
        //   fetch('/api/categories')
        // ]);
        // setTags(await tagsResponse.json());
        // setCategories(await categoriesResponse.json());
        
        // For now, using mock data
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tags and categories');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Tag operations
  const createTag = useCallback(async (tagData: TagFormData): Promise<Tag> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Mock implementation - replace with API call
      const newTag: Tag = {
        id: Date.now().toString(),
        ...tagData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      setTags(prev => [...prev, newTag]);
      return newTag;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create tag';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateTag = useCallback(async (id: string, tagData: Partial<TagFormData>): Promise<Tag> => {
    setIsLoading(true);
    setError(null);
    
    try {
      setTags(prev => prev.map(tag => 
        tag.id === id 
          ? { ...tag, ...tagData, updatedAt: new Date() }
          : tag
      ));
      
      const updatedTag = tags.find(tag => tag.id === id);
      if (!updatedTag) {
        throw new Error('Tag not found');
      }
      
      return { ...updatedTag, ...tagData, updatedAt: new Date() };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update tag';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tags]);

  const deleteTag = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      setTags(prev => prev.filter(tag => tag.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete tag';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Category operations
  const createCategory = useCallback(async (categoryData: CategoryFormData): Promise<Category> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const newCategory: Category = {
        id: Date.now().toString(),
        ...categoryData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      setCategories(prev => [...prev, newCategory]);
      return newCategory;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create category';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateCategory = useCallback(async (id: string, categoryData: Partial<CategoryFormData>): Promise<Category> => {
    setIsLoading(true);
    setError(null);
    
    try {
      setCategories(prev => prev.map(category => 
        category.id === id 
          ? { ...category, ...categoryData, updatedAt: new Date() }
          : category
      ));
      
      const updatedCategory = categories.find(category => category.id === id);
      if (!updatedCategory) {
        throw new Error('Category not found');
      }
      
      return { ...updatedCategory, ...categoryData, updatedAt: new Date() };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update category';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [categories]);

  const deleteCategory = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Check if category has tags - prevent deletion if it does
      const hasChildTags = tags.some(tag => tag.categoryId === id);
      if (hasChildTags) {
        throw new Error('Cannot delete category that contains tags. Remove tags first.');
      }
      
      setCategories(prev => prev.filter(category => category.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete category';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [tags]);

  // Utility functions
  const getTagsByCategory = useCallback((categoryId: string): Tag[] => {
    return tags.filter(tag => tag.categoryId === categoryId);
  }, [tags]);

  const getCategoryChildren = useCallback((categoryId: string): Category[] => {
    return categories.filter(category => category.parentId === categoryId);
  }, [categories]);

  const searchTags = useCallback((query: string): Tag[] => {
    if (!query.trim()) return tags;
    
    const lowercaseQuery = query.toLowerCase();
    return tags.filter(tag => 
      tag.name.toLowerCase().includes(lowercaseQuery)
    );
  }, [tags]);

  const searchCategories = useCallback((query: string): Category[] => {
    if (!query.trim()) return categories;
    
    const lowercaseQuery = query.toLowerCase();
    return categories.filter(category => 
      category.name.toLowerCase().includes(lowercaseQuery) ||
      category.description?.toLowerCase().includes(lowercaseQuery)
    );
  }, [categories]);

  // Validation functions
  const validateTagName = useCallback((name: string): boolean => {
    if (!name.trim() || name.length < 2 || name.length > 50) {
      return false;
    }
    
    // Check for duplicates
    return !tags.some(tag => tag.name.toLowerCase() === name.toLowerCase());
  }, [tags]);

  const validateCategoryName = useCallback((name: string): boolean => {
    if (!name.trim() || name.length < 2 || name.length > 50) {
      return false;
    }
    
    // Check for duplicates
    return !categories.some(category => category.name.toLowerCase() === name.toLowerCase());
  }, [categories]);

  return {
    tags,
    categories,
    isLoading,
    error,
    createTag,
    updateTag,
    deleteTag,
    createCategory,
    updateCategory,
    deleteCategory,
    getTagsByCategory,
    getCategoryChildren,
    searchTags,
    searchCategories,
    validateTagName,
    validateCategoryName,
  };
};