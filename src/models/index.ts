// Export all models
export { UserModel, default as User } from './User';
export { CharacterModel, default as Character } from './Character';
export { CharacterTemplateModel, default as CharacterTemplate } from './CharacterTemplate';
export { GenerationModel, default as Generation } from './Generation';

// Re-export Prisma types for convenience
export type {
  User,
  Character,
  Generation,
  CharacterTemplate,
  SubscriptionTier,
  StyleType,
  GenerationStatus,
  Prisma
} from '@prisma/client';

// Export custom types
export type {
  UserCreateData,
  UserUpdateData,
  CharacterCreateData,
  CharacterUpdateData,
  CharacterTemplateCreateData,
  CharacterTemplateUpdateData,
  ModelValidationResult,
  UserConstraints,
  CharacterConstraints,
  TemplateConstraints,
  SearchOptions,
  UserWithCharacters,
  CharacterWithUser,
  UserStats,
  CharacterStats,
  TemplateStats,
  PaginatedResult
} from '../types/models';

// Database utilities
export { 
  getPrismaClient, 
  getPgPool, 
  checkDatabaseConnection, 
  connectWithRetry, 
  disconnectDatabase 
} from '../config/database';