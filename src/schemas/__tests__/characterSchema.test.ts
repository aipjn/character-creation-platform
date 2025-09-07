import { CharacterSchema, CreateCharacterInput, UpdateCharacterInput } from '../../../src/schemas/characterSchema';
import { StyleType, GenerationStatus } from '@prisma/client';

describe('CharacterSchema', () => {
  
  describe('validateName', () => {
    it('should accept valid character names', () => {
      const validNames = [
        'Aragorn',
        'Hermione Granger',
        'Luke Skywalker',
        'Princess Mononoke',
        'Iron Man',
        'Character-123',
        'Dr. Strange!'
      ];
      
      validNames.forEach(name => {
        const result = CharacterSchema.validateName(name);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should accept undefined name', () => {
      const result = CharacterSchema.validateName(undefined);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid character names', () => {
      const invalidNames = [
        '',
        '   ',
        'a'.repeat(101), // Too long
        'Name<script>alert("xss")</script>',
        'Name\x00WithNullByte'
      ];
      
      invalidNames.forEach(name => {
        const result = CharacterSchema.validateName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
    
    it('should handle non-string name', () => {
      const result = CharacterSchema.validateName(123 as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Character name must be a string');
    });
  });
  
  describe('validatePrompt', () => {
    it('should accept valid prompts', () => {
      const validPrompts = [
        'A brave knight in shining armor',
        'A mysterious wizard with a long beard and magical staff',
        'A futuristic cyberpunk character with neon lights',
        'An anime-style magical girl with colorful hair and powers'
      ];
      
      validPrompts.forEach(prompt => {
        const result = CharacterSchema.validatePrompt(prompt);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should reject empty or invalid prompts', () => {
      const invalidPrompts = [
        '',
        '   ',
        'short', // Too short
        'a'.repeat(2001), // Too long
        null,
        undefined,
        123
      ];
      
      invalidPrompts.forEach(prompt => {
        const result = CharacterSchema.validatePrompt(prompt as any);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
    
    it('should detect potentially harmful content', () => {
      const harmfulPrompts = [
        'Create character <script>alert("xss")</script>',
        'Character with javascript:alert(1)',
        'Character with onload=maliciousFunction()',
        'Prompt with <iframe src="malicious.com"></iframe>'
      ];
      
      harmfulPrompts.forEach(prompt => {
        const result = CharacterSchema.validatePrompt(prompt);
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('harmful content'))).toBe(true);
      });
    });
    
    it('should require minimum length', () => {
      const result = CharacterSchema.validatePrompt('short');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Character prompt must be at least 10 characters long');
    });
  });
  
  describe('validateUserId', () => {
    it('should accept valid CUID', () => {
      const validCuid = 'c' + 'a'.repeat(24);
      const result = CharacterSchema.validateUserId(validCuid);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid CUIDs', () => {
      const invalidCuids = [
        '',
        'invalid-id',
        '123456789',
        'c' + 'a'.repeat(23), // Too short
        'c' + 'a'.repeat(25), // Too long
        'b' + 'a'.repeat(24), // Wrong prefix
        null,
        undefined
      ];
      
      invalidCuids.forEach(cuid => {
        const result = CharacterSchema.validateUserId(cuid as any);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('validateStyleType', () => {
    it('should accept valid style types', () => {
      const validTypes = Object.values(StyleType);
      
      validTypes.forEach(type => {
        const result = CharacterSchema.validateStyleType(type);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should accept undefined style type', () => {
      const result = CharacterSchema.validateStyleType(undefined);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid style type', () => {
      const result = CharacterSchema.validateStyleType('INVALID_STYLE' as any);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Style type must be one of'))).toBe(true);
    });
  });
  
  describe('validateTags', () => {
    it('should accept valid tags', () => {
      const validTags = [
        ['fantasy', 'warrior', 'medieval'],
        ['sci-fi', 'robot', 'future'],
        ['anime', 'magical_girl', 'kawaii'],
        []
      ];
      
      validTags.forEach(tags => {
        const result = CharacterSchema.validateTags(tags);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should accept undefined tags', () => {
      const result = CharacterSchema.validateTags(undefined);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject too many tags', () => {
      const tooManyTags = Array(25).fill('tag');
      const result = CharacterSchema.validateTags(tooManyTags);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Maximum 20 tags allowed');
    });
    
    it('should reject invalid tag formats', () => {
      const invalidTags = [
        ['valid-tag', ''], // Empty tag
        ['valid-tag', 'tag with @special chars'],
        ['valid-tag', 'a'.repeat(51)], // Too long
        ['valid-tag', 123 as any] // Non-string
      ];
      
      invalidTags.forEach(tags => {
        const result = CharacterSchema.validateTags(tags);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
    
    it('should reject duplicate tags', () => {
      const duplicateTags = ['fantasy', 'warrior', 'fantasy'];
      const result = CharacterSchema.validateTags(duplicateTags);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate tags are not allowed');
    });
    
    it('should reject non-array tags', () => {
      const result = CharacterSchema.validateTags('not-array' as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Tags must be an array');
    });
  });
  
  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      const validUrls = [
        'https://example.com/image.jpg',
        'http://cdn.example.com/thumbnails/abc123.png',
        'https://s3.amazonaws.com/bucket/key.webp'
      ];
      
      validUrls.forEach(url => {
        const result = CharacterSchema.validateUrl(url, 'Test URL');
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should accept undefined URL', () => {
      const result = CharacterSchema.validateUrl(undefined, 'Test URL');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid URLs', () => {
      const invalidUrls = [
        '',
        '   ',
        'not-a-url',
        'ftp://example.com/file.jpg',
        'https://' + 'a'.repeat(2048) + '.com/image.jpg' // Too long
      ];
      
      invalidUrls.forEach(url => {
        const result = CharacterSchema.validateUrl(url, 'Test URL');
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('validateMetadata', () => {
    it('should accept valid metadata objects', () => {
      const validMetadata = [
        { setting: 'fantasy', mood: 'heroic' },
        { colors: ['red', 'blue'], style: 'anime' },
        { nested: { prop: 'value' } },
        null,
        undefined
      ];
      
      validMetadata.forEach(metadata => {
        const result = CharacterSchema.validateMetadata(metadata);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should reject non-object metadata', () => {
      const invalidMetadata = [
        'string',
        123,
        [],
        true
      ];
      
      invalidMetadata.forEach(metadata => {
        const result = CharacterSchema.validateMetadata(metadata);
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Metadata must be a JSON object');
      });
    });
    
    it('should reject metadata that is too large', () => {
      const largeObject = { data: 'x'.repeat(70000) };
      const result = CharacterSchema.validateMetadata(largeObject);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Metadata must be 64KB or less when serialized');
    });
    
    it('should reject non-serializable metadata', () => {
      const circular: any = {};
      circular.self = circular;
      const result = CharacterSchema.validateMetadata(circular);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Metadata must be valid JSON');
    });
  });
  
  describe('validateCreateInput', () => {
    const validCuid = 'c' + 'a'.repeat(24);
    
    it('should accept valid create input', () => {
      const validInput: CreateCharacterInput = {
        userId: validCuid,
        name: 'Test Character',
        prompt: 'A brave warrior in medieval armor',
        styleType: StyleType.FANTASY,
        tags: ['fantasy', 'warrior'],
        isPublic: true,
        metadata: { setting: 'medieval' }
      };
      
      const result = CharacterSchema.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should accept minimal valid create input', () => {
      const minimalInput: CreateCharacterInput = {
        userId: validCuid,
        prompt: 'A simple character description'
      };
      
      const result = CharacterSchema.validateCreateInput(minimalInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject create input without required fields', () => {
      const invalidInputs = [
        { prompt: 'Missing userId' },
        { userId: validCuid },
        { userId: 'invalid-id', prompt: 'Valid prompt but invalid userId' }
      ];
      
      invalidInputs.forEach(input => {
        const result = CharacterSchema.validateCreateInput(input as CreateCharacterInput);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
    
    it('should accumulate multiple validation errors', () => {
      const invalidInput: CreateCharacterInput = {
        userId: 'invalid-id',
        name: 'a'.repeat(101),
        prompt: 'short',
        styleType: 'INVALID' as any,
        tags: Array(25).fill('tag'),
        metadata: 'invalid-metadata' as any
      };
      
      const result = CharacterSchema.validateCreateInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(5);
    });
  });
  
  describe('validateUpdateInput', () => {
    it('should accept valid update input', () => {
      const validInput: UpdateCharacterInput = {
        name: 'Updated Character',
        prompt: 'Updated character description',
        styleType: StyleType.CYBERPUNK,
        tags: ['updated', 'cyberpunk'],
        isPublic: false,
        s3Url: 'https://s3.example.com/image.jpg',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
        generationStatus: GenerationStatus.COMPLETED
      };
      
      const result = CharacterSchema.validateUpdateInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should accept partial update input', () => {
      const partialInput: UpdateCharacterInput = {
        name: 'Just updating the name'
      };
      
      const result = CharacterSchema.validateUpdateInput(partialInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject empty update input', () => {
      const emptyInput: UpdateCharacterInput = {};
      
      const result = CharacterSchema.validateUpdateInput(emptyInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one field must be provided for update');
    });
  });
  
  describe('sanitizeCreateInput', () => {
    it('should trim whitespace and filter empty tags', () => {
      const input: CreateCharacterInput = {
        userId: '  ' + 'c' + 'a'.repeat(24) + '  ',
        name: '  Test Character  ',
        prompt: '  A character description  ',
        tags: ['  valid-tag  ', '', '  another-tag  ']
      };
      
      const sanitized = CharacterSchema.sanitizeCreateInput(input);
      
      expect(sanitized.userId).toBe('c' + 'a'.repeat(24));
      expect(sanitized.name).toBe('Test Character');
      expect(sanitized.prompt).toBe('A character description');
      expect(sanitized.tags).toEqual(['valid-tag', 'another-tag']);
    });
    
    it('should preserve non-string fields', () => {
      const input: CreateCharacterInput = {
        userId: 'c' + 'a'.repeat(24),
        prompt: 'Test prompt',
        styleType: StyleType.ANIME,
        isPublic: true,
        metadata: { test: 'data' }
      };
      
      const sanitized = CharacterSchema.sanitizeCreateInput(input);
      
      expect(sanitized.styleType).toBe(StyleType.ANIME);
      expect(sanitized.isPublic).toBe(true);
      expect(sanitized.metadata).toEqual({ test: 'data' });
    });
  });
  
  describe('sanitizeUpdateInput', () => {
    it('should only sanitize provided fields', () => {
      const input: UpdateCharacterInput = {
        name: '  Updated Name  ',
        tags: ['  tag1  ', '', '  tag2  ']
      };
      
      const sanitized = CharacterSchema.sanitizeUpdateInput(input);
      
      expect(sanitized.name).toBe('Updated Name');
      expect(sanitized.tags).toEqual(['tag1', 'tag2']);
      expect(sanitized.prompt).toBeUndefined();
      expect(sanitized.styleType).toBeUndefined();
    });
    
    it('should handle URL fields correctly', () => {
      const input: UpdateCharacterInput = {
        s3Url: '  https://s3.example.com/image.jpg  ',
        thumbnailUrl: '  https://cdn.example.com/thumb.jpg  '
      };
      
      const sanitized = CharacterSchema.sanitizeUpdateInput(input);
      
      expect(sanitized.s3Url).toBe('https://s3.example.com/image.jpg');
      expect(sanitized.thumbnailUrl).toBe('https://cdn.example.com/thumb.jpg');
    });
  });
});