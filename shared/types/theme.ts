/**
 * Character Theme and Variant Types
 * 角色主题和变体数据类型定义
 */

// Character Theme - 角色主题（类似文件夹，包含多个变体）
export interface CharacterTheme {
  id: string;
  characterId: string;
  name: string;
  description?: string;
  coverImageUrl?: string;  // 封面图（可选，可使用第一个变体作为封面）
  createdAt: Date;
  updatedAt: Date;
}

// Character Variant - 角色变体（主题下的具体照片）
export interface CharacterVariant {
  id: string;
  themeId: string;
  prompt: string;  // 生成该变体的提示词
  imageUrl: string;  // 本地存储路径
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

// Theme with variants - 包含变体的主题
export interface ThemeWithVariants extends CharacterTheme {
  variants: CharacterVariant[];
}

// Character with themes - 包含主题的角色
export interface CharacterWithThemes {
  id: string;
  name: string;
  description?: string;
  imageUrl: string;
  themes: ThemeWithVariants[];
}

// API Request/Response types
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

// Display types for UI
export interface ThemeCardData {
  id: string;
  name: string;
  description?: string;
  coverImageUrl?: string;
  variantCount: number;
  previewImages: string[];  // 前3个变体的缩略图
}

export interface VariantCardData {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  prompt: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
