import React, { useState, useMemo, useCallback } from 'react';
import { Character, CharacterFilters } from '../../types/character';
import { CharacterCollection } from '../../types/collections';
import CharacterCard from '../Gallery/CharacterCard';

export interface CharacterLibraryProps {
  characters: Character[];
  collections: CharacterCollection[];
  favorites: Character[];
  onCharacterSelect?: (character: Character) => void;
  onCharacterEdit?: (character: Character) => void;
  onCharacterDelete?: (characterId: string) => void;
  onAddToCollection?: (characterId: string, collectionId: string) => void;
  onRemoveFromCollection?: (characterId: string, collectionId: string) => void;
  onCreateCollection?: (name: string, characterIds: string[]) => void;
  onToggleFavorite?: (characterId: string) => void;
  onRemoveFromLibrary?: (characterId: string) => void;
  isLoading?: boolean;
  'data-testid'?: string;
}

type LibraryView = 'all' | 'favorites' | 'collections';
type SortOption = 'newest' | 'oldest' | 'name' | 'style';

export const CharacterLibrary: React.FC<CharacterLibraryProps> = ({
  characters,
  collections,
  favorites,
  onCharacterSelect,
  onCharacterEdit,
  onCharacterDelete,
  onAddToCollection,
  onRemoveFromCollection,
  onCreateCollection,
  onToggleFavorite,
  onRemoveFromLibrary,
  isLoading = false,
  'data-testid': testId = 'character-library',
}) => {
  const [activeView, setActiveView] = useState<LibraryView>('all');
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<CharacterFilters>({});
  const [selectedCharacters, setSelectedCharacters] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  // Filter and sort characters
  const filteredAndSortedCharacters = useMemo(() => {
    let filteredChars: Character[] = [];
    
    if (activeView === 'all') {
      filteredChars = characters;
    } else if (activeView === 'favorites') {
      filteredChars = favorites;
    } else if (activeView === 'collections' && selectedCollection) {
      const collection = collections.find(c => c.id === selectedCollection);
      if (collection && collection.items) {
        filteredChars = collection.items.map(item => item.character).filter(Boolean) as Character[];
      }
    }

    // Apply search filter
    if (searchQuery) {
      filteredChars = filteredChars.filter(char => 
        char.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        char.prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        char.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        char.occupation?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        char.personality?.some(trait => trait.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply filters
    if (filters.styleType) {
      filteredChars = filteredChars.filter(char => char.styleType === filters.styleType);
    }
    if (filters.tags && filters.tags.length > 0) {
      filteredChars = filteredChars.filter(char => 
        filters.tags!.some(tag => char.tags.includes(tag))
      );
    }

    // Sort characters
    filteredChars.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'name':
          return (a.name || 'Untitled').localeCompare(b.name || 'Untitled');
        case 'style':
          return a.styleType.localeCompare(b.styleType);
        default:
          return 0;
      }
    });

    return filteredChars;
  }, [characters, favorites, collections, activeView, selectedCollection, searchQuery, filters, sortBy]);

  const handleCharacterSelection = useCallback((characterId: string, selected: boolean) => {
    setSelectedCharacters(prev => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(characterId);
      } else {
        newSet.delete(characterId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedCharacters.size === filteredAndSortedCharacters.length) {
      setSelectedCharacters(new Set());
    } else {
      setSelectedCharacters(new Set(filteredAndSortedCharacters.map(c => c.id)));
    }
  }, [filteredAndSortedCharacters, selectedCharacters.size]);

  const handleBulkAddToCollection = useCallback((collectionId: string) => {
    selectedCharacters.forEach(characterId => {
      onAddToCollection?.(characterId, collectionId);
    });
    setSelectedCharacters(new Set());
  }, [selectedCharacters, onAddToCollection]);

  const handleBulkRemoveFromLibrary = useCallback(() => {
    selectedCharacters.forEach(characterId => {
      onRemoveFromLibrary?.(characterId);
    });
    setSelectedCharacters(new Set());
  }, [selectedCharacters, onRemoveFromLibrary]);

  const ViewButton = ({ view, label, count }: { view: LibraryView; label: string; count?: number }) => (
    <button
      onClick={() => {
        setActiveView(view);
        setSelectedCollection(null);
        setSelectedCharacters(new Set());
      }}
      style={{
        padding: '8px 16px',
        border: activeView === view ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderRadius: '6px',
        backgroundColor: activeView === view ? '#eff6ff' : 'white',
        color: activeView === view ? '#1d4ed8' : '#374151',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}
    >
      {label}
      {count !== undefined && (
        <span style={{
          backgroundColor: activeView === view ? '#3b82f6' : '#9ca3af',
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

  const CollectionItem = ({ collection }: { collection: CharacterCollection }) => (
    <button
      onClick={() => {
        setActiveView('collections');
        setSelectedCollection(collection.id);
        setSelectedCharacters(new Set());
      }}
      style={{
        width: '100%',
        padding: '12px',
        border: selectedCollection === collection.id ? '2px solid #3b82f6' : '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: selectedCollection === collection.id ? '#eff6ff' : 'white',
        textAlign: 'left',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        marginBottom: '4px'
      }}
    >
      <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827', marginBottom: '2px' }}>
        {collection.name}
      </div>
      <div style={{ fontSize: '12px', color: '#6b7280' }}>
        {collection.items?.length || 0} characters
      </div>
    </button>
  );

  return (
    <div className="character-library" data-testid={testId} style={{
      display: 'grid',
      gridTemplateColumns: '280px 1fr',
      gap: '24px',
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '24px'
    }}>
      {/* Sidebar */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        height: 'fit-content',
        position: 'sticky',
        top: '24px'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 16px 0'
        }}>
          Character Library
        </h2>

        {/* View Navigation */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <ViewButton view="all" label="All Characters" count={characters.length} />
            <ViewButton view="favorites" label="Favorites" count={favorites.length} />
            <ViewButton view="collections" label="Collections" count={collections.length} />
          </div>
        </div>

        {/* Collections List */}
        {activeView === 'collections' && (
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#111827',
              margin: '0 0 8px 0'
            }}>
              Your Collections
            </h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {collections.map(collection => (
                <CollectionItem key={collection.id} collection={collection} />
              ))}
              {collections.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  color: '#6b7280',
                  fontSize: '14px',
                  padding: '20px',
                  fontStyle: 'italic'
                }}>
                  No collections yet. Create one from your characters!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 8px 0'
          }}>
            Filters
          </h3>
          
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
              Sort by
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">Name A-Z</option>
              <option value="style">Style Type</option>
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
              Style Type
            </label>
            <select
              value={filters.styleType || ''}
              onChange={(e) => setFilters(prev => ({ 
                ...prev, 
                styleType: e.target.value ? e.target.value as any : undefined 
              }))}
              style={{
                width: '100%',
                padding: '6px 8px',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                fontSize: '12px'
              }}
            >
              <option value="">All Styles</option>
              <option value="REALISTIC">Realistic</option>
              <option value="CARTOON">Cartoon</option>
              <option value="ANIME">Anime</option>
              <option value="FANTASY">Fantasy</option>
              <option value="CYBERPUNK">Cyberpunk</option>
              <option value="VINTAGE">Vintage</option>
              <option value="MINIMALIST">Minimalist</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px'
        }}>
          <div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#111827',
              margin: '0 0 4px 0'
            }}>
              {activeView === 'all' && 'All Characters'}
              {activeView === 'favorites' && 'Favorite Characters'}
              {activeView === 'collections' && (
                selectedCollection ? 
                collections.find(c => c.id === selectedCollection)?.name || 'Collection' :
                'Collections'
              )}
            </h1>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0
            }}>
              {filteredAndSortedCharacters.length} character{filteredAndSortedCharacters.length !== 1 ? 's' : ''}
              {selectedCharacters.size > 0 && ` • ${selectedCharacters.size} selected`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Search */}
            <input
              type="text"
              placeholder="Search characters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                width: '200px'
              }}
            />

            {/* Bulk Actions */}
            {filteredAndSortedCharacters.length > 0 && (
              <button
                onClick={() => setShowBulkActions(!showBulkActions)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: showBulkActions ? '#eff6ff' : 'white',
                  color: showBulkActions ? '#1d4ed8' : '#374151',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Bulk Actions
              </button>
            )}
          </div>
        </div>

        {/* Bulk Actions Panel */}
        {showBulkActions && (
          <div style={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <button
                onClick={handleSelectAll}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                {selectedCharacters.size === filteredAndSortedCharacters.length ? 'Deselect All' : 'Select All'}
              </button>
              
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {selectedCharacters.size} selected
              </span>
            </div>

            {selectedCharacters.size > 0 && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {collections.map(collection => (
                  <button
                    key={collection.id}
                    onClick={() => handleBulkAddToCollection(collection.id)}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #3b82f6',
                      borderRadius: '4px',
                      backgroundColor: '#eff6ff',
                      color: '#1d4ed8',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                  >
                    Add to {collection.name}
                  </button>
                ))}
                
                <button
                  onClick={handleBulkRemoveFromLibrary}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid #ef4444',
                    borderRadius: '4px',
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  Remove from Library
                </button>
              </div>
            )}
          </div>
        )}

        {/* Character Grid */}
        {isLoading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            fontSize: '16px',
            color: '#6b7280'
          }}>
            Loading characters...
          </div>
        ) : filteredAndSortedCharacters.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
            <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', color: '#111827' }}>
              {searchQuery || Object.keys(filters).length > 0 ? 'No matching characters' : 'No characters in your library'}
            </h3>
            <p style={{ fontSize: '14px', margin: 0 }}>
              {searchQuery || Object.keys(filters).length > 0 
                ? 'Try adjusting your search or filters'
                : 'Generate some characters and add them to your library to get started!'
              }
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '20px'
          }}>
            {filteredAndSortedCharacters.map(character => (
              <div key={character.id} style={{ position: 'relative' }}>
                {showBulkActions && (
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    zIndex: 10
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedCharacters.has(character.id)}
                      onChange={(e) => handleCharacterSelection(character.id, e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>
                )}
                
                <CharacterCard
                  character={character as any}
                  onClick={() => onCharacterSelect?.(character)}
                  onEdit={() => onCharacterEdit?.(character)}
                  onDelete={() => onCharacterDelete?.(character.id)}
                  showFavoriteButton
                  isFavorite={character.isFavorite}
                  onFavoriteToggle={() => onToggleFavorite?.(character.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterLibrary;