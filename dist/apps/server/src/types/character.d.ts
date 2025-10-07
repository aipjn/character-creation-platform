import { SubscriptionTier } from '@prisma/client';
import { StyleType, GenerationStatus } from '../../../../shared/types/enums';
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
export interface CharacterCreateFormData {
    name?: string;
    prompt: string;
    styleType: StyleType;
    imageUrl?: string;
    referenceImageUrl?: string;
    tags: string[];
    isPublic: boolean;
    age?: string;
    gender?: string;
    occupation?: string;
    personality: string[];
    physicalTraits?: PhysicalTraits;
    clothing?: string;
    background?: string;
}
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
export interface CharacterActions {
    onView?: (character: CharacterDisplayData) => void;
    onEdit?: (character: CharacterDisplayData) => void;
    onDelete?: (character: CharacterDisplayData) => void;
    onDownload?: (character: CharacterDisplayData) => void;
    onShare?: (character: CharacterDisplayData) => void;
    onTagUpdate?: (characterId: string, tags: string[]) => void;
    onVisibilityToggle?: (characterId: string, isPublic: boolean) => void;
}
export interface CharacterStats {
    total: number;
    byStyle: Record<StyleType, number>;
    byStatus: Record<GenerationStatus, number>;
    recentlyCreated: number;
    publicCount: number;
    privateCount: number;
}
export interface CharacterUser {
    id: string;
    email?: string;
    name?: string;
    subscriptionTier: SubscriptionTier;
    dailyQuota: number;
    dailyUsed: number;
    totalGenerated: number;
}
//# sourceMappingURL=character.d.ts.map