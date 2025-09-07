// Character-specific types for gallery display and management
import { StyleType, GenerationStatus, SubscriptionTier } from '@prisma/client';

// Main Character interface based on Prisma model
export interface Character {
  id: string;
  userId: string;
  name?: string;
  prompt: string;
  styleType: StyleType;
  s3Url?: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
  tags: string[];
  isPublic: boolean;
  generationStatus: GenerationStatus;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    email?: string;
    name?: string;
  };
}

// Character display data for gallery components
export interface CharacterDisplayData {
  id: string;
  name?: string;
  prompt: string;
  styleType: StyleType;
  imageUrl?: string;
  thumbnailUrl?: string;
  tags: string[];
  isPublic: boolean;
  status: GenerationStatus;
  createdAt: Date;
  author?: {
    id: string;
    name?: string;
  };
  metadata?: {
    width?: number;
    height?: number;
    fileSize?: number;
    format?: string;
  };
}

// Character filtering and sorting options
export interface CharacterFilters {
  styleType?: StyleType;
  tags?: string[];
  status?: GenerationStatus;
  isPublic?: boolean;
  search?: string;
  userId?: string;
  dateRange?: {
    from: Date;
    to: Date;
  };
}

export interface CharacterSortOptions {
  field: 'createdAt' | 'updatedAt' | 'name' | 'styleType';
  direction: 'asc' | 'desc';
}

// Character actions and operations
export interface CharacterActions {
  onView?: (character: CharacterDisplayData) => void;
  onEdit?: (character: CharacterDisplayData) => void;
  onDelete?: (character: CharacterDisplayData) => void;
  onDownload?: (character: CharacterDisplayData) => void;
  onShare?: (character: CharacterDisplayData) => void;
  onTagUpdate?: (characterId: string, tags: string[]) => void;
  onVisibilityToggle?: (characterId: string, isPublic: boolean) => void;
}

// Character metadata and stats
export interface CharacterStats {
  total: number;
  byStyle: Record<StyleType, number>;
  byStatus: Record<GenerationStatus, number>;
  recentlyCreated: number;
  publicCount: number;
  privateCount: number;
}

// User context for character operations
export interface CharacterUser {
  id: string;
  email?: string;
  name?: string;
  subscriptionTier: SubscriptionTier;
  dailyQuota: number;
  dailyUsed: number;
  totalGenerated: number;
}