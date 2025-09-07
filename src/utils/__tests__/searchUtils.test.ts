import { searchCharacters, highlightSearchTerms, generateSearchSuggestions } from '../searchUtils';
import { CharacterDisplayData } from '../../types/character';

// Mock enums for testing (since Prisma client might not be available during tests)
enum StyleType {
  REALISTIC = 'REALISTIC',
  CARTOON = 'CARTOON',
  ANIME = 'ANIME',
  FANTASY = 'FANTASY',
  CYBERPUNK = 'CYBERPUNK',
  VINTAGE = 'VINTAGE',
  MINIMALIST = 'MINIMALIST',
}

enum GenerationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// Mock character data for testing
const mockCharacters: CharacterDisplayData[] = [
  {
    id: '1',
    name: 'Warrior Princess',
    prompt: 'A brave female warrior with golden armor in fantasy setting',
    styleType: StyleType.FANTASY,
    imageUrl: 'test1.jpg',
    thumbnailUrl: 'test1_thumb.jpg',
    tags: ['warrior', 'princess', 'fantasy', 'female'],
    isPublic: true,
    status: GenerationStatus.COMPLETED,
    createdAt: new Date('2023-01-01'),
    author: {
      id: 'user1',
      name: 'John Doe',
    },
    metadata: {
      width: 512,
      height: 512,
      fileSize: 1024,
      format: 'png',
    },
  },
  {
    id: '2',
    name: 'Cyberpunk Hacker',
    prompt: 'Futuristic hacker in neon-lit cityscape with cybernetic implants',
    styleType: StyleType.CYBERPUNK,
    imageUrl: 'test2.jpg',
    thumbnailUrl: 'test2_thumb.jpg',
    tags: ['cyberpunk', 'hacker', 'futuristic', 'neon'],
    isPublic: true,
    status: GenerationStatus.COMPLETED,
    createdAt: new Date('2023-02-01'),
    author: {
      id: 'user2',
      name: 'Jane Smith',
    },
    metadata: {
      width: 768,
      height: 768,
      fileSize: 2048,
      format: 'jpg',
    },
  },
  {
    id: '3',
    name: 'Anime Schoolgirl',
    prompt: 'Cute anime girl in school uniform with cherry blossoms',
    styleType: StyleType.ANIME,
    imageUrl: 'test3.jpg',
    thumbnailUrl: 'test3_thumb.jpg',
    tags: ['anime', 'schoolgirl', 'uniform', 'cute'],
    isPublic: false,
    status: GenerationStatus.COMPLETED,
    createdAt: new Date('2023-03-01'),
    author: {
      id: 'user3',
      name: 'Mike Johnson',
    },
  },
];

describe('searchUtils', () => {
  describe('searchCharacters', () => {
    test('should return empty array for empty query', () => {
      const results = searchCharacters(mockCharacters, '');
      expect(results).toEqual([]);
    });

    test('should return empty array for whitespace query', () => {
      const results = searchCharacters(mockCharacters, '   ');
      expect(results).toEqual([]);
    });

    test('should find exact name match', () => {
      const results = searchCharacters(mockCharacters, 'Warrior Princess');
      expect(results).toHaveLength(1);
      expect(results[0]?.character.id).toBe('1');
      expect(results[0]?.score).toBeGreaterThan(0.8);
    });

    test('should find partial name match', () => {
      const results = searchCharacters(mockCharacters, 'warrior');
      expect(results).toHaveLength(1);
      expect(results[0]?.character.id).toBe('1');
    });

    test('should find matches in prompt', () => {
      const results = searchCharacters(mockCharacters, 'cybernetic');
      expect(results).toHaveLength(1);
      expect(results[0]?.character.id).toBe('2');
    });

    test('should find matches in tags', () => {
      const results = searchCharacters(mockCharacters, 'anime');
      expect(results).toHaveLength(1);
      expect(results[0]?.character.id).toBe('3');
    });

    test('should find matches in style type', () => {
      const results = searchCharacters(mockCharacters, 'fantasy');
      expect(results).toHaveLength(1);
      expect(results[0]?.character.id).toBe('1');
    });

    test('should find matches in author name', () => {
      const results = searchCharacters(mockCharacters, 'Jane Smith');
      expect(results).toHaveLength(1);
      expect(results[0]?.character.id).toBe('2');
    });

    test('should return results sorted by score (descending)', () => {
      const results = searchCharacters(mockCharacters, 'girl');
      // Should match both "Warrior Princess" (in tags) and "Anime Schoolgirl" (in name and tags)
      expect(results.length).toBeGreaterThan(0);
      
      // Results should be sorted by score descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]?.score).toBeGreaterThanOrEqual(results[i]?.score || 0);
      }
    });

    test('should respect maxResults option', () => {
      const results = searchCharacters(mockCharacters, 'a', { maxResults: 1 });
      expect(results).toHaveLength(1);
    });

    test('should respect minScore option', () => {
      const results = searchCharacters(mockCharacters, 'xyz', { minScore: 0.9 });
      expect(results).toHaveLength(0);
    });

    test('should be case insensitive', () => {
      const results1 = searchCharacters(mockCharacters, 'WARRIOR');
      const results2 = searchCharacters(mockCharacters, 'warrior');
      const results3 = searchCharacters(mockCharacters, 'WaRrIoR');

      expect(results1).toHaveLength(1);
      expect(results2).toHaveLength(1);
      expect(results3).toHaveLength(1);
      expect(results1[0]?.character.id).toBe('1');
      expect(results2[0]?.character.id).toBe('1');
      expect(results3[0]?.character.id).toBe('1');
    });
  });

  describe('highlightSearchTerms', () => {
    test('should highlight single match', () => {
      const text = 'Hello world';
      const indices: [number, number][] = [[0, 5]];
      const result = highlightSearchTerms(text, indices);
      
      expect(result).toBe('<span class="search-highlight">Hello</span> world');
    });

    test('should highlight multiple matches', () => {
      const text = 'Hello world hello';
      const indices: [number, number][] = [[0, 5], [12, 17]];
      const result = highlightSearchTerms(text, indices);
      
      expect(result).toBe('<span class="search-highlight">Hello</span> world <span class="search-highlight">hello</span>');
    });

    test('should use custom CSS class', () => {
      const text = 'Hello world';
      const indices: [number, number][] = [[0, 5]];
      const result = highlightSearchTerms(text, indices, 'custom-highlight');
      
      expect(result).toBe('<span class="custom-highlight">Hello</span> world');
    });

    test('should return original text for empty indices', () => {
      const text = 'Hello world';
      const indices: [number, number][] = [];
      const result = highlightSearchTerms(text, indices);
      
      expect(result).toBe('Hello world');
    });

    test('should handle overlapping indices correctly', () => {
      const text = 'Hello world';
      const indices: [number, number][] = [[0, 5], [2, 8]];
      const result = highlightSearchTerms(text, indices);
      
      // Should handle overlapping highlights gracefully
      expect(result).toContain('<span class="search-highlight">');
    });
  });

  describe('generateSearchSuggestions', () => {
    test('should return suggestions based on character data', () => {
      const suggestions = generateSearchSuggestions(mockCharacters, '', 5);
      
      expect(suggestions).toBeInstanceOf(Array);
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    test('should filter suggestions based on query', () => {
      const suggestions = generateSearchSuggestions(mockCharacters, 'war', 10);
      
      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(
          suggestion.includes('war') || 'war'.includes(suggestion)
        ).toBeTruthy();
      });
    });

    test('should return limited number of suggestions', () => {
      const suggestions = generateSearchSuggestions(mockCharacters, '', 3);
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    test('should return empty array for no characters', () => {
      const suggestions = generateSearchSuggestions([], 'test', 5);
      expect(suggestions).toEqual([]);
    });

    test('should include character names in suggestions', () => {
      const suggestions = generateSearchSuggestions(mockCharacters, 'princess');
      expect(suggestions.some(s => s.includes('princess'))).toBeTruthy();
    });

    test('should include tags in suggestions', () => {
      const suggestions = generateSearchSuggestions(mockCharacters, 'anime');
      expect(suggestions.some(s => s.includes('anime'))).toBeTruthy();
    });
  });

  describe('performance with large datasets', () => {
    test('should handle large character datasets efficiently', () => {
      // Create a large mock dataset
      const largeDataset: CharacterDisplayData[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `char-${i}`,
        name: `Character ${i}`,
        prompt: `This is character number ${i} with various properties`,
        styleType: Object.values(StyleType)[i % Object.values(StyleType).length],
        imageUrl: `test${i}.jpg`,
        thumbnailUrl: `test${i}_thumb.jpg`,
        tags: [`tag${i}`, `category${i % 10}`, 'common'],
        isPublic: i % 2 === 0,
        status: GenerationStatus.COMPLETED,
        createdAt: new Date(2023, 0, (i % 30) + 1),
        author: {
          id: `user${i % 100}`,
          name: `User ${i % 100}`,
        },
      }));

      const startTime = performance.now();
      const results = searchCharacters(largeDataset, 'character', { maxResults: 100 });
      const endTime = performance.now();

      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(results.length).toBeLessThanOrEqual(100);
      expect(results.length).toBeGreaterThan(0);
    });
  });
});