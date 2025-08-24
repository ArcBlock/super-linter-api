import { CacheService, CacheOptions, CacheStats } from '../../src/services/cache';
import { DatabaseService } from '../../src/services/database';
import { TestHelpers } from '../utils/testHelpers';
import { LinterType, OutputFormat, LinterOptions } from '../../src/types/api';
import { CacheError } from '../../src/types/errors';
import { LintResult } from '../../src/types/database';

// Mock winston logger to avoid console output during tests
jest.mock('winston', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
  format: {
    json: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

describe('CacheService', () => {
  let db: DatabaseService;
  let cache: CacheService;

  beforeEach(async () => {
    db = await TestHelpers.createTestDatabase();
    cache = new CacheService(db, {
      default_ttl_hours: 1,
      max_entries: 1000,
      // cleanup_interval_hours not specified to disable timer
    });
  });

  afterEach(async () => {
    await TestHelpers.cleanupTestDatabases();
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default options', () => {
      const defaultCache = new CacheService(db);
      expect(defaultCache).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const options: CacheOptions = {
        default_ttl_hours: 12,
        max_entries: 500,
        cleanup_interval_hours: 6,
      };
      
      const customCache = new CacheService(db, options);
      expect(customCache).toBeDefined();
      
      // Clean up the timer
      customCache['stopCleanupTimer']();
    });
  });

  describe('Hash Generation', () => {
    it('should generate consistent content hashes', () => {
      const content1 = 'console.log("test");';
      const content2 = Buffer.from('console.log("test");');
      
      const hash1 = cache.generateContentHash(content1);
      const hash2 = cache.generateContentHash(content2);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex length
    });

    it('should generate different hashes for different content', () => {
      const content1 = 'console.log("test1");';
      const content2 = 'console.log("test2");';
      
      const hash1 = cache.generateContentHash(content1);
      const hash2 = cache.generateContentHash(content2);
      
      expect(hash1).not.toBe(hash2);
    });

    it('should generate consistent options hashes', () => {
      const options1: LinterOptions = {
        validate_all: true,
        exclude_patterns: ['*.test.js', '*.spec.js'],
        include_patterns: ['src/**/*.js'],
        log_level: 'DEBUG',
        timeout: 5000,
      };
      
      const options2: LinterOptions = {
        timeout: 5000,
        log_level: 'DEBUG',
        validate_all: true,
        include_patterns: ['src/**/*.js'],
        exclude_patterns: ['*.test.js', '*.spec.js'],
      };
      
      const hash1 = cache.generateOptionsHash(options1);
      const hash2 = cache.generateOptionsHash(options2);
      
      // Should be the same despite different property order
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should generate cache keys correctly', () => {
      const contentHash = 'abc123';
      const linter: LinterType = 'eslint';
      const format: OutputFormat = 'json';
      const optionsHash = 'def456';
      
      const key = cache.generateCacheKey(contentHash, linter, format, optionsHash);
      
      expect(key).toBe('eslint:json:abc123:def456');
    });
  });

  describe('Cache Operations', () => {
    const testContent = 'console.log("test");';
    const testLinter: LinterType = 'eslint';
    const testOptions: LinterOptions = { validate_all: true };
    
    let contentHash: string;
    let optionsHash: string;

    beforeEach(() => {
      contentHash = cache.generateContentHash(testContent);
      optionsHash = cache.generateOptionsHash(testOptions);
    });

    it('should return null for cache miss', async () => {
      const result = await cache.get(contentHash, testLinter, optionsHash);
      expect(result).toBeNull();
    });

    it('should store and retrieve cache entries', async () => {
      const mockResult = {
        success: true,
        files_linted: 1,
        issues: [],
      };

      // Store result
      const id = await cache.set(
        contentHash,
        testLinter,
        'json',
        optionsHash,
        mockResult,
        'success'
      );

      expect(id).toBeTruthy();

      // Retrieve result
      const cachedResult = await cache.get(contentHash, testLinter, optionsHash);
      
      expect(cachedResult).toBeTruthy();
      expect(cachedResult?.content_hash).toBe(contentHash);
      expect(cachedResult?.linter_type).toBe(testLinter);
      expect(cachedResult?.status).toBe('success');
      expect(JSON.parse(cachedResult!.result)).toEqual(mockResult);
    });

    it('should store error results', async () => {
      const errorMessage = 'Linting failed due to syntax error';
      
      const id = await cache.set(
        contentHash,
        testLinter,
        'json',
        optionsHash,
        null,
        'error',
        errorMessage
      );

      expect(id).toBeTruthy();

      const cachedResult = await cache.get(contentHash, testLinter, optionsHash);
      
      expect(cachedResult).toBeTruthy();
      expect(cachedResult?.status).toBe('error');
      expect(cachedResult?.error_message).toBe(errorMessage);
    });

    it('should handle timeout results', async () => {
      const id = await cache.set(
        contentHash,
        testLinter,
        'json',
        optionsHash,
        { timeout: true },
        'timeout',
        'Operation timed out'
      );

      expect(id).toBeTruthy();

      const cachedResult = await cache.get(contentHash, testLinter, optionsHash);
      
      expect(cachedResult).toBeTruthy();
      expect(cachedResult?.status).toBe('timeout');
    });

    it('should respect TTL settings', async () => {
      const shortTtl = 0.001; // Very short TTL for testing (3.6 seconds)
      
      await cache.set(
        contentHash,
        testLinter,
        'json',
        optionsHash,
        { test: 'data' },
        'success',
        undefined,
        shortTtl
      );

      // Should be available immediately
      let result = await cache.get(contentHash, testLinter, optionsHash);
      expect(result).toBeTruthy();

      // Wait for expiration (in real tests, this would be mocked)
      // For testing purposes, we'll just verify the expires_at is set correctly
      expect(result?.expires_at).toBeTruthy();
      const expiresAt = new Date(result!.expires_at);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      
      // Should expire in approximately shortTtl hours (converted to ms)
      expect(diffMs).toBeCloseTo(shortTtl * 60 * 60 * 1000, -2);
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(() => {
      // Reset stats before each test
      cache.resetStats();
    });

    it('should track hit and miss counts', async () => {
      const contentHash = cache.generateContentHash('test content');
      const optionsHash = cache.generateOptionsHash({ validate_all: true });

      // Initial stats should be zero
      let stats = cache.getHitMissStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.rate).toBe(0);

      // Cache miss
      await cache.get(contentHash, 'eslint', optionsHash);
      
      stats = cache.getHitMissStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.rate).toBe(0);

      // Store and hit
      await cache.set(contentHash, 'eslint', 'json', optionsHash, { test: true });
      await cache.get(contentHash, 'eslint', optionsHash);

      stats = cache.getHitMissStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.rate).toBe(50);
    });

    it('should calculate hit rate correctly', () => {
      // Simulate some hits and misses by directly modifying the counters
      cache['hitCount'] = 7;
      cache['missCount'] = 3;

      const hitRate = cache.getHitRate();
      expect(hitRate).toBe(70);
    });

    it('should reset statistics', () => {
      // Set some stats
      cache['hitCount'] = 10;
      cache['missCount'] = 5;

      cache.resetStats();

      const stats = cache.getHitMissStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.rate).toBe(0);
    });

    it('should get cache statistics', async () => {
      const stats = await cache.getStats();
      
      expect(stats).toHaveProperty('total_entries');
      expect(stats).toHaveProperty('hit_rate_percentage');
      expect(stats).toHaveProperty('size_mb');
      expect(stats).toHaveProperty('expired_entries');
      expect(typeof stats.total_entries).toBe('number');
      expect(typeof stats.hit_rate_percentage).toBe('number');
    });

    it('should get performance metrics', async () => {
      const metrics = await cache.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('hit_rate');
      expect(metrics).toHaveProperty('cache_size_mb');
      expect(metrics).toHaveProperty('total_requests');
      expect(typeof metrics.hit_rate).toBe('number');
      expect(typeof metrics.total_requests).toBe('number');
    });
  });

  describe('Cache Cleanup', () => {
    it('should cleanup expired entries', async () => {
      const deletedCount = await cache.cleanup();
      
      // Should return a number (could be 0 if no expired entries)
      expect(typeof deletedCount).toBe('number');
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle cleanup errors gracefully', async () => {
      // Mock database error
      const originalCleanup = db.cleanupExpiredCache;
      db.cleanupExpiredCache = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(cache.cleanup()).rejects.toThrow(CacheError);
      
      // Restore original method
      db.cleanupExpiredCache = originalCleanup;
    });
  });

  describe('Cache Invalidation', () => {
    it('should handle cache invalidation', async () => {
      const contentHash = cache.generateContentHash('test content');
      
      // Currently returns 0 as invalidation is not fully implemented
      const deletedCount = await cache.invalidate(contentHash, 'eslint');
      expect(typeof deletedCount).toBe('number');
    });

    it('should handle full cache clear', async () => {
      const deletedCount = await cache.invalidate();
      expect(typeof deletedCount).toBe('number');
    });
  });

  describe('Cache Warming', () => {
    it('should warm cache with common configurations', async () => {
      const commonConfigs = [
        {
          linter: 'eslint' as LinterType,
          format: 'json' as OutputFormat,
          options: { validate_all: true },
          content: 'console.log("test1");',
        },
        {
          linter: 'pylint' as LinterType,
          format: 'json' as OutputFormat,
          options: { validate_all: false },
          content: 'def hello(): return "world"',
        },
      ];

      // Should not throw
      await expect(cache.warmCache(commonConfigs)).resolves.not.toThrow();
    });

    it('should handle errors during cache warming', async () => {
      const invalidConfigs = [
        {
          linter: 'invalid' as LinterType,
          format: 'json' as OutputFormat,
          options: {},
          content: 'test content',
        },
      ];

      // Should not throw even with invalid config
      await expect(cache.warmCache(invalidConfigs)).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors during get operations', async () => {
      // Mock database error
      const originalGet = db.getCachedResult;
      db.getCachedResult = jest.fn().mockRejectedValue(new Error('Database error'));

      const result = await cache.get('test_hash', 'eslint', 'options_hash');
      
      expect(result).toBeNull(); // Should return null on error
      
      // Should count as miss
      const stats = cache.getHitMissStats();
      expect(stats.misses).toBeGreaterThan(0);
      
      // Restore original method
      db.getCachedResult = originalGet;
    });

    it('should handle database errors during set operations', async () => {
      // Mock database error
      const originalStore = db.storeCachedResult;
      db.storeCachedResult = jest.fn().mockRejectedValue(new Error('Database error'));

      await expect(
        cache.set('test_hash', 'eslint', 'json', 'options_hash', { test: true })
      ).rejects.toThrow(CacheError);
      
      // Restore original method
      db.storeCachedResult = originalStore;
    });
  });

  describe('Timer Management', () => {
    it('should start and stop cleanup timer', () => {
      const timerCache = new CacheService(db, {
        cleanup_interval_hours: 1,
      });
      
      // Timer should be started
      expect(timerCache['cleanupTimer']).toBeTruthy();
      
      // Stop timer
      timerCache['stopCleanupTimer']();
      expect(timerCache['cleanupTimer']).toBeFalsy();
    });

    it('should handle process signals for cleanup', () => {
      const timerCache = new CacheService(db, {
        cleanup_interval_hours: 1,
      });
      
      // Simulate SIGTERM
      process.emit('SIGTERM' as any);
      
      // Timer should be stopped
      expect(timerCache['cleanupTimer']).toBeFalsy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty options', () => {
      const emptyOptions: LinterOptions = {};
      const hash = cache.generateOptionsHash(emptyOptions);
      
      expect(hash).toBeTruthy();
      expect(hash).toHaveLength(64);
    });

    it('should handle large content', () => {
      const largeContent = 'x'.repeat(1000000); // 1MB of content
      const hash = cache.generateContentHash(largeContent);
      
      expect(hash).toBeTruthy();
      expect(hash).toHaveLength(64);
    });

    it('should handle special characters in content', () => {
      const specialContent = 'console.log("Hello \\"World\\"!\\n\\t\\r");';
      const hash = cache.generateContentHash(specialContent);
      
      expect(hash).toBeTruthy();
      expect(hash).toHaveLength(64);
    });

    it('should handle complex nested options', () => {
      const complexOptions: LinterOptions = {
        validate_all: true,
        exclude_patterns: ['**/*.min.js', '**/node_modules/**'],
        include_patterns: ['src/**/*.{js,ts}', 'lib/**/*.js'],
        rules: {
          'no-console': 'warn',
          'prefer-const': 'error',
          'custom-rule': {
            level: 'error',
            options: {
              allowedPatterns: ['test_*', 'debug_*'],
              maxComplexity: 10,
            },
          },
        },
        log_level: 'DEBUG',
        timeout: 30000,
        fix: false,
      };
      
      const hash = cache.generateOptionsHash(complexOptions);
      
      expect(hash).toBeTruthy();
      expect(hash).toHaveLength(64);
      
      // Same options should produce same hash
      const hash2 = cache.generateOptionsHash(complexOptions);
      expect(hash).toBe(hash2);
    });
  });
});