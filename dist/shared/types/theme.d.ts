export interface CharacterTheme {
    id: string;
    characterId: string;
    name: string;
    description?: string;
    coverImageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CharacterVariant {
    id: string;
    themeId: string;
    prompt: string;
    imageUrl: string;
    thumbnailUrl?: string;
    metadata?: {
        clothing?: string;
        pose?: string;
        expression?: string;
        setting?: string;
        [key: string]: any;
    };
    createdAt: Date;
}
export interface ThemeWithVariants extends CharacterTheme {
    variants: CharacterVariant[];
}
export interface CharacterWithThemes {
    id: string;
    name: string;
    description?: string;
    imageUrl: string;
    themes: ThemeWithVariants[];
}
export interface CreateThemeRequest {
    characterId: string;
    name: string;
    description?: string;
}
export interface CreateThemeResponse {
    success: boolean;
    data?: CharacterTheme;
    error?: string;
}
export interface CreateVariantRequest {
    themeId: string;
    prompt: string;
    metadata?: {
        clothing?: string;
        pose?: string;
        expression?: string;
        setting?: string;
    };
}
export interface CreateVariantResponse {
    success: boolean;
    data?: CharacterVariant;
    error?: string;
}
export interface GetThemesRequest {
    characterId: string;
}
export interface GetThemesResponse {
    success: boolean;
    data?: ThemeWithVariants[];
    error?: string;
}
export interface GetVariantsRequest {
    themeId: string;
}
export interface GetVariantsResponse {
    success: boolean;
    data?: CharacterVariant[];
    error?: string;
}
export interface ThemeCardData {
    id: string;
    name: string;
    description?: string;
    coverImageUrl?: string;
    variantCount: number;
    previewImages: string[];
}
export interface VariantCardData {
    id: string;
    imageUrl: string;
    thumbnailUrl?: string;
    prompt: string;
    metadata?: Record<string, any>;
    createdAt: Date;
}
//# sourceMappingURL=theme.d.ts.map