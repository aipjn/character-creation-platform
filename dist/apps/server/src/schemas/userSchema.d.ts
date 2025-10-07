import { SubscriptionTier } from '@prisma/client';
export interface UserValidationResult {
    isValid: boolean;
    errors: string[];
}
export interface CreateUserInput {
    email: string;
    auth0Id?: string;
    name?: string;
    avatar?: string;
    subscriptionTier?: SubscriptionTier;
}
export interface UpdateUserInput {
    name?: string;
    avatar?: string;
    subscriptionTier?: SubscriptionTier;
}
export declare class UserSchema {
    static validateEmail(email: string): UserValidationResult;
    static validateName(name: string | undefined): UserValidationResult;
    static validateAuth0Id(auth0Id: string | undefined): UserValidationResult;
    static validateAvatar(avatar: string | undefined): UserValidationResult;
    static validateSubscriptionTier(tier: SubscriptionTier | undefined): UserValidationResult;
    static validateCreateInput(input: CreateUserInput): UserValidationResult;
    static validateUpdateInput(input: UpdateUserInput): UserValidationResult;
    static sanitizeCreateInput(input: CreateUserInput): CreateUserInput;
    static sanitizeUpdateInput(input: UpdateUserInput): UpdateUserInput;
}
//# sourceMappingURL=userSchema.d.ts.map