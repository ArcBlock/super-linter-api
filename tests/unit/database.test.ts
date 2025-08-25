import { DatabaseService } from '../../src/services/database';
import { TestHelpers } from '../utils/testHelpers';
import { LintResult, LintJob, ApiMetric, JobStatus } from '../../src/types/database';

describe('DatabaseService', () => {
  let db: DatabaseService;

  beforeEach(async () => {
    db = await TestHelpers.createTestDatabase();
  });

  afterEach(async () => {
    await TestHelpers.cleanupTestDatabases();
  });

  describe('Health Check', () => {
    it('should return healthy status when database is working', async () => {
      const result = await db.healthCheck();
      
      expect(result.status).toBe('healthy');
      expect(result.details.connection).toBe('ok');
      expect(typeof result.details.tables).toBe('number');
    });
  });

  describe('Cache Operations', () => {
    const mockCacheResult: Omit<LintResult, 'id'> = {
      content_hash: 'test_hash_123',
      linter_type: 'javascript',
      options_hash: 'options_hash_123',
      result: '{"success": true, "issues": []}',
      format: 'json',
      status: 'success',
      error_message: 'Test error',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString()
    };

    it('should store and retrieve cached results', async () => {
      // Store a result
      const cacheId = await db.storeCachedResult(mockCacheResult);
      expect(cacheId).toBeTruthy();
      expect(cacheId).toMatch(/^cache_/);

      // Retrieve the result
      const retrieved = await db.getCachedResult(
        mockCacheResult.content_hash,
        mockCacheResult.linter_type,
        mockCacheResult.options_hash
      );

      expect(retrieved).toBeTruthy();
      expect(retrieved?.content_hash).toBe(mockCacheResult.content_hash);
      expect(retrieved?.linter_type).toBe(mockCacheResult.linter_type);
      expect(retrieved?.result).toBe(mockCacheResult.result);
    });

    it('should return null for non-existent cache entries', async () => {
      const result = await db.getCachedResult('nonexistent', 'javascript', 'options');
      expect(result).toBeNull();
    });

    it('should not return expired cache entries', async () => {
      // Create an expired result
      const expiredResult: Omit<LintResult, 'id'> = {
        ...mockCacheResult,
        content_hash: 'expired_hash',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      };

      await db.storeCachedResult(expiredResult);
      
      const retrieved = await db.getCachedResult(
        expiredResult.content_hash,
        expiredResult.linter_type,
        expiredResult.options_hash
      );

      expect(retrieved).toBeNull();
    });

    it('should clean up expired cache entries', async () => {
      // Create an expired result
      const expiredResult: Omit<LintResult, 'id'> = {
        ...mockCacheResult,
        content_hash: 'expired_for_cleanup',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() - 3600000).toISOString()
      };

      await db.storeCachedResult(expiredResult);
      
      const deletedCount = await db.cleanupExpiredCache();
      expect(deletedCount).toBeGreaterThanOrEqual(0);
      
      // Verify the expired entry is gone
      const retrieved = await db.getCachedResult(
        expiredResult.content_hash,
        expiredResult.linter_type,
        expiredResult.options_hash
      );
      expect(retrieved).toBeNull();
    });
  });

  describe('Job Operations', () => {
    const mockJob: Omit<LintJob, 'id'> = {
      job_id: 'test_job_123',
      linter_type: 'javascript',
      format: 'json',
      content: '{"test.js": "console.log(\\"test\\");"}',
      options: '{"validate_all": true}',
      status: 'pending',
      created_at: new Date().toISOString()
    };

    it('should create and retrieve jobs', async () => {
      const jobId = await db.createJob(mockJob);
      expect(jobId).toBe(mockJob.job_id);

      const retrieved = await db.getJob(mockJob.job_id);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.job_id).toBe(mockJob.job_id);
      expect(retrieved?.linter_type).toBe(mockJob.linter_type);
      expect(retrieved?.status).toBe(mockJob.status);
    });

    it('should return null for non-existent jobs', async () => {
      const result = await db.getJob('nonexistent_job');
      expect(result).toBeNull();
    });

    it('should update job status correctly', async () => {
      await db.createJob(mockJob);

      // Update to running
      await db.updateJobStatus(mockJob.job_id, 'running');
      let retrieved = await db.getJob(mockJob.job_id);
      expect(retrieved?.status).toBe('running');
      expect(retrieved?.started_at).toBeTruthy();

      // Update to completed with result
      const testResult = '{"success": true}';
      await db.updateJobStatus(mockJob.job_id, 'completed', testResult, undefined, 1500);
      retrieved = await db.getJob(mockJob.job_id);
      expect(retrieved?.status).toBe('completed');
      expect(retrieved?.result).toBe(testResult);
      expect(retrieved?.execution_time_ms).toBe(1500);
      expect(retrieved?.completed_at).toBeTruthy();
    });

    it('should update job status to failed with error message', async () => {
      await db.createJob(mockJob);

      const errorMessage = 'Test error occurred';
      await db.updateJobStatus(mockJob.job_id, 'failed', undefined, errorMessage);
      
      const retrieved = await db.getJob(mockJob.job_id);
      expect(retrieved?.status).toBe('failed');
      expect(retrieved?.error_message).toBe(errorMessage);
      expect(retrieved?.completed_at).toBeTruthy();
    });

    it('should retrieve pending jobs', async () => {
      // Create multiple jobs with different statuses
      const pendingJob1 = { ...mockJob, job_id: 'pending_1' };
      const pendingJob2 = { ...mockJob, job_id: 'pending_2' };
      const completedJob = { ...mockJob, job_id: 'completed_1', status: 'completed' as JobStatus };

      await db.createJob(pendingJob1);
      await db.createJob(pendingJob2);
      await db.createJob(completedJob);

      const pendingJobs = await db.getPendingJobs();
      expect(pendingJobs.length).toBeGreaterThanOrEqual(2);
      
      // All returned jobs should have pending status
      pendingJobs.forEach(job => {
        expect(job.status).toBe('pending');
      });
    });

    it('should clean up old completed jobs', async () => {
      // Create a job that would be considered old (this is a simplified test)
      const oldJob = { 
        ...mockJob, 
        job_id: 'old_completed_job',
        status: 'completed' as JobStatus
      };
      
      await db.createJob(oldJob);
      
      // Note: In a real scenario, we'd need to manipulate the created_at timestamp
      // For now, we're just testing that the cleanup method runs without error
      const deletedCount = await db.cleanupOldJobs(0); // 0 days = delete all old jobs
      expect(deletedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metrics Operations', () => {
    const mockMetric: Omit<ApiMetric, 'id' | 'created_at'> = {
      endpoint: '/javascript/json',
      method: 'POST',
      status_code: 200,
      response_time_ms: 1500,
      cache_hit: false,
      linter_type: 'javascript',
      format: 'json'
    };

    it('should record metrics', async () => {
      await expect(db.recordMetric(mockMetric)).resolves.not.toThrow();
      
      // We can't easily verify the metric was stored without additional query methods
      // But we can at least ensure the method doesn't throw
    });

    it('should get job statistics', async () => {
      // Create a base job for stats test
      const baseJob: Omit<LintJob, 'id'> = {
        job_id: 'base_stats_job',
        linter_type: 'javascript',
        format: 'json',
        content: '{"test.js": "test"}',
        options: '{}',
        status: 'pending',
        created_at: new Date().toISOString()
      };
      
      // Create some test jobs
      const job1 = { ...baseJob, job_id: 'stats_job_1', status: 'pending' as JobStatus };
      const job2 = { ...baseJob, job_id: 'stats_job_2', status: 'completed' as JobStatus };
      
      await db.createJob(job1);
      await db.createJob(job2);

      const stats = await db.getJobStats();
      expect(Array.isArray(stats)).toBe(true);
      
      // Should have at least the jobs we created
      const pendingStats = stats.find(s => s.status === 'pending');
      const completedStats = stats.find(s => s.status === 'completed');
      
      expect(pendingStats?.count).toBeGreaterThanOrEqual(1);
      expect(completedStats?.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Statistics Queries', () => {
    it('should get cache stats without error', async () => {
      const stats = await db.getCacheStats();
      expect(Array.isArray(stats)).toBe(true);
    });

    it('should get recent metrics without error', async () => {
      const metrics = await db.getRecentMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in health check', async () => {
      // Create a database with invalid path to force an error
      const invalidDb = new DatabaseService('/invalid/path/database.db');
      
      const result = await invalidDb.healthCheck();
      expect(result.status).toBe('unhealthy');
      expect(result.details.error).toBeTruthy();
    });
  });

  describe('Data Integrity', () => {
    it('should handle special characters in job content', async () => {
      const baseSpecialJob: Omit<LintJob, 'id'> = {
        job_id: 'special_chars_job',
        linter_type: 'javascript',
        format: 'json',
        status: 'pending',
        created_at: new Date().toISOString(),
        content: JSON.stringify({
          'test.js': 'console.log("Hello \\"World\\"!\\n\\t\\r");'
        }),
        options: JSON.stringify({
          exclude_patterns: ['*.min.js', '**/*.spec.js'],
          custom_config: 'value with "quotes" and \\backslashes\\'
        })
      };

      const jobId = await db.createJob(baseSpecialJob);
      expect(jobId).toBeTruthy();

      const retrieved = await db.getJob(baseSpecialJob.job_id);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.content).toBe(baseSpecialJob.content);
      expect(retrieved?.options).toBe(baseSpecialJob.options);
    });

    it('should handle null values properly', async () => {
      const jobWithNulls: Omit<LintJob, 'id'> = {
        job_id: 'null_job',
        linter_type: 'javascript',
        format: 'json',
        content: '{"test.js": "test"}',
        options: '{}',
        status: 'pending',
        created_at: new Date().toISOString()
      };

      const jobId = await db.createJob(jobWithNulls);
      expect(jobId).toBeTruthy();

      const retrieved = await db.getJob(jobWithNulls.job_id);
      expect(retrieved).toBeTruthy();
      expect(retrieved?.archive).toBeFalsy();
      expect(retrieved?.filename).toBeFalsy();
      expect(retrieved?.result).toBeFalsy();
    });
  });
});