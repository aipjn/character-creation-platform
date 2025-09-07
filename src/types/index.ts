// Shared type definitions for the character creation platform

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: CharacterMetadata;
}

export interface CharacterMetadata {
  style?: string;
  tags?: Tag[];
  categories?: Category[];
  isPublic: boolean;
  version: number;
}

// Tag and Category management types
export interface Tag {
  id: string;
  name: string;
  color?: string;
  categoryId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  children?: Category[];
  color?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagFormData {
  name: string;
  color?: string;
  categoryId?: string;
}

export interface CategoryFormData {
  name: string;
  parentId?: string;
  color?: string;
  description?: string;
}

export interface TagCloud {
  tags: Tag[];
  categories: Category[];
  selectedTags: string[];
  selectedCategories: string[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

export interface S3Config {
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface AppConfig {
  port: number;
  nodeEnv: string;
  database: DatabaseConfig;
  s3: S3Config;
  jwtSecret: string;
}

// Generation-related types
export type StyleType = 'cartoon' | 'realistic';

export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface GenerationRequest {
  id?: string;
  prompt: string;
  style: StyleType;
  batchSize: number;
  userId: string;
}

export interface Generation {
  id: string;
  prompt: string;
  style: StyleType;
  status: GenerationStatus;
  imageUrls: string[];
  errorMessage?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface GenerationState {
  generations: Generation[];
  currentRequest?: GenerationRequest;
  isLoading: boolean;
  error?: string;
}

// Form validation types
export interface ValidationError {
  field: string;
  message: string;
}

export interface FormState {
  isValid: boolean;
  errors: ValidationError[];
  touched: Record<string, boolean>;
}

// Batch Generation Types
export interface BatchGenerationRequest {
  prompt: string;
  styleType: StyleType;
  variations: number; // 1-4
  imageFile?: File;
}

export interface GenerationVariation {
  id: string;
  imageUrl?: string;
  status: GenerationStatus;
  error?: string;
  progress?: number;
}

export interface BatchGenerationResult {
  id: string;
  request: BatchGenerationRequest;
  variations: GenerationVariation[];
  status: GenerationStatus;
  createdAt: Date;
  completedAt?: Date;
}

