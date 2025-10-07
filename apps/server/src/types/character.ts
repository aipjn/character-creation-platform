// Character-specific types for gallery display and management
import { SubscriptionTier } from '@prisma/client';
import { StyleType, GenerationStatus } from '../../../../shared/types/enums';

// Physical traits structure
export interface PhysicalTraits {
  height?: string;
  build?: string;
  hairColor?: string;
  hairStyle?: string;
  eyeColor?: string;
  skinTone?: string;
  facialFeatures?: string[];
  distinguishingMarks?: string[];
}

// Main Character interface based on Prisma model with comprehensive attributes
export interface Character {
  id: string;
  userId: string;
  name?: string;
  prompt: string;
  styleType: StyleType;
  imageUrl?: string;
  thumbnailUrl?: string;
  referenceImageUrl?: string;
  metadata?: Record<string, any>;
  tags: string[];
  isPublic: boolean;
  isFavorite: boolean;
  isInLibrary: boolean;
  generationStatus: GenerationStatus;
  
  // Comprehensive Character Attributes
  age?: string;
  gender?: string;
  occupation?: string;
  personality?: string[];
  physicalTraits?: PhysicalTraits;
  clothing?: string;
  background?: string;
  
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
  referenceImageUrl?: string;
  tags: string[];
  isPublic: boolean;
  isFavorite: boolean;
  isInLibrary: boolean;
  status: GenerationStatus;
  
  // Comprehensive attributes for display
  age?: string;
  gender?: string;
  occupation?: string;
  personality?: string[];
  physicalTraits?: PhysicalTraits;
  clothing?: string;
  background?: string;
  
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

// Character creation form data
export interface CharacterCreateFormData {
  name?: string;
  prompt: string;
  styleType: StyleType;
  imageUrl?: string;
  referenceImageUrl?: string;
  tags: string[];
  isPublic: boolean;
  
  // Comprehensive character attributes
  age?: string;
  gender?: string;
  occupation?: string;
  personality: string[];
  physicalTraits?: PhysicalTraits;
  clothing?: string;
  background?: string;
}

// Character attribute suggestions and presets
export interface CharacterAttributePresets {
  ages: string[];
  genders: string[];
  occupations: string[];
  personalityTraits: string[];
  physicalOptions: {
    heights: string[];
    builds: string[];
    hairColors: string[];
    hairStyles: string[];
    eyeColors: string[];
    skinTones: string[];
  };
  clothingStyles: string[];
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
