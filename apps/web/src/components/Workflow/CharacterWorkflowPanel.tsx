import React, { useState, useCallback } from 'react';
import { Character } from '../../types/character';
import { CharacterCollection, Scene } from '../../types/collections';

export interface WorkflowSuggestions {
  suggestedCollections: Array<{
    id: string;
    name: string;
    characterCount: number;
  }>;
  suggestedScenes: Array<{
    id: string;
    name: string;
    environment?: string;
    characterCount: number;
  }>;
  similarCharacters: Character[];
}

export interface CharacterWorkflowPanelProps {
  character: Character;
  suggestions?: WorkflowSuggestions;
  userCollections?: CharacterCollection[];
  userScenes?: Scene[];
  onAddToLibrary?: (characterId: string) => void;
  onRemoveFromLibrary?: (characterId: string) => void;
  onToggleFavorite?: (characterId: string) => void;
  onAddToCollection?: (characterId: string, collectionId: string) => void;
  onCreateCollection?: (name: string, characterIds: string[]) => void;
  onAddToScene?: (characterId: string, sceneId: string) => void;
  onCreateScene?: (name: string, characterIds: string[]) => void;
  onViewSimilar?: (characterId: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

type WorkflowStep = 'actions' | 'collections' | 'scenes' | 'similar';

export const CharacterWorkflowPanel: React.FC<CharacterWorkflowPanelProps> = ({
  character,
  suggestions,
  userCollections,
  userScenes,
  onAddToLibrary,
  onRemoveFromLibrary,
  onToggleFavorite,
  onAddToCollection,
  onCreateCollection,
  onAddToScene,
  onCreateScene,
  onViewSimilar,
  isLoading = false,
  disabled = false,
  'data-testid': testId = 'character-workflow-panel',
}) => {
  const [activeStep, setActiveStep] = useState<WorkflowStep>('actions');
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [showNewSceneForm, setShowNewSceneForm] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newSceneName, setNewSceneName] = useState('');

  const isInLibrary = character.isInLibrary;
  const isFavorite = character.isFavorite;

  const handleAddToLibrary = useCallback(() => {
    if (onAddToLibrary && !isInLibrary) {
      onAddToLibrary(character.id);
    }
  }, [onAddToLibrary, character.id, isInLibrary]);

  const handleRemoveFromLibrary = useCallback(() => {
    if (onRemoveFromLibrary && isInLibrary) {
      onRemoveFromLibrary(character.id);
    }
  }, [onRemoveFromLibrary, character.id, isInLibrary]);

  const handleToggleFavorite = useCallback(() => {
    if (onToggleFavorite) {
      onToggleFavorite(character.id);
    }
  }, [onToggleFavorite, character.id]);

  const handleCreateCollection = useCallback(() => {
    if (onCreateCollection && newCollectionName.trim()) {
      onCreateCollection(newCollectionName.trim(), [character.id]);
      setNewCollectionName('');
      setShowNewCollectionForm(false);
    }
  }, [onCreateCollection, character.id, newCollectionName]);

  const handleCreateScene = useCallback(() => {
    if (onCreateScene && newSceneName.trim()) {
      onCreateScene(newSceneName.trim(), [character.id]);
      setNewSceneName('');
      setShowNewSceneForm(false);
    }
  }, [onCreateScene, character.id, newSceneName]);

  const ActionButton = ({ 
    onClick, 
    children, 
    variant = 'primary', 
    size = 'medium',
    disabled: buttonDisabled = false
  }: {
    onClick: () => void;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'success' | 'warning';
    size?: 'small' | 'medium' | 'large';
    disabled?: boolean;
  }) => {
    const colors = {
      primary: { bg: '#3b82f6', hover: '#2563eb', text: 'white' },
      secondary: { bg: '#6b7280', hover: '#4b5563', text: 'white' },
      success: { bg: '#10b981', hover: '#059669', text: 'white' },
      warning: { bg: '#f59e0b', hover: '#d97706', text: 'white' },
    };

    const sizes = {
      small: { padding: '6px 12px', fontSize: '12px' },
      medium: { padding: '8px 16px', fontSize: '14px' },
      large: { padding: '12px 24px', fontSize: '16px' },
    };

    const isDisabled = disabled || buttonDisabled || isLoading;
    const color = colors[variant];
    const sizeStyle = sizes[size];

    return (
      <button
        onClick={onClick}
        disabled={isDisabled}
        style={{
          ...sizeStyle,
          backgroundColor: isDisabled ? '#9ca3af' : color.bg,
          color: color.text,
          border: 'none',
          borderRadius: '6px',
          fontWeight: '500',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s ease',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.backgroundColor = color.hover;
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled) {
            e.currentTarget.style.backgroundColor = color.bg;
          }
        }}
      >
        {children}
      </button>
    );
  };

  const StepButton = ({ step, label, count }: { step: WorkflowStep; label: string; count?: number }) => (
    <button
      onClick={() => setActiveStep(step)}
      disabled={disabled}
      style={{
        padding: '12px 16px',
        border: activeStep === step ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: activeStep === step ? '#eff6ff' : 'white',
        color: activeStep === step ? '#1d4ed8' : '#374151',
        fontSize: '14px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flex: 1,
        justifyContent: 'center',
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span style={{
          backgroundColor: activeStep === step ? '#3b82f6' : '#9ca3af',
          color: 'white',
          borderRadius: '12px',
          padding: '2px 6px',
          fontSize: '10px',
          fontWeight: '600',
          minWidth: '18px',
          textAlign: 'center'
        }}>
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div 
      className="character-workflow-panel" 
      data-testid={testId}
      style={{
        maxWidth: '600px',
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#f8fafc'
      }}>
        <h3 style={{
          fontSize: '18px',
          fontWeight: '600',
          color: '#111827',
          margin: '0 0 8px 0'
        }}>
          What's Next for {character.name || 'Your Character'}?
        </h3>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: 0
        }}>
          Organize your character into collections, add to scenes, or explore similar characters.
        </p>
      </div>

      {/* Step Navigation */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: 'white'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          <StepButton step="actions" label="Library" />
          <StepButton 
            step="collections" 
            label="Collections" 
            count={suggestions?.suggestedCollections.length || userCollections?.length || 0}
          />
          <StepButton 
            step="scenes" 
            label="Scenes" 
            count={suggestions?.suggestedScenes.length || userScenes?.length || 0}
          />
          <StepButton 
            step="similar" 
            label="Similar" 
            count={suggestions?.similarCharacters.length || 0}
          />
        </div>
      </div>

      {/* Step Content */}
      <div style={{ padding: '20px', minHeight: '200px' }}>
        {activeStep === 'actions' && (
          <div className="actions-step">
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px'
              }}>
                <div>
                  <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
                    Character Library
                  </h4>
                  <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                    {isInLibrary ? 'This character is in your library' : 'Add to your personal collection'}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <ActionButton
                    onClick={handleToggleFavorite}
                    variant={isFavorite ? 'warning' : 'secondary'}
                    size="small"
                  >
                    {isFavorite ? '★ Favorited' : '☆ Favorite'}
                  </ActionButton>
                  {isInLibrary ? (
                    <ActionButton
                      onClick={handleRemoveFromLibrary}
                      variant="secondary"
                      size="small"
                    >
                      Remove from Library
                    </ActionButton>
                  ) : (
                    <ActionButton
                      onClick={handleAddToLibrary}
                      variant="success"
                      size="small"
                    >
                      Add to Library
                    </ActionButton>
                  )}
                </div>
              </div>

              <div style={{
                padding: '16px',
                border: '1px solid #e5e7eb',
                borderRadius: '8px'
              }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0' }}>
                  Character Summary
                </h4>
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.4' }}>
                  <div><strong>Style:</strong> {character.styleType}</div>
                  {character.age && <div><strong>Age:</strong> {character.age}</div>}
                  {character.gender && <div><strong>Gender:</strong> {character.gender}</div>}
                  {character.occupation && <div><strong>Occupation:</strong> {character.occupation}</div>}
                  {character.personality && character.personality.length > 0 && (
                    <div><strong>Personality:</strong> {character.personality.join(', ')}</div>
                  )}
                  {character.tags.length > 0 && (
                    <div><strong>Tags:</strong> {character.tags.join(', ')}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeStep === 'collections' && (
          <div className="collections-step">
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Add to Collection
              </h4>
              <ActionButton
                onClick={() => setShowNewCollectionForm(!showNewCollectionForm)}
                variant="primary"
                size="small"
              >
                + New Collection
              </ActionButton>
            </div>

            {showNewCollectionForm && (
              <div style={{
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <input
                  type="text"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  placeholder="Collection name..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <ActionButton onClick={handleCreateCollection} variant="success" size="small">
                    Create
                  </ActionButton>
                  <ActionButton 
                    onClick={() => setShowNewCollectionForm(false)} 
                    variant="secondary" 
                    size="small"
                  >
                    Cancel
                  </ActionButton>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {suggestions?.suggestedCollections.map(collection => (
                <div
                  key={collection.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: 'white'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                      {collection.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {collection.characterCount} characters
                    </div>
                  </div>
                  <ActionButton
                    onClick={() => onAddToCollection?.(character.id, collection.id)}
                    variant="primary"
                    size="small"
                  >
                    Add
                  </ActionButton>
                </div>
              )) || (
                <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '20px' }}>
                  No collections available. Create your first collection above!
                </div>
              )}
            </div>
          </div>
        )}

        {activeStep === 'scenes' && (
          <div className="scenes-step">
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: 0 }}>
                Add to Scene
              </h4>
              <ActionButton
                onClick={() => setShowNewSceneForm(!showNewSceneForm)}
                variant="primary"
                size="small"
              >
                + New Scene
              </ActionButton>
            </div>

            {showNewSceneForm && (
              <div style={{
                padding: '16px',
                backgroundColor: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <input
                  type="text"
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  placeholder="Scene name..."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    marginBottom: '8px'
                  }}
                />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <ActionButton onClick={handleCreateScene} variant="success" size="small">
                    Create
                  </ActionButton>
                  <ActionButton 
                    onClick={() => setShowNewSceneForm(false)} 
                    variant="secondary" 
                    size="small"
                  >
                    Cancel
                  </ActionButton>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {suggestions?.suggestedScenes.map(scene => (
                <div
                  key={scene.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    backgroundColor: 'white'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                      {scene.name}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6b7280' }}>
                      {scene.environment && `${scene.environment} • `}
                      {scene.characterCount} characters
                    </div>
                  </div>
                  <ActionButton
                    onClick={() => onAddToScene?.(character.id, scene.id)}
                    variant="primary"
                    size="small"
                  >
                    Add
                  </ActionButton>
                </div>
              )) || (
                <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '20px' }}>
                  No scenes available. Create your first scene above!
                </div>
              )}
            </div>
          </div>
        )}

        {activeStep === 'similar' && (
          <div className="similar-step">
            <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 16px 0' }}>
              Similar Characters
            </h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
              {suggestions?.similarCharacters.map(similarChar => (
                <div
                  key={similarChar.id}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: 'white',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px -1px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => onViewSimilar?.(similarChar.id)}
                >
                  {similarChar.thumbnailUrl && (
                    <div style={{
                      width: '100%',
                      height: '120px',
                      backgroundImage: `url(${similarChar.thumbnailUrl})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }} />
                  )}
                  <div style={{ padding: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '500', color: '#111827', marginBottom: '2px' }}>
                      {similarChar.name || 'Untitled'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280' }}>
                      {similarChar.styleType}
                    </div>
                  </div>
                </div>
              )) || (
                <div style={{ 
                  gridColumn: '1 / -1', 
                  textAlign: 'center', 
                  color: '#6b7280', 
                  fontSize: '14px', 
                  padding: '20px' 
                }}>
                  No similar characters found. Generate more characters to see suggestions!
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterWorkflowPanel;