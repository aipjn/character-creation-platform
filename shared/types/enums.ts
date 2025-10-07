export const STYLE_TYPE = {
  FANTASY: 'FANTASY',
  CYBERPUNK: 'CYBERPUNK',
  ANIME: 'ANIME',
  VINTAGE: 'VINTAGE',
  REALISTIC: 'REALISTIC',
  CARTOON: 'CARTOON',
  MINIMALIST: 'MINIMALIST'
} as const;

export type StyleType = (typeof STYLE_TYPE)[keyof typeof STYLE_TYPE];

export const STYLE_TYPES: readonly StyleType[] = Object.values(STYLE_TYPE);

export const GENERATION_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
} as const;

export type GenerationStatus = (typeof GENERATION_STATUS)[keyof typeof GENERATION_STATUS];

export const GENERATION_STATUSES: readonly GenerationStatus[] = Object.values(GENERATION_STATUS);
