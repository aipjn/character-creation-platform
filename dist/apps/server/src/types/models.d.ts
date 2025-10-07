export interface UserCreateData {
    email: string;
    auth0Id?: string;
    name?: string;
    avatar?: string;
}
export interface UserUpdateData {
    name?: string;
    avatar?: string;
    subscriptionTier?: 'FREE' | 'PREMIUM' | 'PRO';
}
export interface CharacterCreateData {
    userId: string;
    name?: string;
    prompt: string;
    styleType?: 'REALISTIC' | 'CARTOON' | 'ANIME' | 'FANTASY' | 'CYBERPUNK' | 'VINTAGE' | 'MINIMALIST';
    tags?: string[];
    isPublic?: boolean;
    metadata?: Record<string, any>;
    imageUrl?: string;
}
export interface CharacterUpdateData {
    name?: string;
    prompt?: string;
    styleType?: 'REALISTIC' | 'CARTOON' | 'ANIME' | 'FANTASY' | 'CYBERPUNK' | 'VINTAGE' | 'MINIMALIST';
    tags?: string[];
    isPublic?: boolean;
    metadata?: Record<string, any>;
    imageUrl?: string;
    thumbnailUrl?: string;
    generationStatus?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}
export interface CharacterTemplateCreateData {
    name: string;
    description?: string;
    prompt: string;
    styleType?: 'REALISTIC' | 'CARTOON' | 'ANIME' | 'FANTASY' | 'CYBERPUNK' | 'VINTAGE' | 'MINIMALIST';
    tags?: string[];
    isActive?: boolean;
}
export interface CharacterTemplateUpdateData {
    name?: string;
    description?: string;
    prompt?: string;
    styleType?: 'REALISTIC' | 'CARTOON' | 'ANIME' | 'FANTASY' | 'CYBERPUNK' | 'VINTAGE' | 'MINIMALIST';
    tags?: string[];
    isActive?: boolean;
}
export interface SearchOptions {
    skip?: number;
    take?: number;
    search?: string;
    tags?: string[];
    styleType?: 'REALISTIC' | 'CARTOON' | 'ANIME' | 'FANTASY' | 'CYBERPUNK' | 'VINTAGE' | 'MINIMALIST';
}
export interface UserWithCharacters {
    id: string;
    email: string;
    name: string | null;
    avatar: string | null;
    subscriptionTier: 'FREE' | 'PREMIUM' | 'PRO';
    dailyQuota: number;
    dailyUsed: number;
    totalGenerated: number;
    characters: Array<{
        id: string;
        name: string | null;
        prompt: string;
        styleType: string;
        imageUrl: string | null;
        thumbnailUrl: string | null;
        createdAt: Date;
    }>;
}
export interface CharacterWithUser {
    id: string;
    name: string | null;
    prompt: string;
    styleType: string;
    imageUrl: string | null;
    thumbnailUrl: string | null;
    tags: string[];
    isPublic: boolean;
    generationStatus: string;
    createdAt: Date;
    user: {
        id: string;
        name: string | null;
        email?: string;
    };
}
export interface ModelValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface UserStats {
    totalUsers: number;
    activeUsers: number;
    bySubscriptionTier: Record<string, number>;
    totalCharactersCreated: number;
    totalGenerationsRequested: number;
}
export interface CharacterStats {
    total: number;
    byStyle: Record<string, number>;
    byStatus: Record<string, number>;
    publicCharacters: number;
    totalTags: number;
}
export interface TemplateStats {
    total: number;
    active: number;
    byStyle: Record<string, number>;
    totalUsage: number;
    mostPopular: Array<{
        id: string;
        name: string;
        usageCount: number;
    }>;
}
export interface PaginatedResult<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
}
export interface UserConstraints {
    email: {
        maxLength: 255;
        required: true;
        pattern: RegExp;
    };
    name: {
        maxLength: 100;
        required: false;
    };
    avatar: {
        maxLength: 500;
        required: false;
        pattern: RegExp;
    };
}
export interface CharacterConstraints {
    name: {
        maxLength: 100;
        required: false;
    };
    prompt: {
        maxLength: 2000;
        required: true;
    };
    tags: {
        maxCount: 10;
        maxTagLength: 50;
        required: false;
    };
}
export interface TemplateConstraints {
    name: {
        maxLength: 100;
        required: true;
    };
    description: {
        maxLength: 500;
        required: false;
    };
    prompt: {
        maxLength: 2000;
        required: true;
    };
    tags: {
        maxCount: 20;
        maxTagLength: 50;
        required: false;
    };
}
//# sourceMappingURL=models.d.ts.map