/**
 * Tests for Rate Limiter Middleware
 */

import {
  MemoryRateLimiter,
  TokenBucketRateLimiter,
  RateLimitError,
  RateLimiterRegistry,
  createRateLimitMiddleware,
  createNanoBananaRateLimiter,
} from '../rateLimiter';
import { RateLimiterConfig } from '../../config/resilience';

describe('MemoryRateLimiter', () => {
  let config: RateLimiterConfig;
  let rateLimiter: MemoryRateLimiter;

  beforeEach(() => {
    config = {
      windowMs: 1000, // 1 second window
      maxRequests: 3,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };
    rateLimiter = new MemoryRateLimiter(config);
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('checkLimit', () => {
    it('should allow requests within limit', async () => {
      const identifier = 'user1';
      
      // Make requests within limit
      for (let i = 0; i < config.maxRequests; i++) {
        const result = await rateLimiter.checkLimit(identifier);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(config.maxRequests - i - 1);
        expect(result.limit).toBe(config.maxRequests);
      }
    });

    it('should deny requests when limit exceeded', async () => {
      const identifier = 'user1';
      
      // Use up all requests
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimiter.checkLimit(identifier);
      }
      
      // Next request should be denied
      const result = await rateLimiter.checkLimit(identifier);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.resetTime).toBeInstanceOf(Date);
    });

    it('should handle multiple identifiers independently', async () => {
      const user1 = 'user1';
      const user2 = 'user2';
      
      // Use up limit for user1
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimiter.checkLimit(user1);
      }
      
      // user1 should be rate limited
      const result1 = await rateLimiter.checkLimit(user1);
      expect(result1.allowed).toBe(false);
      
      // user2 should still be allowed
      const result2 = await rateLimiter.checkLimit(user2);
      expect(result2.allowed).toBe(true);
    });

    it('should reset after window expires', async () => {
      const identifier = 'user1';
      
      // Use up all requests
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimiter.checkLimit(identifier);
      }
      
      // Should be rate limited
      const result1 = await rateLimiter.checkLimit(identifier);
      expect(result1.allowed).toBe(false);
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, config.windowMs + 100));
      
      // Should be allowed again
      const result2 = await rateLimiter.checkLimit(identifier);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(config.maxRequests - 1);
    });
  });

  describe('getStatus', () => {
    it('should return current status for identifier', async () => {
      const identifier = 'user1';
      
      // Make a request
      await rateLimiter.checkLimit(identifier);
      
      const status = await rateLimiter.getStatus(identifier);
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(config.maxRequests - 1);
      expect(status.limit).toBe(config.maxRequests);
      expect(status.resetTime).toBeInstanceOf(Date);
    });

    it('should return fresh status for new identifier', async () => {
      const status = await rateLimiter.getStatus('new-user');
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(config.maxRequests);
      expect(status.limit).toBe(config.maxRequests);
    });
  });

  describe('reset', () => {
    it('should reset limit for identifier', async () => {
      const identifier = 'user1';
      
      // Use up all requests
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimiter.checkLimit(identifier);
      }
      
      // Should be rate limited
      const result1 = await rateLimiter.checkLimit(identifier);
      expect(result1.allowed).toBe(false);
      
      // Reset the limit
      await rateLimiter.reset(identifier);
      
      // Should be allowed again
      const result2 = await rateLimiter.checkLimit(identifier);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(config.maxRequests - 1);
    });
  });
});

describe('TokenBucketRateLimiter', () => {
  let config: RateLimiterConfig;
  let rateLimiter: TokenBucketRateLimiter;

  beforeEach(() => {
    config = {
      windowMs: 1000, // 1 second refill period
      maxRequests: 5, // 5 tokens capacity
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
    };
    rateLimiter = new TokenBucketRateLimiter(config);
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('checkLimit', () => {
    it('should allow burst of requests up to capacity', async () => {
      const identifier = 'user1';
      
      // Should allow all requests in burst
      for (let i = 0; i < config.maxRequests; i++) {
        const result = await rateLimiter.checkLimit(identifier);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(config.maxRequests - i - 1);
      }
    });

    it('should deny requests when bucket is empty', async () => {
      const identifier = 'user1';
      
      // Empty the bucket
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimiter.checkLimit(identifier);
      }
      
      // Next request should be denied
      const result = await rateLimiter.checkLimit(identifier);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should refill tokens over time', async () => {
      const identifier = 'user1';
      
      // Empty the bucket
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimiter.checkLimit(identifier);
      }
      
      // Should be denied
      const result1 = await rateLimiter.checkLimit(identifier);
      expect(result1.allowed).toBe(false);
      
      // Wait for some refill (half the window)
      await new Promise(resolve => setTimeout(resolve, config.windowMs / 2));
      
      // Should have some tokens available
      const result2 = await rateLimiter.checkLimit(identifier);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return current bucket status', async () => {
      const identifier = 'user1';
      
      // Use some tokens
      await rateLimiter.checkLimit(identifier);
      await rateLimiter.checkLimit(identifier);
      
      const status = await rateLimiter.getStatus(identifier);
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(config.maxRequests - 2);
      expect(status.limit).toBe(config.maxRequests);
    });
  });

  describe('reset', () => {
    it('should reset bucket for identifier', async () => {
      const identifier = 'user1';
      
      // Empty the bucket
      for (let i = 0; i < config.maxRequests; i++) {
        await rateLimiter.checkLimit(identifier);
      }
      
      // Should be denied
      const result1 = await rateLimiter.checkLimit(identifier);
      expect(result1.allowed).toBe(false);
      
      // Reset
      await rateLimiter.reset(identifier);
      
      // Should be allowed with full capacity
      const result2 = await rateLimiter.checkLimit(identifier);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(config.maxRequests - 1);
    });
  });
});

describe('RateLimiterRegistry', () => {
  let registry: RateLimiterRegistry;

  beforeEach(() => {
    registry = RateLimiterRegistry.getInstance();
  });

  afterEach(() => {
    registry.destroyAll();
  });

  describe('getRateLimiter', () => {
    it('should create new rate limiter if not exists', () => {
      const config: RateLimiterConfig = {
        windowMs: 1000,
        maxRequests: 10,
      };
      
      const limiter = registry.getRateLimiter('test', config);
      expect(limiter).toBeInstanceOf(MemoryRateLimiter);
    });

    it('should return existing rate limiter', () => {
      const config: RateLimiterConfig = {
        windowMs: 1000,
        maxRequests: 10,
      };
      
      const limiter1 = registry.getRateLimiter('test', config);
      const limiter2 = registry.getRateLimiter('test', config);
      
      expect(limiter1).toBe(limiter2);
    });

    it('should create different types of rate limiters', () => {
      const config: RateLimiterConfig = {
        windowMs: 1000,
        maxRequests: 10,
      };
      
      const sliding = registry.getRateLimiter('test', config, 'sliding');
      const token = registry.getRateLimiter('test', config, 'token');
      
      expect(sliding).toBeInstanceOf(MemoryRateLimiter);
      expect(token).toBeInstanceOf(TokenBucketRateLimiter);
      expect(sliding).not.toBe(token);
    });
  });

  describe('removeLimiter', () => {
    it('should remove and destroy rate limiter', () => {
      const config: RateLimiterConfig = {
        windowMs: 1000,
        maxRequests: 10,
      };
      
      const limiter = registry.getRateLimiter('test', config);
      const destroySpy = jest.spyOn(limiter, 'destroy');
      
      registry.removeLimiter('test');
      
      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('destroyAll', () => {
    it('should destroy all rate limiters', () => {
      const config: RateLimiterConfig = {
        windowMs: 1000,
        maxRequests: 10,
      };
      
      const limiter1 = registry.getRateLimiter('test1', config);
      const limiter2 = registry.getRateLimiter('test2', config);
      
      const destroySpy1 = jest.spyOn(limiter1, 'destroy');
      const destroySpy2 = jest.spyOn(limiter2, 'destroy');
      
      registry.destroyAll();
      
      expect(destroySpy1).toHaveBeenCalled();
      expect(destroySpy2).toHaveBeenCalled();
    });
  });
});

describe('createRateLimitMiddleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    };
    
    mockRes = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn(),
      statusCode: 200,
    };
    
    mockNext = jest.fn();
  });

  afterEach(() => {
    // Clean up any rate limiters created during tests
    const registry = RateLimiterRegistry.getInstance();
    registry.destroyAll();
  });

  it('should allow requests within limit', async () => {
    const config: RateLimiterConfig = {
      windowMs: 1000,
      maxRequests: 5,
    };
    
    const middleware = createRateLimitMiddleware(config);
    
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.set).toHaveBeenCalledWith({
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': '4',
      'X-RateLimit-Reset': expect.any(String),
    });
  });

  it('should block requests when limit exceeded', async () => {
    const config: RateLimiterConfig = {
      windowMs: 1000,
      maxRequests: 1,
    };
    
    const middleware = createRateLimitMiddleware(config, { name: 'test-middleware' });
    
    // First request should pass
    await middleware(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    mockNext.mockClear();
    
    // Second request should be blocked
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(429);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: 'Too Many Requests',
      message: expect.stringContaining('Rate limit exceeded'),
      retryAfter: expect.any(Number),
      limit: 1,
      resetTime: expect.any(String),
    });
  });

  it('should use custom key generator', async () => {
    const config: RateLimiterConfig = {
      windowMs: 1000,
      maxRequests: 1,
    };
    
    const keyGenerator = jest.fn().mockReturnValue('custom-key');
    const middleware = createRateLimitMiddleware(config, {
      name: 'custom-key-test',
      keyGenerator,
    });
    
    await middleware(mockReq, mockRes, mockNext);
    
    expect(keyGenerator).toHaveBeenCalledWith(mockReq);
  });

  it('should call onLimitReached callback', async () => {
    const config: RateLimiterConfig = {
      windowMs: 1000,
      maxRequests: 1,
    };
    
    const onLimitReached = jest.fn();
    const middleware = createRateLimitMiddleware(config, {
      name: 'callback-test',
      onLimitReached,
    });
    
    // Use up the limit
    await middleware(mockReq, mockRes, mockNext);
    
    // Trigger limit reached
    await middleware(mockReq, mockRes, mockNext);
    
    expect(onLimitReached).toHaveBeenCalledWith(mockReq, mockRes);
  });

  it('should handle rate limiter errors gracefully', async () => {
    const config: RateLimiterConfig = {
      windowMs: 1000,
      maxRequests: 5,
    };
    
    // Mock console.error to avoid noise in tests
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const middleware = createRateLimitMiddleware(config, {
      name: 'error-test',
      keyGenerator: () => {
        throw new Error('Key generation failed');
      },
    });
    
    await middleware(mockReq, mockRes, mockNext);
    
    // Should allow request through on error
    expect(mockNext).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith('Rate limiter error:', expect.any(Error));
    
    consoleSpy.mockRestore();
  });
});

describe('createNanoBananaRateLimiter', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      user: { id: 'user123' },
    };
    
    mockRes = {
      set: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
  });

  afterEach(() => {
    const registry = RateLimiterRegistry.getInstance();
    registry.destroyAll();
  });

  it('should create nanoBanana specific rate limiter', () => {
    const middleware = createNanoBananaRateLimiter();
    expect(typeof middleware).toBe('function');
  });

  it('should use user ID as identifier when available', async () => {
    const middleware = createNanoBananaRateLimiter({ maxRequests: 1 });
    
    // First request should pass
    await middleware(mockReq, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
    mockNext.mockClear();
    
    // Second request should be blocked (same user)
    await middleware(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(429);
  });

  it('should fall back to IP when no user', async () => {
    const reqWithoutUser = { ...mockReq, user: undefined };
    const middleware = createNanoBananaRateLimiter({ maxRequests: 1 });
    
    await middleware(reqWithoutUser, mockRes, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should apply custom configuration', async () => {
    const customConfig = {
      maxRequests: 2,
      windowMs: 5000,
    };
    
    const middleware = createNanoBananaRateLimiter(customConfig);
    
    // Should allow 2 requests
    await middleware(mockReq, mockRes, mockNext);
    await middleware(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalledTimes(2);
    mockNext.mockClear();
    
    // Third should be blocked
    await middleware(mockReq, mockRes, mockNext);
    expect(mockNext).not.toHaveBeenCalled();
  });
});

describe('RateLimitError', () => {
  it('should contain rate limit information', () => {
    const resetTime = new Date();
    const error = new RateLimitError(
      'Rate limit exceeded',
      resetTime,
      30,
      100,
      5
    );
    
    expect(error.name).toBe('RateLimitError');
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.resetTime).toBe(resetTime);
    expect(error.retryAfter).toBe(30);
    expect(error.limit).toBe(100);
    expect(error.remaining).toBe(5);
  });
});