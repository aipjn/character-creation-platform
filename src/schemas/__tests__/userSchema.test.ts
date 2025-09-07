import { UserSchema, CreateUserInput, UpdateUserInput } from '../../../src/schemas/userSchema';
import { SubscriptionTier } from '@prisma/client';

describe('UserSchema', () => {
  
  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user+tag@example.co.uk',
        'user123@example-domain.org',
        'user_name@example123.info'
      ];
      
      validEmails.forEach(email => {
        const result = UserSchema.validateEmail(email);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        '',
        'not-an-email',
        '@example.com',
        'user@',
        'user..double@example.com',
        'user@example',
        'user@.example.com',
        'a'.repeat(255) + '@example.com' // Too long
      ];
      
      invalidEmails.forEach(email => {
        const result = UserSchema.validateEmail(email);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
    
    it('should handle null/undefined email', () => {
      const result = UserSchema.validateEmail(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required and must be a string');
    });
    
    it('should handle non-string email', () => {
      const result = UserSchema.validateEmail(123 as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email is required and must be a string');
    });
    
    it('should handle empty email after trim', () => {
      const result = UserSchema.validateEmail('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Email cannot be empty');
    });
  });
  
  describe('validateName', () => {
    it('should accept valid names', () => {
      const validNames = [
        'John Doe',
        'Alice Smith-Brown',
        "O'Connor",
        'Jean-Luc',
        'Dr. House',
        'User123'
      ];
      
      validNames.forEach(name => {
        const result = UserSchema.validateName(name);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should accept undefined name', () => {
      const result = UserSchema.validateName(undefined);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid names', () => {
      const invalidNames = [
        '',
        '   ',
        'a'.repeat(101), // Too long
        'User<script>',
        'User@Domain',
        'User#Tag'
      ];
      
      invalidNames.forEach(name => {
        const result = UserSchema.validateName(name);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
    
    it('should handle non-string name', () => {
      const result = UserSchema.validateName(123 as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name must be a string');
    });
  });
  
  describe('validateAuth0Id', () => {
    it('should accept valid Auth0 IDs', () => {
      const validAuth0Ids = [
        'auth0|123456789',
        'google-oauth2|123456789',
        'github|username',
        'facebook|123456789'
      ];
      
      validAuth0Ids.forEach(id => {
        const result = UserSchema.validateAuth0Id(id);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should accept undefined Auth0 ID', () => {
      const result = UserSchema.validateAuth0Id(undefined);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid Auth0 IDs', () => {
      const invalidAuth0Ids = [
        '',
        '   ',
        'a'.repeat(256), // Too long
        'invalid spaces here',
        'invalid@special#chars'
      ];
      
      invalidAuth0Ids.forEach(id => {
        const result = UserSchema.validateAuth0Id(id);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('validateAvatar', () => {
    it('should accept valid avatar URLs', () => {
      const validUrls = [
        'https://example.com/avatar.jpg',
        'http://example.com/user/123/avatar.png',
        'https://cdn.example.com/avatars/user123.webp'
      ];
      
      validUrls.forEach(url => {
        const result = UserSchema.validateAvatar(url);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should accept undefined avatar', () => {
      const result = UserSchema.validateAvatar(undefined);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid avatar URLs', () => {
      const invalidUrls = [
        '',
        '   ',
        'not-a-url',
        'ftp://example.com/avatar.jpg',
        'https://' + 'a'.repeat(2048) + '.com/avatar.jpg' // Too long
      ];
      
      invalidUrls.forEach(url => {
        const result = UserSchema.validateAvatar(url);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });
  
  describe('validateSubscriptionTier', () => {
    it('should accept valid subscription tiers', () => {
      const validTiers = [SubscriptionTier.FREE, SubscriptionTier.PREMIUM, SubscriptionTier.PRO];
      
      validTiers.forEach(tier => {
        const result = UserSchema.validateSubscriptionTier(tier);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });
    
    it('should accept undefined subscription tier', () => {
      const result = UserSchema.validateSubscriptionTier(undefined);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject invalid subscription tiers', () => {
      const result = UserSchema.validateSubscriptionTier('INVALID' as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Subscription tier must be one of: FREE, PREMIUM, PRO');
    });
  });
  
  describe('validateCreateInput', () => {
    it('should accept valid create input', () => {
      const validInput: CreateUserInput = {
        email: 'user@example.com',
        name: 'John Doe',
        auth0Id: 'auth0|123456789',
        avatar: 'https://example.com/avatar.jpg',
        subscriptionTier: SubscriptionTier.FREE
      };
      
      const result = UserSchema.validateCreateInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should accept minimal valid create input', () => {
      const minimalInput: CreateUserInput = {
        email: 'user@example.com'
      };
      
      const result = UserSchema.validateCreateInput(minimalInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject create input without email', () => {
      const invalidInput = {
        name: 'John Doe'
      } as CreateUserInput;
      
      const result = UserSchema.validateCreateInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.errors.some(error => error.includes('Email is required'))).toBe(true);
    });
    
    it('should accumulate multiple validation errors', () => {
      const invalidInput: CreateUserInput = {
        email: 'not-an-email',
        name: 'a'.repeat(101),
        avatar: 'not-a-url',
        subscriptionTier: 'INVALID' as any
      };
      
      const result = UserSchema.validateCreateInput(invalidInput);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(3);
    });
  });
  
  describe('validateUpdateInput', () => {
    it('should accept valid update input', () => {
      const validInput: UpdateUserInput = {
        name: 'Jane Doe',
        avatar: 'https://example.com/new-avatar.jpg',
        subscriptionTier: SubscriptionTier.PREMIUM
      };
      
      const result = UserSchema.validateUpdateInput(validInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should reject empty update input', () => {
      const emptyInput: UpdateUserInput = {};
      
      const result = UserSchema.validateUpdateInput(emptyInput);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one field must be provided for update');
    });
    
    it('should accept partial update input', () => {
      const partialInput: UpdateUserInput = {
        name: 'Updated Name'
      };
      
      const result = UserSchema.validateUpdateInput(partialInput);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
  
  describe('sanitizeCreateInput', () => {
    it('should trim whitespace from string fields', () => {
      const input: CreateUserInput = {
        email: '  user@example.com  ',
        name: '  John Doe  ',
        auth0Id: '  auth0|123  ',
        avatar: '  https://example.com/avatar.jpg  '
      };
      
      const sanitized = UserSchema.sanitizeCreateInput(input);
      
      expect(sanitized.email).toBe('user@example.com');
      expect(sanitized.name).toBe('John Doe');
      expect(sanitized.auth0Id).toBe('auth0|123');
      expect(sanitized.avatar).toBe('https://example.com/avatar.jpg');
    });
    
    it('should preserve non-string fields', () => {
      const input: CreateUserInput = {
        email: 'user@example.com',
        subscriptionTier: SubscriptionTier.PREMIUM
      };
      
      const sanitized = UserSchema.sanitizeCreateInput(input);
      
      expect(sanitized.subscriptionTier).toBe(SubscriptionTier.PREMIUM);
    });
  });
  
  describe('sanitizeUpdateInput', () => {
    it('should only sanitize provided fields', () => {
      const input: UpdateUserInput = {
        name: '  Updated Name  '
      };
      
      const sanitized = UserSchema.sanitizeUpdateInput(input);
      
      expect(sanitized.name).toBe('Updated Name');
      expect(sanitized.avatar).toBeUndefined();
      expect(sanitized.subscriptionTier).toBeUndefined();
    });
    
    it('should handle undefined fields correctly', () => {
      const input: UpdateUserInput = {
        name: '  Test  ',
        avatar: undefined,
        subscriptionTier: SubscriptionTier.PRO
      };
      
      const sanitized = UserSchema.sanitizeUpdateInput(input);
      
      expect(sanitized.name).toBe('Test');
      expect(sanitized.avatar).toBeUndefined();
      expect(sanitized.subscriptionTier).toBe(SubscriptionTier.PRO);
    });
  });
});