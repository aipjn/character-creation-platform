// Character collection and scene types
import { Character } from './character';

// Character Collection interfaces
export interface CharacterCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  coverImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name?: string;
  };
  items?: CharacterCollectionItem[];
}

export interface CharacterCollectionItem {
  id: string;
  collectionId: string;
  characterId: string;
  addedAt: Date;
  collection?: CharacterCollection;
  character?: Character;
}

// Collection creation and management
export interface CreateCollectionData {
  name: string;
  description?: string;
  isPublic?: boolean;
  coverImageUrl?: string;
}

export interface UpdateCollectionData {
  name?: string;
  description?: string;
  isPublic?: boolean;
  coverImageUrl?: string;
}

export interface CollectionDisplayData {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  coverImageUrl?: string;
  characterCount: number;
  author?: {
    id: string;
    name?: string;
  };
  createdAt: Date;
  previewCharacters: Character[];
}

// Scene interfaces
export interface Scene {
  id: string;
  userId: string;
  name: string;
  description?: string;
  environment?: string;
  setting?: string;
  mood?: string;
  lighting?: string;
  thumbnailUrl?: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name?: string;
  };
  characters?: SceneCharacter[];
  generations?: SceneGeneration[];
}

export interface SceneCharacter {
  id: string;
  sceneId: string;
  characterId: string;
  pose?: string;
  expression?: string;
  action?: string;
  position?: {
    x: number;
    y: number;
    scale?: number;
    rotation?: number;
  };
  addedAt: Date;
  scene?: Scene;
  character?: Character;
}

export interface SceneGeneration {
  id: string;
  userId: string;
  sceneId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  prompt: string;
  errorMessage?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name?: string;
  };
  scene?: Scene;
}

// Scene creation and management
export interface CreateSceneData {
  name: string;
  description?: string;
  environment?: string;
  setting?: string;
  mood?: string;
  lighting?: string;
  isPublic?: boolean;
}

export interface UpdateSceneData {
  name?: string;
  description?: string;
  environment?: string;
  setting?: string;
  mood?: string;
  lighting?: string;
  isPublic?: boolean;
}

export interface AddCharacterToSceneData {
  characterId: string;
  pose?: string;
  expression?: string;
  action?: string;
  position?: {
    x: number;
    y: number;
    scale?: number;
    rotation?: number;
  };
}

// Scene attribute presets
export interface SceneAttributePresets {
  environments: string[];
  settings: string[];
  moods: string[];
  lightings: string[];
  poses: string[];
  expressions: string[];
  actions: string[];
}

// Display and UI types
export interface SceneDisplayData {
  id: string;
  name: string;
  description?: string;
  environment?: string;
  setting?: string;
  mood?: string;
  lighting?: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  isPublic: boolean;
  characterCount: number;
  author?: {
    id: string;
    name?: string;
  };
  createdAt: Date;
  previewCharacters: Character[];
}

// Workflow types for character → library → scene flow
export interface CharacterWorkflowState {
  step: 'create' | 'library' | 'scene' | 'complete';
  character?: Character;
  collection?: CharacterCollection;
  scene?: Scene;
}

export interface LibraryActions {
  onAddToLibrary?: (characterId: string) => void;
  onRemoveFromLibrary?: (characterId: string) => void;
  onAddToCollection?: (characterId: string, collectionId: string) => void;
  onRemoveFromCollection?: (characterId: string, collectionId: string) => void;
  onCreateCollection?: (data: CreateCollectionData) => void;
  onViewCollection?: (collectionId: string) => void;
}

export interface SceneActions {
  onCreateScene?: (data: CreateSceneData) => void;
  onAddCharacterToScene?: (sceneId: string, data: AddCharacterToSceneData) => void;
  onRemoveCharacterFromScene?: (sceneId: string, characterId: string) => void;
  onGenerateScene?: (sceneId: string) => void;
  onViewScene?: (sceneId: string) => void;
}
