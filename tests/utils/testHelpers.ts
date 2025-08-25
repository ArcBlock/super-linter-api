import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { DatabaseService } from '../../src/services/database';

/**
 * Test utilities for Super-linter API tests
 */

export class TestHelpers {
  private static testDbs: Set<string> = new Set();

  /**
   * Create a test database with a unique name
   */
  static async createTestDatabase(): Promise<DatabaseService> {
    const dbName = `test_${randomBytes(8).toString('hex')}.db`;
    const dbPath = join(process.cwd(), 'data', dbName);
    this.testDbs.add(dbPath);

    const db = new DatabaseService(dbPath);
    await db.initialize();
    return db;
  }

  /**
   * Clean up all test databases
   */
  static async cleanupTestDatabases(): Promise<void> {
    for (const dbPath of this.testDbs) {
      try {
        await fs.unlink(dbPath);
      } catch (error) {
        // Ignore errors if file doesn't exist
      }
    }
    this.testDbs.clear();
  }

  /**
   * Create a test workspace directory
   */
  static async createTestWorkspace(): Promise<string> {
    const workspaceName = `test_ws_${randomBytes(8).toString('hex')}`;
    const workspacePath = join(process.cwd(), 'tmp', workspaceName);
    await fs.mkdir(workspacePath, { recursive: true });
    return workspacePath;
  }

  /**
   * Clean up a test workspace
   */
  static async cleanupTestWorkspace(workspacePath: string): Promise<void> {
    try {
      await fs.rm(workspacePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors if directory doesn't exist
    }
  }

  /**
   * Create sample test files
   */
  static async createTestFiles(workspacePath: string): Promise<void> {
    const files = {
      'test.js': `
console.log("Hello, World!");
function add(a, b) {
  return a + b;
}
module.exports = { add };
      `.trim(),
      'test.py': `
def greet(name):
    return f"Hello, {name}!"

if __name__ == "__main__":
    print(greet("World"))
      `.trim(),
      'test.ts': `
interface User {
  name: string;
  age: number;
}

function createUser(name: string, age: number): User {
  return { name, age };
}

export { User, createUser };
      `.trim(),
      '.eslintrc.json': JSON.stringify({
        "env": {
          "node": true,
          "es2021": true
        },
        "extends": ["eslint:recommended"],
        "parserOptions": {
          "ecmaVersion": 12,
          "sourceType": "module"
        },
        "rules": {}
      }, null, 2)
    };

    for (const [filename, content] of Object.entries(files)) {
      await fs.writeFile(join(workspacePath, filename), content);
    }
  }

  /**
   * Create a test tar.gz archive
   */
  static async createTestArchive(workspacePath: string): Promise<Buffer> {
    const tar = require('tar');
    const { promisify } = require('util');
    const { gzip } = require('zlib');

    // Create tar buffer
    const tarBuffer = await tar.c(
      {
        gzip: true,
        cwd: workspacePath,
        prefix: 'workspace/'
      },
      await fs.readdir(workspacePath)
    );

    return tarBuffer;
  }

  /**
   * Generate test content hash
   */
  static generateTestContentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Sleep for testing async operations
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Mock environment variables
   */
  static mockEnv(env: Record<string, string>): () => void {
    const originalEnv = { ...process.env };
    
    Object.assign(process.env, env);

    return () => {
      process.env = originalEnv;
    };
  }

  /**
   * Validate API response structure
   */
  static validateApiResponse(response: any, expectedStructure: any): boolean {
    for (const key in expectedStructure) {
      if (!(key in response)) {
        return false;
      }
      if (typeof expectedStructure[key] === 'object' && expectedStructure[key] !== null) {
        if (!this.validateApiResponse(response[key], expectedStructure[key])) {
          return false;
        }
      }
    }
    return true;
  }
}