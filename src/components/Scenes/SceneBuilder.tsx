import React, { useState, useCallback, useMemo } from 'react';
import { Character } from '../../types/character';
import { Scene, SceneCharacter, CreateSceneData, SceneAttributePresets } from '../../types/collections';

export interface SceneBuilderProps {
  availableCharacters: Character[];
  existingScene?: Scene;
  onSave?: (sceneData: CreateSceneData & { characters: SceneCharacterData[] }) => void;
  onCancel?: () => void;
  onGenerateScene?: (sceneId: string) => void;
  presets?: SceneAttributePresets;
  isLoading?: boolean;
  disabled?: boolean;
  'data-testid'?: string;
}

export interface SceneCharacterData {
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

const defaultPresets: SceneAttributePresets = {
  environments: [
    'Indoor', 'Outdoor', 'Fantasy Realm', 'Cyberpunk City', 'Medieval Castle',
    'Modern Office', 'Tavern', 'Forest', 'Desert', 'Beach', 'Mountain',
    'Space Station', 'Underground Cave', 'Royal Palace', 'Village Square'
  ],
  settings: [
    'Throne Room', 'Battlefield', 'Market Square', 'Library', 'Laboratory',
    'Garden', 'Dungeon', 'Temple', 'Workshop', 'Kitchen', 'Bedroom',
    'Meeting Hall', 'Training Ground', 'Observatory', 'Riverside'
  ],
  moods: [
    'Epic', 'Peaceful', 'Dramatic', 'Mysterious', 'Romantic', 'Tense',
    'Joyful', 'Melancholic', 'Heroic', 'Ominous', 'Whimsical', 'Serious',
    'Adventurous', 'Contemplative', 'Chaotic'
  ],
  lightings: [
    'Golden Hour', 'Dramatic Shadows', 'Soft Natural Light', 'Candlelight',
    'Moonlight', 'Bright Daylight', 'Sunset', 'Dawn', 'Firelight',
    'Magical Glow', 'Storm Light', 'Underground Torchlight', 'Neon Lights',
    'Starlight', 'Foggy Atmosphere'
  ],
  poses: [
    'Standing', 'Sitting', 'Walking', 'Running', 'Kneeling', 'Lying Down',
    'Dancing', 'Fighting Stance', 'Casting Spell', 'Reading', 'Thinking',
    'Pointing', 'Waving', 'Crouching', 'Jumping'
  ],
  expressions: [
    'Happy', 'Sad', 'Angry', 'Surprised', 'Thoughtful', 'Determined',
    'Scared', 'Excited', 'Calm', 'Confused', 'Proud', 'Worried',
    'Confident', 'Shy', 'Mischievous'
  ],
  actions: [
    'Speaking', 'Listening', 'Fighting', 'Studying', 'Eating', 'Drinking',
    'Crafting', 'Playing Music', 'Singing', 'Dancing', 'Praying', 'Meditating',
    'Working', 'Sleeping', 'Watching'
  ]
};

export const SceneBuilder: React.FC<SceneBuilderProps> = ({
  availableCharacters,
  existingScene,
  onSave,
  onCancel,
  onGenerateScene,
  presets = defaultPresets,
  isLoading = false,
  disabled = false,
  'data-testid': testId = 'scene-builder',
}) => {
  const [sceneData, setSceneData] = useState<CreateSceneData>({
    name: existingScene?.name || '',
    description: existingScene?.description || '',
    environment: existingScene?.environment || '',
    setting: existingScene?.setting || '',
    mood: existingScene?.mood || '',
    lighting: existingScene?.lighting || '',
    isPublic: existingScene?.isPublic || false,
  });

  const [sceneCharacters, setSceneCharacters] = useState<SceneCharacterData[]>(
    existingScene?.characters?.map(sc => ({
      characterId: sc.characterId,
      pose: sc.pose,
      expression: sc.expression,
      action: sc.action,
      position: sc.position as any,
    })) || []
  );

  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [showCharacterPanel, setShowCharacterPanel] = useState(false);

  const handleSceneDataChange = useCallback((field: keyof CreateSceneData, value: string | boolean) => {
    setSceneData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleAddCharacter = useCallback((characterId: string) => {
    if (sceneCharacters.find(sc => sc.characterId === characterId)) {
      return; // Character already in scene
    }

    const newCharacter: SceneCharacterData = {
      characterId,
      pose: 'Standing',
      expression: 'Calm',
      action: 'Watching',
      position: {
        x: Math.random() * 800 + 100, // Random position on canvas
        y: Math.random() * 400 + 100,
        scale: 1,
        rotation: 0,
      },
    };

    setSceneCharacters(prev => [...prev, newCharacter]);
    setSelectedCharacterId(characterId);
    setShowCharacterPanel(true);
  }, [sceneCharacters]);

  const handleRemoveCharacter = useCallback((characterId: string) => {
    setSceneCharacters(prev => prev.filter(sc => sc.characterId !== characterId));
    if (selectedCharacterId === characterId) {
      setSelectedCharacterId(null);
      setShowCharacterPanel(false);
    }
  }, [selectedCharacterId]);

  const handleCharacterUpdate = useCallback((characterId: string, updates: Partial<SceneCharacterData>) => {
    setSceneCharacters(prev => 
      prev.map(sc => 
        sc.characterId === characterId ? { ...sc, ...updates } : sc
      )
    );
  }, []);

  const handleSave = useCallback(() => {
    if (!sceneData.name.trim()) {
      return; // Basic validation
    }

    onSave?.({
      ...sceneData,
      characters: sceneCharacters,
    });
  }, [sceneData, sceneCharacters, onSave]);

  const selectedCharacter = useMemo(() => {
    return selectedCharacterId ? 
      sceneCharacters.find(sc => sc.characterId === selectedCharacterId) : 
      null;
  }, [selectedCharacterId, sceneCharacters]);

  const availableCharsNotInScene = useMemo(() => {
    const inSceneIds = new Set(sceneCharacters.map(sc => sc.characterId));
    return availableCharacters.filter(char => !inSceneIds.has(char.id));
  }, [availableCharacters, sceneCharacters]);

  const DropdownSelect = ({ 
    value, 
    options, 
    placeholder, 
    onSelect 
  }: {
    value?: string;
    options: string[];
    placeholder: string;
    onSelect: (value: string) => void;
  }) => (
    <select
      value={value || ''}
      onChange={(e) => onSelect(e.target.value)}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#374151',
        backgroundColor: 'white',
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );

  return (
    <div 
      className="scene-builder" 
      data-testid={testId}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 300px',
        gap: '24px',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '24px',
        height: '100vh',
        overflow: 'hidden'
      }}
    >
      {/* Main Canvas Area */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Canvas Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '700',
                color: '#111827',
                margin: '0 0 4px 0'
              }}>
                {existingScene ? 'Edit Scene' : 'Create New Scene'}
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                {sceneCharacters.length} character{sceneCharacters.length !== 1 ? 's' : ''} in scene
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={onCancel}
                disabled={disabled}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: disabled ? 'not-allowed' : 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={disabled || !sceneData.name.trim()}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: (disabled || !sceneData.name.trim()) ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: (disabled || !sceneData.name.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                Save Scene
              </button>
            </div>
          </div>
        </div>

        {/* Scene Canvas */}
        <div style={{
          flex: 1,
          position: 'relative',
          backgroundColor: '#f3f4f6',
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,.15) 1px, transparent 0)',
          backgroundSize: '20px 20px',
          overflow: 'hidden'
        }}>
          {sceneCharacters.map(sceneChar => {
            const character = availableCharacters.find(c => c.id === sceneChar.characterId);
            if (!character) return null;

            return (
              <div
                key={sceneChar.characterId}
                onClick={() => {
                  setSelectedCharacterId(sceneChar.characterId);
                  setShowCharacterPanel(true);
                }}
                style={{
                  position: 'absolute',
                  left: sceneChar.position?.x || 100,
                  top: sceneChar.position?.y || 100,
                  transform: `scale(${sceneChar.position?.scale || 1}) rotate(${sceneChar.position?.rotation || 0}deg)`,
                  cursor: 'pointer',
                  border: selectedCharacterId === sceneChar.characterId ? '3px solid #3b82f6' : '2px solid transparent',
                  borderRadius: '8px',
                  padding: '8px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease',
                  minWidth: '120px',
                  textAlign: 'center'
                }}
              >
                {character.thumbnailUrl ? (
                  <img
                    src={character.thumbnailUrl}
                    alt={character.name || 'Character'}
                    style={{
                      width: '80px',
                      height: '80px',
                      objectFit: 'cover',
                      borderRadius: '6px',
                      marginBottom: '4px'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    marginBottom: '4px'
                  }}>
                    👤
                  </div>
                )}
                
                <div style={{ fontSize: '12px', fontWeight: '500', color: '#111827' }}>
                  {character.name || 'Untitled'}
                </div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>
                  {sceneChar.pose} • {sceneChar.expression}
                </div>
              </div>
            );
          })}

          {/* Empty State */}
          {sceneCharacters.length === 0 && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: '#6b7280'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎬</div>
              <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '0 0 8px 0' }}>
                Empty Scene
              </h3>
              <p style={{ fontSize: '14px', margin: 0 }}>
                Add characters from the panel on the right to build your scene
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto',
        maxHeight: '100vh',
        paddingRight: '8px'
      }}>
        {/* Scene Properties */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 16px 0'
          }}>
            Scene Properties
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
                Scene Name *
              </label>
              <input
                type="text"
                value={sceneData.name}
                onChange={(e) => handleSceneDataChange('name', e.target.value)}
                disabled={disabled}
                placeholder="Enter scene name..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
                Description
              </label>
              <textarea
                value={sceneData.description || ''}
                onChange={(e) => handleSceneDataChange('description', e.target.value)}
                disabled={disabled}
                placeholder="Describe the scene..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
                Environment
              </label>
              <DropdownSelect
                value={sceneData.environment}
                options={presets.environments}
                placeholder="Select environment..."
                onSelect={(value) => handleSceneDataChange('environment', value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
                Setting
              </label>
              <DropdownSelect
                value={sceneData.setting}
                options={presets.settings}
                placeholder="Select setting..."
                onSelect={(value) => handleSceneDataChange('setting', value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
                Mood
              </label>
              <DropdownSelect
                value={sceneData.mood}
                options={presets.moods}
                placeholder="Select mood..."
                onSelect={(value) => handleSceneDataChange('mood', value)}
              />
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
                Lighting
              </label>
              <DropdownSelect
                value={sceneData.lighting}
                options={presets.lightings}
                placeholder="Select lighting..."
                onSelect={(value) => handleSceneDataChange('lighting', value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="scene-public"
                checked={sceneData.isPublic}
                onChange={(e) => handleSceneDataChange('isPublic', e.target.checked)}
                disabled={disabled}
              />
              <label htmlFor="scene-public" style={{ fontSize: '12px', color: '#374151', cursor: disabled ? 'not-allowed' : 'pointer' }}>
                Make scene public
              </label>
            </div>
          </div>
        </div>

        {/* Character Selection */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          padding: '20px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 16px 0'
          }}>
            Add Characters
          </h3>

          <div style={{
            maxHeight: '200px',
            overflowY: 'auto'
          }}>
            {availableCharsNotInScene.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '14px',
                padding: '20px',
                fontStyle: 'italic'
              }}>
                {availableCharacters.length === 0 ? 
                  'No characters available' : 
                  'All available characters are in the scene'
                }
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {availableCharsNotInScene.map(character => (
                  <div
                    key={character.id}
                    onClick={() => handleAddCharacter(character.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: disabled ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!disabled) {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!disabled) {
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }
                    }}
                  >
                    {character.thumbnailUrl ? (
                      <img
                        src={character.thumbnailUrl}
                        alt={character.name || 'Character'}
                        style={{
                          width: '40px',
                          height: '40px',
                          objectFit: 'cover',
                          borderRadius: '6px'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        backgroundColor: '#e5e7eb',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px'
                      }}>
                        👤
                      </div>
                    )}
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginBottom: '2px' }}>
                        {character.name || 'Untitled'}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {character.occupation || character.styleType}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Character Properties Panel */}
        {showCharacterPanel && selectedCharacter && (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Character Properties
              </h3>
              <button
                onClick={() => handleRemoveCharacter(selectedCharacter.characterId)}
                disabled={disabled}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ef4444',
                  borderRadius: '4px',
                  backgroundColor: '#fef2f2',
                  color: '#dc2626',
                  fontSize: '11px',
                  cursor: disabled ? 'not-allowed' : 'pointer'
                }}
              >
                Remove
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
                  Pose
                </label>
                <DropdownSelect
                  value={selectedCharacter.pose}
                  options={presets.poses}
                  placeholder="Select pose..."
                  onSelect={(value) => handleCharacterUpdate(selectedCharacter.characterId, { pose: value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
                  Expression
                </label>
                <DropdownSelect
                  value={selectedCharacter.expression}
                  options={presets.expressions}
                  placeholder="Select expression..."
                  onSelect={(value) => handleCharacterUpdate(selectedCharacter.characterId, { expression: value })}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
                  Action
                </label>
                <DropdownSelect
                  value={selectedCharacter.action}
                  options={presets.actions}
                  placeholder="Select action..."
                  onSelect={(value) => handleCharacterUpdate(selectedCharacter.characterId, { action: value })}
                />
              </div>

              {/* Position controls could be added here for fine-tuning */}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SceneBuilder;