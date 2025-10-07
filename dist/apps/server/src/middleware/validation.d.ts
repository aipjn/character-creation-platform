import { Request, Response, NextFunction } from 'express';
import { CreateUserInput, UpdateUserInput } from '../schemas/userSchema';
import { CreateCharacterInput, UpdateCharacterInput } from '../schemas/characterSchema';
export interface ValidatedRequest<T = any> extends Request {
    validatedData?: T;
}
export declare class ValidationError extends Error {
    statusCode: number;
    errors: string[];
    constructor(errors: string[]);
}
export declare function createValidationMiddleware<T>(validator: (data: any) => {
    isValid: boolean;
    errors: string[];
}, sanitizer?: (data: any) => T): (req: ValidatedRequest<T>, res: Response, next: NextFunction) => void;
export declare const validateCreateUser: (req: ValidatedRequest<CreateUserInput>, res: Response, next: NextFunction) => void;
export declare const validateUpdateUser: (req: ValidatedRequest<UpdateUserInput>, res: Response, next: NextFunction) => void;
export declare const validateCreateCharacter: (req: ValidatedRequest<CreateCharacterInput>, res: Response, next: NextFunction) => void;
export declare const validateUpdateCharacter: (req: ValidatedRequest<UpdateCharacterInput>, res: Response, next: NextFunction) => void;
export declare function validateQueryParams(validator: (params: any) => {
    isValid: boolean;
    errors: string[];
}): (req: Request, res: Response, next: NextFunction) => void;
export declare function validatePathParams(validator: (params: any) => {
    isValid: boolean;
    errors: string[];
}): (req: Request, res: Response, next: NextFunction) => void;
export declare const PathValidators: {
    validateId: (params: {
        id: string;
    }) => {
        isValid: boolean;
        errors: string[];
    };
    validateUserId: (params: {
        userId: string;
    }) => {
        isValid: boolean;
        errors: string[];
    };
    validateCharacterId: (params: {
        characterId: string;
    }) => {
        isValid: boolean;
        errors: string[];
    };
};
export declare const QueryValidators: {
    validatePagination: (query: any) => {
        isValid: boolean;
        errors: string[];
    };
    validateSearch: (query: any) => {
        isValid: boolean;
        errors: string[];
    };
    validateCharacterFilters: (query: any) => {
        isValid: boolean;
        errors: string[];
    };
};
export declare function validateFileUpload(options: {
    allowedTypes?: string[];
    maxSize?: number;
    required?: boolean;
}): (req: Request, res: Response, next: NextFunction) => void;
export declare function validateContentType(expectedTypes: string[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map