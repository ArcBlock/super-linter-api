import { createHash } from 'crypto';
import { DatabaseService } from './database';
import { LinterType, OutputFormat, LinterOptions } from '../types/api';
import { LintResult } from '../types/database';
import { CacheError } from '../types/errors';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export interface CacheStats {
  total_entries: number;
  hit_rate_percentage: number;
  size_mb: number;
  expired_entries: number;
  oldest_entry?: string;
  newest_entry?: string;
}

export interface CacheOptions {
  default_ttl_hours?: number;
  max_entries?: number;
  cleanup_interval_hours?: number;
}

export class CacheService {
  private db: DatabaseService;
  private defaultTtlHours: number;
  private maxEntries: number;
  private cleanupTimer?: NodeJS.Timeout;
  private hitCount: number;
  private missCount: number;
  private memoryCache: Map<string, LintResult>;

  constructor(db: DatabaseService, options: CacheOptions = {}) {
    this.db = db;
    this.defaultTtlHours = options.default_ttl_hours || 24; // 24 hours default
    this.maxEntries = options.max_entries || 100000; // 100k entries max
    this.hitCount = 0;
    this.missCount = 0;
    this.memoryCache = new Map();

    // Start cleanup timer
    if (options.cleanup_interval_hours) {
      this.startCleanupTimer(options.cleanup_interval_hours);
    }

    // Cleanup on process exit
    process.on('SIGTERM', () => this.stopCleanupTimer());
    process.on('SIGINT', () => this.stopCleanupTimer());
  }

  generateContentHash(content: string | Buffer): string {
    const hash = createHash('sha256');
    if (typeof content === 'string') {
      hash.update(content, 'utf-8');
    } else {
      hash.update(content);
    }
    return hash.digest('hex');
  }

  generateOptionsHash(options: LinterOptions): string {
    // Create a normalized version of options for consistent hashing
    const normalized = {
      validate_all: options.validate_all || false,
      exclude_patterns: (options.exclude_patterns || []).sort(),
      include_patterns: (options.include_patterns || []).sort(),
      log_level: options.log_level || 'INFO',
      timeout: options.timeout || 30000,
      fix: options.fix || false,
      config_file: options.config_file || '',
      rules: options.rules || {},
    };

    return createHash('sha256')
      .update(JSON.stringify(normalized, Object.keys(normalized).sort()))
      .digest('hex');
  }

  generateCacheKey(
    contentHash: string,
    linter: LinterType,
    format: OutputFormat,
    optionsHash: string
  ): string {
    return `${linter}:${format}:${contentHash}:${optionsHash}`;
  }

  private calculateExpiresAt(ttlHours?: number): string {
    const hours = ttlHours || this.defaultTtlHours;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    return expiresAt.toISOString();
  }

  async get(
    contentHash: string,
    linter: LinterType,
    optionsHash: string
  ): Promise<LintResult | null> {
    try {
      const memKey = `${contentHash}:${linter}:${optionsHash}`;
      const inMem = this.memoryCache.get(memKey);
      if (inMem) {
        // Ensure not expired
        if (new Date(inMem.expires_at).getTime() > Date.now()) {
          this.hitCount++;
          return inMem;
        } else {
          this.memoryCache.delete(memKey);
        }
      }
      const result = await this.db.getCachedResult(contentHash, linter, optionsHash);

      if (result) {
        this.hitCount++;
        logger.debug('Cache hit', {
          linter,
          contentHash: contentHash.substring(0, 8),
          optionsHash: optionsHash.substring(0, 8),
        });
        // Store to in-memory cache to speed immediate subsequent reads
        this.memoryCache.set(memKey, result);
        return result;
      } else {
        this.missCount++;
        logger.debug('Cache miss', {
          linter,
          contentHash: contentHash.substring(0, 8),
          optionsHash: optionsHash.substring(0, 8),
        });
        return null;
      }
    } catch (error: any) {
      logger.warn('Cache get failed', {
        error: error.message,
        linter,
        contentHash: contentHash.substring(0, 8),
      });
      this.missCount++; // Count as miss if cache fails
      return null;
    }
  }

  async set(
    contentHash: string,
    linter: LinterType,
    format: OutputFormat,
    optionsHash: string,
    result: any,
    status: 'success' | 'error' | 'timeout' = 'success',
    errorMessage?: string,
    ttlHours?: number
  ): Promise<string> {
    try {
      const cacheEntry: Omit<LintResult, 'id'> = {
        content_hash: contentHash,
        linter_type: linter,
        options_hash: optionsHash,
        result: typeof result === 'string' ? result : JSON.stringify(result),
        format,
        status,
        error_message: errorMessage || (undefined as any),
        created_at: new Date().toISOString(),
        expires_at: this.calculateExpiresAt(ttlHours),
      };

      const id = await this.db.storeCachedResult(cacheEntry);
      const memKey = `${contentHash}:${linter}:${optionsHash}`;
      this.memoryCache.set(memKey, {
        id,
        ...cacheEntry,
      } as LintResult);

      logger.debug('Cache set', {
        id,
        linter,
        format,
        status,
        contentHash: contentHash.substring(0, 8),
        optionsHash: optionsHash.substring(0, 8),
        expires_at: cacheEntry.expires_at,
      });

      // Check if we need to cleanup old entries
      await this.enforceMaxEntries();

      return id;
    } catch (error: any) {
      logger.error('Cache set failed', {
        error: error.message,
        linter,
        contentHash: contentHash.substring(0, 8),
      });
      throw new CacheError(`Failed to store cache entry: ${error.message}`, {
        linter,
        contentHash,
        error: error.message,
      });
    }
  }

  async invalidate(contentHash?: string, linter?: LinterType): Promise<number> {
    try {
      let deletedCount = 0;

      if (contentHash && linter) {
        // Invalidate entries for specific content+linter
        logger.info('Invalidating cache entries for content+linter', { contentHash, linter });
        deletedCount = await this.db.clearCacheByContentAndLinter(contentHash, linter);
      } else if (contentHash) {
        // Invalidate all entries for specific content
        logger.info('Invalidating cache entries for content', { contentHash });
        deletedCount = await this.db.clearCacheByContent(contentHash);
      } else if (linter) {
        // Invalidate all entries for specific linter
        logger.info('Invalidating cache entries for linter', { linter });
        deletedCount = await this.db.clearCacheByLinter(linter);
      } else {
        // Clear all cache
        logger.info('Clearing all cache entries');
        deletedCount = await this.db.clearAllCache();
      }

      return deletedCount;
    } catch (error: any) {
      logger.error('Cache invalidation failed', { error: error.message });
      throw new CacheError(`Failed to invalidate cache: ${error.message}`);
    }
  }

  async cleanup(): Promise<number> {
    try {
      const deletedCount = await this.db.cleanupExpiredCache();

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} expired cache entries`);
      }

      return deletedCount;
    } catch (error: any) {
      logger.error('Cache cleanup failed', { error: error.message });
      throw new CacheError(`Failed to cleanup cache: ${error.message}`);
    }
  }

  private async enforceMaxEntries(): Promise<void> {
    try {
      // This is a simplified implementation
      // In a real scenario, you'd want to implement LRU or similar strategy
      const stats = await this.getStats();

      if (stats.total_entries > this.maxEntries) {
        const excessEntries = stats.total_entries - this.maxEntries;
        logger.warn(
          `Cache exceeds max entries (${stats.total_entries} > ${this.maxEntries}), should cleanup ${excessEntries} entries`
        );

        // For now, just cleanup expired entries
        await this.cleanup();
      }
    } catch (error: any) {
      logger.warn('Failed to enforce max entries', { error: error.message });
    }
  }

  async getStats(): Promise<CacheStats> {
    try {
      const cacheStats = await this.db.getCacheStats();

      // Aggregate stats from database results
      let totalEntries = 0;
      const sizeMb = 0;

      for (const stat of cacheStats) {
        totalEntries += stat.total_cached || 0;
      }

      const hitRate =
        this.hitCount + this.missCount > 0
          ? (this.hitCount / (this.hitCount + this.missCount)) * 100
          : 0;

      return {
        total_entries: totalEntries,
        hit_rate_percentage: Math.round(hitRate * 100) / 100,
        size_mb: sizeMb, // TODO: Calculate actual size
        expired_entries: 0, // TODO: Count expired entries
      };
    } catch (error: any) {
      logger.error('Failed to get cache stats', { error: error.message });
      throw new CacheError(`Failed to get cache stats: ${error.message}`);
    }
  }

  getHitRate(): number {
    const total = this.hitCount + this.missCount;
    return total > 0 ? (this.hitCount / total) * 100 : 0;
  }

  getHitMissStats(): { hits: number; misses: number; rate: number } {
    return {
      hits: this.hitCount,
      misses: this.missCount,
      rate: this.getHitRate(),
    };
  }

  resetStats(): void {
    this.hitCount = 0;
    this.missCount = 0;
    logger.info('Cache statistics reset');
  }

  private startCleanupTimer(intervalHours: number): void {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    this.cleanupTimer = setInterval(async () => {
      try {
        logger.debug('Running scheduled cache cleanup');
        await this.cleanup();
      } catch (error: any) {
        logger.error('Scheduled cache cleanup failed', { error: error.message });
      }
    }, intervalMs);

    logger.info(`Cache cleanup timer started (every ${intervalHours} hours)`);
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined as any;
      logger.info('Cache cleanup timer stopped');
    }
  }

  // Cache warming functionality
  async warmCache(
    commonConfigs: Array<{
      linter: LinterType;
      format: OutputFormat;
      options: LinterOptions;
      content: string;
    }>
  ): Promise<void> {
    logger.info(`Warming cache with ${commonConfigs.length} configurations`);

    for (const config of commonConfigs) {
      try {
        const contentHash = this.generateContentHash(config.content);
        const optionsHash = this.generateOptionsHash(config.options);

        // Check if already cached
        const existing = await this.get(contentHash, config.linter, optionsHash);
        if (!existing) {
          // This would be called by the actual linter service
          logger.debug('Cache warming placeholder', {
            linter: config.linter,
            format: config.format,
          });
        }
      } catch (error: any) {
        logger.warn('Cache warming failed for config', {
          linter: config.linter,
          error: error.message,
        });
      }
    }
  }

  // Performance monitoring
  async getPerformanceMetrics(): Promise<{
    hit_rate: number;
    avg_response_time_ms?: number;
    cache_size_mb: number;
    total_requests: number;
  }> {
    const stats = await this.getStats();

    return {
      hit_rate: this.getHitRate(),
      cache_size_mb: stats.size_mb,
      total_requests: this.hitCount + this.missCount,
    };
  }
}
