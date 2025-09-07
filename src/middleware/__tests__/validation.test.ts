import { Request, Response, NextFunction } from 'express';
import {
  createValidationMiddleware,
  ValidationError,
  validateCreateUser,
  validateUpdateUser,
  validateCreateCharacter,
  validateUpdateCharacter,
  validateQueryParams,
  validatePathParams,
  PathValidators,
  QueryValidators,
  validateFileUpload,
  validateContentType,
  ValidatedRequest
} from '../../../src/middleware/validation';
import { CreateUserInput, UpdateUserInput } from '../../../src/schemas/userSchema';
import { CreateCharacterInput, UpdateCharacterInput } from '../../../src/schemas/characterSchema';
import { SubscriptionTier, StyleType } from '@prisma/client';

// Mock Express objects
const mockRequest = (overrides = {}) => ({
  body: {},
  query: {},
  params: {},
  get: jest.fn(),
  file: null,
  ...overrides
}) as any as ValidatedRequest;

const mockResponse = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis()
}) as any as Response;

const mockNext = () => jest.fn() as NextFunction;

describe('Validation Middleware', () => {
  
  describe('ValidationError', () => {
    it('should create ValidationError with correct properties', () => {
      const errors = ['Error 1', 'Error 2'];
      const validationError = new ValidationError(errors);
      
      expect(validationError.message).toBe('Validation failed');
      expect(validationError.name).toBe('ValidationError');
      expect(validationError.statusCode).toBe(400);
      expect(validationError.errors).toEqual(errors);
    });
  });
  
  describe('createValidationMiddleware', () => {
    it('should pass validation with valid data', () => {
      const validator = jest.fn().mockReturnValue({ isValid: true, errors: [] });
      const sanitizer = jest.fn().mockReturnValue({ sanitized: true });
      const middleware = createValidationMiddleware(validator, sanitizer);
      
      const req = mockRequest({ body: { test: 'data' } });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(validator).toHaveBeenCalledWith({ test: 'data' });
      expect(sanitizer).toHaveBeenCalledWith({ test: 'data' });
      expect(req.validatedData).toEqual({ sanitized: true });
      expect(next).toHaveBeenCalledWith();
    });
    
    it('should call next with ValidationError for invalid data', () => {
      const validator = jest.fn().mockReturnValue({ 
        isValid: false, 
        errors: ['Invalid field', 'Missing required field'] 
      });
      const middleware = createValidationMiddleware(validator);
      
      const req = mockRequest({ body: { invalid: 'data' } });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.errors).toEqual(['Invalid field', 'Missing required field']);
    });
    
    it('should work without sanitizer', () => {
      const validator = jest.fn().mockReturnValue({ isValid: true, errors: [] });
      const middleware = createValidationMiddleware(validator);
      
      const req = mockRequest({ body: { test: 'data' } });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(req.validatedData).toEqual({ test: 'data' });
      expect(next).toHaveBeenCalledWith();
    });
  });
  
  describe('validateCreateUser', () => {
    it('should validate and sanitize user creation data', () => {
      const req = mockRequest({
        body: {
          email: '  user@example.com  ',
          name: '  John Doe  ',
          subscriptionTier: SubscriptionTier.FREE
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      validateCreateUser(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
      expect(req.validatedData).toEqual({
        email: 'user@example.com',
        name: 'John Doe',
        subscriptionTier: SubscriptionTier.FREE
      });
    });
    
    it('should reject invalid user creation data', () => {
      const req = mockRequest({
        body: {
          email: 'invalid-email',
          name: 'a'.repeat(101)
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      validateCreateUser(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
  
  describe('validateUpdateUser', () => {
    it('should validate user update data', () => {
      const req = mockRequest({
        body: {
          name: '  Updated Name  ',
          subscriptionTier: SubscriptionTier.PREMIUM
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      validateUpdateUser(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
      expect(req.validatedData).toEqual({
        name: 'Updated Name',
        subscriptionTier: SubscriptionTier.PREMIUM
      });
    });
    
    it('should reject empty update data', () => {
      const req = mockRequest({ body: {} });
      const res = mockResponse();
      const next = mockNext();
      
      validateUpdateUser(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.errors).toContain('At least one field must be provided for update');
    });
  });
  
  describe('validateCreateCharacter', () => {
    const validCuid = 'c' + 'a'.repeat(24);
    
    it('should validate and sanitize character creation data', () => {
      const req = mockRequest({
        body: {
          userId: '  ' + validCuid + '  ',
          name: '  Test Character  ',
          prompt: '  A brave warrior in medieval armor  ',
          styleType: StyleType.FANTASY,
          tags: ['  fantasy  ', '', '  warrior  '],
          isPublic: true
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      validateCreateCharacter(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
      expect(req.validatedData).toEqual({
        userId: validCuid,
        name: 'Test Character',
        prompt: 'A brave warrior in medieval armor',
        styleType: StyleType.FANTASY,
        tags: ['fantasy', 'warrior'],
        isPublic: true
      });
    });
    
    it('should reject invalid character creation data', () => {
      const req = mockRequest({
        body: {
          userId: 'invalid-id',
          prompt: 'short'
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      validateCreateCharacter(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
  
  describe('validateUpdateCharacter', () => {
    it('should validate character update data', () => {
      const req = mockRequest({
        body: {
          name: '  Updated Character  ',
          tags: ['  updated  ', '  fantasy  '],
          isPublic: false
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      validateUpdateCharacter(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
      expect(req.validatedData).toEqual({
        name: 'Updated Character',
        tags: ['updated', 'fantasy'],
        isPublic: false
      });
    });
    
    it('should reject empty character update data', () => {
      const req = mockRequest({ body: {} });
      const res = mockResponse();
      const next = mockNext();
      
      validateUpdateCharacter(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
  
  describe('validateQueryParams', () => {
    it('should validate query parameters', () => {
      const validator = jest.fn().mockReturnValue({ isValid: true, errors: [] });
      const middleware = validateQueryParams(validator);
      
      const req = mockRequest({ query: { page: '1', limit: '10' } });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(validator).toHaveBeenCalledWith({ page: '1', limit: '10' });
      expect(next).toHaveBeenCalledWith();
    });
    
    it('should reject invalid query parameters', () => {
      const validator = jest.fn().mockReturnValue({ 
        isValid: false, 
        errors: ['Invalid page number'] 
      });
      const middleware = validateQueryParams(validator);
      
      const req = mockRequest({ query: { page: 'invalid' } });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
  
  describe('validatePathParams', () => {
    it('should validate path parameters', () => {
      const validator = jest.fn().mockReturnValue({ isValid: true, errors: [] });
      const middleware = validatePathParams(validator);
      
      const validCuid = 'c' + 'a'.repeat(24);
      const req = mockRequest({ params: { id: validCuid } });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(validator).toHaveBeenCalledWith({ id: validCuid });
      expect(next).toHaveBeenCalledWith();
    });
    
    it('should reject invalid path parameters', () => {
      const validator = jest.fn().mockReturnValue({ 
        isValid: false, 
        errors: ['Invalid ID format'] 
      });
      const middleware = validatePathParams(validator);
      
      const req = mockRequest({ params: { id: 'invalid-id' } });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
    });
  });
  
  describe('PathValidators', () => {
    describe('validateId', () => {
      it('should accept valid CUID', () => {
        const validCuid = 'c' + 'a'.repeat(24);
        const result = PathValidators.validateId({ id: validCuid });
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should reject invalid CUID', () => {
        const result = PathValidators.validateId({ id: 'invalid-id' });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('ID must be a valid CUID format');
      });
      
      it('should reject missing ID', () => {
        const result = PathValidators.validateId({ id: '' });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('ID parameter is required and must be a string');
      });
    });
    
    describe('validateUserId', () => {
      it('should accept valid user ID', () => {
        const validCuid = 'c' + 'b'.repeat(24);
        const result = PathValidators.validateUserId({ userId: validCuid });
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should reject invalid user ID', () => {
        const result = PathValidators.validateUserId({ userId: 'user123' });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('User ID must be a valid CUID format');
      });
    });
    
    describe('validateCharacterId', () => {
      it('should accept valid character ID', () => {
        const validCuid = 'c' + 'x'.repeat(24);
        const result = PathValidators.validateCharacterId({ characterId: validCuid });
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should reject invalid character ID', () => {
        const result = PathValidators.validateCharacterId({ characterId: 'char123' });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Character ID must be a valid CUID format');
      });
    });
  });
  
  describe('QueryValidators', () => {
    describe('validatePagination', () => {
      it('should accept valid pagination parameters', () => {
        const result = QueryValidators.validatePagination({ 
          skip: '0', 
          take: '20' 
        });
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should accept limit instead of take', () => {
        const result = QueryValidators.validatePagination({ 
          skip: '10', 
          limit: '50' 
        });
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should reject invalid skip value', () => {
        const result = QueryValidators.validatePagination({ 
          skip: 'invalid' 
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Skip parameter must be a non-negative number');
      });
      
      it('should reject negative skip value', () => {
        const result = QueryValidators.validatePagination({ 
          skip: '-5' 
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Skip parameter must be a non-negative number');
      });
      
      it('should reject invalid take value', () => {
        const result = QueryValidators.validatePagination({ 
          take: '0' 
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Take/limit parameter must be a number between 1 and 100');
      });
      
      it('should reject take value too large', () => {
        const result = QueryValidators.validatePagination({ 
          take: '150' 
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Take/limit parameter must be a number between 1 and 100');
      });
    });
    
    describe('validateSearch', () => {
      it('should accept valid search terms', () => {
        const result = QueryValidators.validateSearch({ 
          search: 'warrior character' 
        });
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should reject search terms too short', () => {
        const result = QueryValidators.validateSearch({ 
          search: 'a' 
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Search parameter must be at least 2 characters long');
      });
      
      it('should reject search terms too long', () => {
        const result = QueryValidators.validateSearch({ 
          search: 'a'.repeat(101) 
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Search parameter must be 100 characters or less');
      });
      
      it('should reject non-string search', () => {
        const result = QueryValidators.validateSearch({ 
          search: 123 
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Search parameter must be a string');
      });
    });
    
    describe('validateCharacterFilters', () => {
      it('should accept valid character filters', () => {
        const result = QueryValidators.validateCharacterFilters({
          styleType: 'FANTASY',
          tags: 'warrior,medieval,fantasy',
          isPublic: 'true'
        });
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should accept tags as array', () => {
        const result = QueryValidators.validateCharacterFilters({
          tags: ['warrior', 'fantasy', 'medieval']
        });
        
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
      
      it('should reject invalid style type', () => {
        const result = QueryValidators.validateCharacterFilters({
          styleType: 'INVALID_STYLE'
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors.some(error => error.includes('Style type must be one of'))).toBe(true);
      });
      
      it('should reject too many tags', () => {
        const manyTags = Array(12).fill('tag').join(',');
        const result = QueryValidators.validateCharacterFilters({
          tags: manyTags
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('Maximum 10 tags allowed for filtering');
      });
      
      it('should reject invalid isPublic value', () => {
        const result = QueryValidators.validateCharacterFilters({
          isPublic: 'maybe'
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('isPublic parameter must be "true" or "false"');
      });
      
      it('should reject empty tags', () => {
        const result = QueryValidators.validateCharacterFilters({
          tags: 'valid,,empty'
        });
        
        expect(result.isValid).toBe(false);
        expect(result.errors).toContain('All tags must be non-empty strings');
      });
    });
  });
  
  describe('validateFileUpload', () => {
    it('should accept valid file upload', () => {
      const middleware = validateFileUpload({
        allowedTypes: ['image/jpeg', 'image/png'],
        maxSize: 1024 * 1024,
        required: true
      });
      
      const req = mockRequest({
        file: {
          mimetype: 'image/jpeg',
          size: 500000,
          originalname: 'test.jpg'
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
    });
    
    it('should reject when file required but missing', () => {
      const middleware = validateFileUpload({ required: true });
      
      const req = mockRequest({ file: null });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.errors).toContain('File upload is required');
    });
    
    it('should reject invalid file type', () => {
      const middleware = validateFileUpload({
        allowedTypes: ['image/jpeg', 'image/png']
      });
      
      const req = mockRequest({
        file: {
          mimetype: 'application/pdf',
          size: 100000,
          originalname: 'document.pdf'
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.errors.some(e => e.includes('File type'))).toBe(true);
    });
    
    it('should reject file too large', () => {
      const middleware = validateFileUpload({ maxSize: 1000 });
      
      const req = mockRequest({
        file: {
          mimetype: 'image/jpeg',
          size: 2000,
          originalname: 'large.jpg'
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.errors.some(e => e.includes('File size'))).toBe(true);
    });
    
    it('should reject filename too long', () => {
      const middleware = validateFileUpload({});
      
      const longFilename = 'a'.repeat(256) + '.jpg';
      const req = mockRequest({
        file: {
          mimetype: 'image/jpeg',
          size: 100000,
          originalname: longFilename
        }
      });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.errors).toContain('Filename must be 255 characters or less');
    });
    
    it('should pass when file not required and missing', () => {
      const middleware = validateFileUpload({ required: false });
      
      const req = mockRequest({ file: null });
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
    });
  });
  
  describe('validateContentType', () => {
    it('should accept valid content type', () => {
      const middleware = validateContentType(['application/json']);
      
      const req = mockRequest();
      req.get = jest.fn().mockReturnValue('application/json; charset=utf-8');
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
    });
    
    it('should accept multiple valid content types', () => {
      const middleware = validateContentType(['application/json', 'multipart/form-data']);
      
      const req = mockRequest();
      req.get = jest.fn().mockReturnValue('multipart/form-data; boundary=something');
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith();
    });
    
    it('should reject invalid content type', () => {
      const middleware = validateContentType(['application/json']);
      
      const req = mockRequest();
      req.get = jest.fn().mockReturnValue('text/plain');
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.errors.some(e => e.includes('Invalid Content-Type'))).toBe(true);
    });
    
    it('should reject missing content type', () => {
      const middleware = validateContentType(['application/json']);
      
      const req = mockRequest();
      req.get = jest.fn().mockReturnValue(undefined);
      const res = mockResponse();
      const next = mockNext();
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(ValidationError));
      const error = (next as jest.Mock).mock.calls[0][0];
      expect(error.errors).toContain('Content-Type header is required');
    });
  });
});