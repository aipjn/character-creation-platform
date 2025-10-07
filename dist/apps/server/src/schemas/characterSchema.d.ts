import { StyleType, GenerationStatus } from '../../../../shared/types/enums';
export interface CharacterValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface CreateCharacterInput {
    userId: string;
    name?: string;
    prompt: string;
    styleType?: StyleType;
    tags?: string[];
    isPublic?: boolean;
    metadata?: any;
    imageUrl?: string;
}
export interface UpdateCharacterInput {
    name?: string;
    prompt?: string;
    styleType?: StyleType;
    tags?: string[];
    isPublic?: boolean;
    metadata?: any;
    imageUrl?: string;
    thumbnailUrl?: string;
    generationStatus?: GenerationStatus;
}
export declare class CharacterSchema {
    static readonly MAX_NAME_LENGTH = 100;
    static readonly MAX_PROMPT_LENGTH = 2000;
    static readonly MAX_TAGS = 20;
    static readonly MAX_TAG_LENGTH = 50;
    static readonly MAX_URL_LENGTH = 2048;
    static validateName(name: string | undefined): CharacterValidationResult;
    static validatePrompt(prompt: string): CharacterValidationResult;
    static validateUserId(userId: string): CharacterValidationResult;
    static validateStyleType(styleType: StyleType | undefined): CharacterValidationResult;
    static validateGenerationStatus(status: GenerationStatus | undefined): CharacterValidationResult;
    static validateTags(tags: string[] | undefined): CharacterValidationResult;
    static validateUrl(url: string | undefined, fieldName: string): CharacterValidationResult;
    static validateBoolean(value: boolean | undefined, fieldName: string): CharacterValidationResult;
    static validateMetadata(metadata: any): CharacterValidationResult;
    static validateCreateInput(input: CreateCharacterInput): CharacterValidationResult;
    static validateUpdateInput(input: UpdateCharacterInput): CharacterValidationResult;
    static sanitizeCreateInput(input: CreateCharacterInput): CreateCharacterInput;
    static sanitizeUpdateInput(input: UpdateCharacterInput): UpdateCharacterInput;
}
//# sourceMappingURL=characterSchema.d.ts.map