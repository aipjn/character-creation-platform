import { Request, Response, NextFunction } from 'express';
import {
  createErrorHandler,
  AppError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  BadRequestError,
  DatabaseError,
  ConflictError,
  InternalServerError,
  notFoundHandler,
  asyncHandler,
  consoleLogger
} from '../../../src/middleware/errorHandler';

// Mock Express objects
const mockRequest = (overrides = {}) => ({
  method: 'GET',
  url: '/test',
  path: '/test',
  get: jest.fn().mockReturnValue('test-agent'),
  connection: { remoteAddress: '127.0.0.1' },
  socket: { remoteAddress: '127.0.0.1' },
  headers: {},
  ...overrides
}) as any as Request;

const mockResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    headersSent: false
  } as any as Response;
  return res;
};

const mockNext = () => jest.fn() as NextFunction;

describe('Error Handler Middleware', () => {
  
  describe('AppError', () => {
    it('should create AppError with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR', ['detail1', 'detail2']);
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual(['detail1', 'detail2']);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe('AppError');
    });
    
    it('should have default values', () => {
      const error = new AppError('Test error');
      
      expect(error.statusCode).toBe(500);
      expect(error.code).toBeUndefined();
      expect(error.details).toBeUndefined();
      expect(error.isOperational).toBe(true);
    });
  });
  
  describe('Specific Error Classes', () => {
    it('should create NotFoundError correctly', () => {
      const error = new NotFoundError('Resource not found', ['details']);
      
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
      expect(error.details).toEqual(['details']);
    });
    
    it('should create UnauthorizedError correctly', () => {
      const error = new UnauthorizedError();
      
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Unauthorized access');
    });
    
    it('should create ConflictError correctly', () => {
      const error = new ConflictError('Duplicate email');
      
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Duplicate email');
    });
    
    it('should create DatabaseError correctly', () => {
      const error = new DatabaseError('Connection failed', ['timeout']);
      
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('DATABASE_ERROR');
      expect(error.message).toBe('Connection failed');
      expect(error.details).toEqual(['timeout']);
    });
    
    it('should create InternalServerError correctly', () => {
      const error = new InternalServerError();
      
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.message).toBe('Internal server error');
    });
  });
  
  describe('createErrorHandler', () => {
    let mockLogger: any;
    
    beforeEach(() => {
      mockLogger = {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
      };
    });
    
    it('should handle AppError correctly', () => {
      const errorHandler = createErrorHandler({ logger: mockLogger });
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = new BadRequestError('Invalid input', ['field is required']);
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid input',
          code: 'BAD_REQUEST',
          details: ['field is required'],
          timestamp: expect.any(String),
          path: '/test',
          requestId: expect.any(String)
        }
      });
      expect(mockLogger.warn).toHaveBeenCalled();
    });
    
    it('should handle ValidationError from middleware', () => {
      const errorHandler = createErrorHandler({ logger: mockLogger });
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      
      // Create ValidationError similar to what validation middleware throws
      const validationError = new Error('Validation failed');
      validationError.name = 'ValidationError';
      (validationError as any).errors = ['Email is required', 'Name too long'];
      
      // Mock the ValidationError from validation middleware
      const error = {
        ...validationError,
        statusCode: 400,
        errors: ['Email is required', 'Name too long']
      } as any;
      
      errorHandler(error, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: expect.stringContaining('Validation failed'),
          code: 'VALIDATION_ERROR',
          details: ['Email is required', 'Name too long'],
          timestamp: expect.any(String),
          path: '/test',
          requestId: expect.any(String)
        }
      });
    });
    
    it('should handle Prisma database errors', () => {
      const errorHandler = createErrorHandler({ logger: mockLogger });
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const prismaError = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        message: 'Unique constraint failed'
      };
      
      errorHandler(prismaError as any, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'A record with this data already exists',
          code: 'CONFLICT',
          details: ['Unique constraint failed'],
          timestamp: expect.any(String),
          path: '/test',
          requestId: expect.any(String)
        }
      });
    });
    
    it('should handle JSON syntax errors', () => {
      const errorHandler = createErrorHandler({ logger: mockLogger });
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const jsonError = new SyntaxError('Unexpected token in JSON');
      (jsonError as any).body = {};
      
      errorHandler(jsonError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'Invalid JSON in request body',
          code: 'BAD_REQUEST',
          details: ['Unexpected token in JSON'],
          timestamp: expect.any(String),
          path: '/test',
          requestId: expect.any(String)
        }
      });
    });
    
    it('should handle Multer file upload errors', () => {
      const errorHandler = createErrorHandler({ logger: mockLogger });
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const multerError = new Error('File too large');
      multerError.name = 'MulterError';
      (multerError as any).code = 'LIMIT_FILE_SIZE';
      
      errorHandler(multerError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'File size too large',
          code: 'FILE_SIZE_ERROR',
          details: ['File too large'],
          timestamp: expect.any(String),
          path: '/test',
          requestId: expect.any(String)
        }
      });
    });
    
    it('should handle unknown errors as internal server error', () => {
      const errorHandler = createErrorHandler({ logger: mockLogger });
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const unknownError = new Error('Something went wrong');
      
      errorHandler(unknownError, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          message: 'An unexpected error occurred',
          code: 'INTERNAL_SERVER_ERROR',
          details: undefined,
          timestamp: expect.any(String),
          path: '/test',
          requestId: expect.any(String)
        }
      });
      expect(mockLogger.error).toHaveBeenCalled();
    });
    
    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const errorHandler = createErrorHandler({ 
        logger: mockLogger, 
        includeStackTrace: true 
      });
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = new AppError('Test error');
      
      errorHandler(error, req, res, next);
      
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.any(String)
          })
        })
      );
      
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const errorHandler = createErrorHandler({ 
        logger: mockLogger, 
        includeStackTrace: false 
      });
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = new AppError('Test error');
      
      errorHandler(error, req, res, next);
      
      const callArgs = (res.json as jest.Mock).mock.calls[0][0];
      expect(callArgs.error.stack).toBeUndefined();
      
      process.env.NODE_ENV = originalEnv;
    });
    
    it('should handle already sent response', () => {
      const errorHandler = createErrorHandler({ logger: mockLogger });
      const req = mockRequest();
      const res = mockResponse();
      res.headersSent = true;
      const next = mockNext();
      const error = new AppError('Test error');
      
      errorHandler(error, req, res, next);
      
      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
    
    it('should set request ID header', () => {
      const errorHandler = createErrorHandler({ logger: mockLogger });
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      const error = new AppError('Test error');
      
      errorHandler(error, req, res, next);
      
      expect(res.set).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
    });
    
    it('should handle user context in logging', () => {
      const errorHandler = createErrorHandler({ logger: mockLogger });
      const req = mockRequest({ user: { id: 'user123' } });
      const res = mockResponse();
      const next = mockNext();
      const error = new AppError('Test error');
      
      errorHandler(error, req, res, next);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          userId: 'user123'
        })
      );
    });
    
    it('should trust proxy for client IP when configured', () => {
      const errorHandler = createErrorHandler({ 
        logger: mockLogger, 
        trustProxy: true 
      });
      const req = mockRequest({
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' }
      });
      const res = mockResponse();
      const next = mockNext();
      const error = new AppError('Test error');
      
      errorHandler(error, req, res, next);
      
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          clientIp: '192.168.1.1'
        })
      );
    });
  });
  
  describe('notFoundHandler', () => {
    it('should create NotFoundError for unmatched routes', () => {
      const req = mockRequest({ method: 'POST', path: '/api/nonexistent' });
      const res = mockResponse();
      const next = mockNext();
      
      notFoundHandler(req, res, next);
      
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          message: 'Route POST /api/nonexistent not found'
        })
      );
    });
  });
  
  describe('asyncHandler', () => {
    it('should catch and forward async errors', async () => {
      const asyncFunction = async (req: Request, res: Response, next: NextFunction) => {
        throw new Error('Async error');
      };
      
      const wrappedHandler = asyncHandler(asyncFunction);
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      
      await wrappedHandler(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
    
    it('should handle successful async operations', async () => {
      const asyncFunction = async (req: Request, res: Response, next: NextFunction) => {
        res.json({ success: true });
      };
      
      const wrappedHandler = asyncHandler(asyncFunction);
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      
      await wrappedHandler(req, res, next);
      
      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should handle rejected promises', async () => {
      const asyncFunction = async (req: Request, res: Response, next: NextFunction) => {
        return Promise.reject(new Error('Promise rejected'));
      };
      
      const wrappedHandler = asyncHandler(asyncFunction);
      const req = mockRequest();
      const res = mockResponse();
      const next = mockNext();
      
      await wrappedHandler(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });
  });
  
  describe('consoleLogger', () => {
    let consoleSpy: any;
    
    beforeEach(() => {
      consoleSpy = {
        error: jest.spyOn(console, 'error').mockImplementation(),
        warn: jest.spyOn(console, 'warn').mockImplementation(),
        info: jest.spyOn(console, 'info').mockImplementation()
      };
    });
    
    afterEach(() => {
      consoleSpy.error.mockRestore();
      consoleSpy.warn.mockRestore();
      consoleSpy.info.mockRestore();
    });
    
    it('should log error messages', () => {
      consoleLogger.error('Test error', { context: 'test' });
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Test error',
        expect.stringContaining('context')
      );
    });
    
    it('should log warning messages', () => {
      consoleLogger.warn('Test warning');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith('Test warning', '');
    });
    
    it('should log info messages', () => {
      consoleLogger.info('Test info', { data: 'value' });
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        'Test info',
        expect.stringContaining('data')
      );
    });
  });
  
  describe('Database Error Handling', () => {
    it('should handle different Prisma error codes', () => {
      const errorCodes = [
        { code: 'P2002', expectedStatus: 409, expectedMessage: 'A record with this data already exists' },
        { code: 'P2025', expectedStatus: 404, expectedMessage: 'Record not found' },
        { code: 'P2003', expectedStatus: 400, expectedMessage: 'Foreign key constraint failed' },
        { code: 'P1001', expectedStatus: 503, expectedMessage: 'Cannot reach database server' }
      ];
      
      errorCodes.forEach(({ code, expectedStatus, expectedMessage }) => {
        const errorHandler = createErrorHandler({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } });
        const req = mockRequest();
        const res = mockResponse();
        const next = mockNext();
        const dbError = { code, message: 'Database error details' };
        
        errorHandler(dbError as any, req, res, next);
        
        expect(res.status).toHaveBeenCalledWith(expectedStatus);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({
              message: expectedMessage
            })
          })
        );
      });
    });
  });
});