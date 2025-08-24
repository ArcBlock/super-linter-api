import express from 'express';
import request from 'supertest';
import { createLinterRouter } from '../../src/routes/linter';
import { WorkspaceManager } from '../../src/services/workspace';
import { LinterRunner } from '../../src/services/linter';
import { CacheService } from '../../src/services/cache';
import { DatabaseService } from '../../src/services/database';
import { JobManager, JobRequest, JobResult } from '../../src/services/jobManager';
import { LinterType, LinterOptions } from '../../src/types/api';
import { inflateRawSync, deflateRawSync } from 'zlib';

// Simple in-memory fakes for integration tests
class FakeWorkspaceManager extends WorkspaceManager {
  constructor() {
    super(process.cwd() + '/test-custom-tmp');
  }
  override async createWorkspaceFromText(content: string, filename = 'code.txt') {
    return {
      path: this.getWorkspacePath('fake'),
      files: [filename],
      size_bytes: Buffer.byteLength(content),
      created_at: new Date().toISOString(),
      cleanup_at: new Date(Date.now() + 3600000).toISOString(),
    };
  }
  override async createWorkspaceFromBase64(encoded: string) {
    // Decode but do not write files for these tests
    const buf = Buffer.from(encoded, 'base64');
    const isGzip = buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;
    const content = isGzip ? inflateRawSync(buf).toString('utf-8') : buf.toString('utf-8');
    return this.createWorkspaceFromText(content, 'code.txt');
  }
  override async cleanupWorkspace(_: string) {
    // no-op
  }
}

class FakeLinterRunner extends LinterRunner {
  constructor(wm: WorkspaceManager) {
    super(wm);
  }
  override async runLinter(execution: { linter: LinterType; workspace_path: string; options: LinterOptions; timeout_ms: number; }) {
    // Return a deterministic fake result
    return {
      success: true,
      exit_code: 0,
      stdout: JSON.stringify([{ filePath: 'code.js', messages: [] }]),
      stderr: '',
      execution_time_ms: 12,
      parsed_output: [{ filePath: 'code.js', messages: [] }],
      file_count: 1,
      issues: [],
    };
  }
  override async getAllLinterStatus() {
    return {
      eslint: { available: true, version: '8.0.0' },
      pylint: { available: false },
      rubocop: { available: false },
      'golangci-lint': { available: false },
      shellcheck: { available: false },
      phpstan: { available: false },
      ktlint: { available: false },
      swiftlint: { available: false },
    } as any;
  }
}

class FakeCacheService extends CacheService {
  private store = new Map<string, any>();
  constructor() {
    // Pass a dummy DB, not used by these fakes
    super(new DatabaseService(process.cwd() + '/data/test-cache.db'));
  }
  override generateCacheKey(contentHash: string, linter: string, format: string, optionsHash: string) {
    return `${linter}:${format}:${contentHash}:${optionsHash}`;
  }
  override async get(contentHash: string, linter: any, optionsHash: string) {
    const key = this.generateCacheKey(contentHash, linter, 'json', optionsHash);
    return this.store.get(key) || null;
  }
  override async set(contentHash: string, linter: any, format: any, optionsHash: string, result: any) {
    const key = this.generateCacheKey(contentHash, linter, format, optionsHash);
    this.store.set(key, {
      content_hash: contentHash,
      linter_type: linter,
      options_hash: optionsHash,
      result: JSON.stringify(result),
      format,
      status: 'success',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    });
    return key;
  }
}

class FakeJobManager extends JobManager {
  private jobs = new Map<string, JobResult>();
  constructor(db: DatabaseService, wm: WorkspaceManager, lr: LinterRunner, cs: CacheService) {
    super(db, wm, lr, cs, { maxConcurrentJobs: 2, jobTimeoutMs: 30000 });
  }
  override async submitJob(request: JobRequest) {
    const id = `job_${Date.now()}`;
    this.jobs.set(id, {
      job_id: id,
      status: 'pending',
      created_at: new Date().toISOString(),
    } as any);
    // Simulate async completion shortly after
    setTimeout(() => {
      this.jobs.set(id, {
        job_id: id,
        status: 'completed',
        result: {
          success: true,
          exit_code: 0,
          stdout: '',
          stderr: '',
          execution_time_ms: 5,
          file_count: 1,
          issues: [],
        },
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        execution_time_ms: 5,
      });
    }, 25);
    return id;
  }
  override async getJobStatus(jobId: string) {
    return this.jobs.get(jobId) || null;
  }
  override async cancelJob(jobId: string) {
    if (!this.jobs.has(jobId)) return false;
    this.jobs.set(jobId, {
      job_id: jobId,
      status: 'cancelled',
      created_at: new Date().toISOString(),
    } as any);
    return true;
  }
  override async getJobStats() {
    // minimal
    return { running: 0, pending: 0, completed: 1, failed: 0, cancelled: 0 };
  }
  override async getRunningJobs() { return []; }
}

async function buildApp() {
  const app = express();
  app.use(express.json());

  const workspace = new FakeWorkspaceManager();
  const linter = new FakeLinterRunner(workspace);
  const cache = new FakeCacheService();
  const db = new DatabaseService(process.cwd() + '/data/test-int.db');
  await db.initialize();
  const jobs = new FakeJobManager(db, workspace, linter, cache);

  app.use(createLinterRouter(workspace, linter, cache, db, jobs));
  return app;
}

describe('Integration: Linter API routes', () => {
  let app: express.Application;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    // no-op
  });

  it('POST /eslint/json with content returns JSON result', async () => {
    const resp = await request(app)
      .post('/eslint/json')
      .send({ content: 'console.log(1)', filename: 'code.js', options: { timeout: 1000 } })
      .set('Content-Type', 'application/json');
    expect(resp.status).toBe(200);
    const body: any = resp.body;
    expect(body.success).toBe(true);
    expect(body.exit_code).toBe(0);
    expect(body.file_count).toBe(1);
  });

  it('GET /eslint/json/:encoded decodes deflate+base64 and returns result', async () => {
    const content = 'console.log(2)';
    const compressed = deflateRawSync(Buffer.from(content, 'utf-8')).toString('base64');
    const resp = await request(app).get(`/eslint/json/${encodeURIComponent(compressed)}`);
    expect(resp.status).toBe(200);
    const body: any = resp.body;
    expect(body.success).toBe(true);
    expect(body.exit_code).toBe(0);
  });

  it('POST uses cache on subsequent identical request', async () => {
    const payload = { content: 'console.log(3)', filename: 'code.js', options: { timeout: 1000 } };
    const r1 = await request(app).post('/eslint/json').send(payload).set('Content-Type', 'application/json');
    expect(r1.status).toBe(200);
    const r2 = await request(app).post('/eslint/json').send(payload).set('Content-Type', 'application/json');
    expect(r2.status).toBe(200);
    const body2: any = r2.body;
    expect(body2.success).toBe(true);
  });

  it('POST /eslint/json/async returns job id and job completes', async () => {
    const resp = await request(app)
      .post('/eslint/json/async')
      .send({ content: 'console.log(4)', filename: 'code.js', options: { timeout: 1000 } })
      .set('Content-Type', 'application/json');
    expect(resp.status).toBe(202);
    const body: any = resp.body;
    expect(body.job_id).toBeTruthy();

    // Poll status
    let status = 'pending';
    for (let i = 0; i < 10 && status !== 'completed'; i++) {
      await new Promise(r => setTimeout(r, 20));
      const s = await request(app).get(`/jobs/${body.job_id}`);
      const sb: any = s.body;
      status = sb.status;
    }
    const final = await request(app).get(`/jobs/${body.job_id}`);
    const finalBody: any = final.body;
    expect(finalBody.status).toBe('completed');
    expect(finalBody.result.success).toBe(true);
  });

  it('Validation error for invalid linter parameter', async () => {
    const resp = await request(app)
      .post('/invalidlinter/json')
      .send({ content: 'x', filename: 'code.js' })
      .set('Content-Type', 'application/json');
    expect(resp.status).toBe(400);
    const body: any = resp.body;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INVALID_PARAMETERS');
  });

  it('Validation error when POST missing content and archive', async () => {
    const resp = await request(app)
      .post('/eslint/json')
      .send({ options: {} })
      .set('Content-Type', 'application/json');
    expect(resp.status).toBe(400);
    const body: any = resp.body;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
