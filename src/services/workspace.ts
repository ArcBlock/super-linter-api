import { promises as fs } from 'fs';
import { existsSync, mkdirSync } from 'fs';
import { join, resolve, relative } from 'path';
import { extract as Extract } from 'tar';
import { createGunzip } from 'zlib';
import { createHash } from 'crypto';
import { WorkspaceError, ContentTooLargeError } from '../types/errors';
import { WorkspaceInfo } from '../types/linter';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export class WorkspaceManager {
  private baseDir: string;
  private maxFileSize: number;
  private maxTotalSize: number;
  private maxFiles: number;
  private allowedExtensions: Set<string>;
  private blockedPaths: Set<string>;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || join(process.cwd(), 'tmp');
    this.maxFileSize = 10 * 1024 * 1024; // 10MB per file
    this.maxTotalSize = 500 * 1024 * 1024; // 500MB total
    this.maxFiles = 10000;

    this.allowedExtensions = new Set([
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.vue',
      '.py',
      '.pyi',
      '.rb',
      '.rake',
      '.go',
      '.rs',
      '.kt',
      '.kts',
      '.swift',
      '.sh',
      '.bash',
      '.zsh',
      '.fish',
      '.yml',
      '.yaml',
      '.json',
      '.md',
      '.markdown',
      '.html',
      '.htm',
      '.css',
      '.scss',
      '.sass',
      '.less',
      '.php',
      '.c',
      '.cpp',
      '.cc',
      '.cxx',
      '.h',
      '.hpp',
      '.java',
      '.dockerfile',
      '.xml',
      '.toml',
      '.ini',
      '.cfg',
      '.conf',
      '.txt',
      '.log',
    ]);

    this.blockedPaths = new Set([
      'node_modules',
      '.git',
      '.svn',
      '.hg',
      'vendor',
      'dist',
      'build',
      'target',
      '.idea',
      '.vscode',
      '__pycache__',
      '.pytest_cache',
      'coverage',
      '.nyc_output',
    ]);

    this.ensureBaseDir();
  }

  private ensureBaseDir(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  private generateWorkspaceId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isPathSafe(filePath: string): boolean {
    const normalizedPath = resolve(filePath);
    const normalizedBaseDir = resolve(this.baseDir);
    const relativePath = relative(normalizedBaseDir, normalizedPath);

    // Path must be within base directory
    if (
      relativePath.startsWith('..') ||
      relative(normalizedBaseDir, normalizedPath).startsWith('..')
    ) {
      return false;
    }

    // Check for blocked directory names
    const pathParts = relativePath.split('/').filter(Boolean);
    return !pathParts.some(part => this.blockedPaths.has(part));
  }

  private isExtensionAllowed(filename: string): boolean {
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return this.allowedExtensions.has(ext) || filename.toLowerCase() === 'dockerfile';
  }

  async createWorkspaceFromBuffer(
    content: Buffer,
    contentType: 'tar.gz' | 'text' = 'text'
  ): Promise<WorkspaceInfo> {
    const workspaceId = this.generateWorkspaceId();
    const workspacePath = join(this.baseDir, workspaceId);

    try {
      await fs.mkdir(workspacePath, { recursive: true });

      if (contentType === 'tar.gz') {
        return await this.extractTarGz(content, workspacePath, workspaceId);
      } else {
        return await this.createSingleFileWorkspace(content, workspacePath, workspaceId);
      }
    } catch (error: any) {
      // Cleanup on error
      await this.cleanupWorkspace(workspacePath).catch(() => {});
      throw new WorkspaceError(`Failed to create workspace: ${error.message}`, {
        workspaceId,
        error: error.message,
      });
    }
  }

  private async createSingleFileWorkspace(
    content: Buffer,
    workspacePath: string,
    workspaceId: string
  ): Promise<WorkspaceInfo> {
    if (content.length > this.maxFileSize) {
      throw new ContentTooLargeError('File too large', this.maxFileSize, content.length);
    }

    const filename = 'code.txt'; // Default filename for single file
    const filePath = join(workspacePath, filename);

    await fs.writeFile(filePath, content);

    return {
      path: workspacePath,
      files: [filename],
      size_bytes: content.length,
      created_at: new Date().toISOString(),
      cleanup_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    };
  }

  private async extractTarGz(
    content: Buffer,
    workspacePath: string,
    workspaceId: string
  ): Promise<WorkspaceInfo> {
    if (content.length > this.maxTotalSize) {
      throw new ContentTooLargeError('Archive too large', this.maxTotalSize, content.length);
    }

    const files: string[] = [];
    let totalSize = 0;
    let fileCount = 0;

    return new Promise((resolve, reject) => {
      const extractStream = Extract({
        cwd: workspacePath,
        strict: true,
        filter: (path: string, entry: any) => {
          // Security checks
          if (!this.isPathSafe(join(workspacePath, path))) {
            logger.warn(`Blocked unsafe path: ${path}`);
            return false;
          }

          // File count limit
          if (fileCount >= this.maxFiles) {
            reject(new WorkspaceError(`Too many files in archive (max: ${this.maxFiles})`));
            return false;
          }

          // File size limit
          if (entry.size > this.maxFileSize) {
            reject(
              new ContentTooLargeError(`File too large: ${path}`, this.maxFileSize, entry.size)
            );
            return false;
          }

          // Total size limit
          if (totalSize + entry.size > this.maxTotalSize) {
            reject(
              new ContentTooLargeError(
                'Archive contents too large',
                this.maxTotalSize,
                totalSize + entry.size
              )
            );
            return false;
          }

          // Extension check
          if (entry.type === 'File' && !this.isExtensionAllowed(path)) {
            logger.debug(`Skipping file with unsupported extension: ${path}`);
            return false;
          }

          if (entry.type === 'File') {
            files.push(path);
            totalSize += entry.size;
            fileCount++;
          }

          return true;
        },
      });

      const gunzip = createGunzip();

      extractStream.on('error', (error: Error) => {
        reject(
          new WorkspaceError(`Failed to extract archive: ${error.message}`, {
            workspaceId,
            error: error.message,
          })
        );
      });

      gunzip.on('error', (error: Error) => {
        reject(
          new WorkspaceError(`Failed to decompress archive: ${error.message}`, {
            workspaceId,
            error: error.message,
          })
        );
      });

      extractStream.on('end', () => {
        resolve({
          path: workspacePath,
          files,
          size_bytes: totalSize,
          created_at: new Date().toISOString(),
          cleanup_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        });
      });

      // Create pipeline: Buffer -> Gunzip -> Extract
      const bufferStream = require('stream').Readable.from([content]);
      bufferStream.pipe(gunzip).pipe(extractStream);
    });
  }

  async createWorkspaceFromBase64(encodedContent: string): Promise<WorkspaceInfo> {
    try {
      // Validate base64 encoding
      if (!/^[A-Za-z0-9+/]+=*$/.test(encodedContent)) {
        throw new WorkspaceError('Invalid base64 encoding');
      }

      const buffer = Buffer.from(encodedContent, 'base64');

      // Try to detect if it's a gzipped tar archive
      const isGzipped = buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b;

      return await this.createWorkspaceFromBuffer(buffer, isGzipped ? 'tar.gz' : 'text');
    } catch (error: any) {
      if (error instanceof WorkspaceError || error instanceof ContentTooLargeError) {
        throw error;
      }
      throw new WorkspaceError(`Failed to decode base64 content: ${error.message}`);
    }
  }

  async createWorkspaceFromText(content: string, filename = 'code.txt'): Promise<WorkspaceInfo> {
    const buffer = Buffer.from(content, 'utf-8');
    const workspaceInfo = await this.createWorkspaceFromBuffer(buffer, 'text');

    // Rename the file to the specified filename if provided
    if (filename !== 'code.txt') {
      const oldPath = join(workspaceInfo.path, 'code.txt');
      const newPath = join(workspaceInfo.path, filename);

      try {
        await fs.rename(oldPath, newPath);
        workspaceInfo.files = [filename];
      } catch (error: any) {
        logger.warn(`Failed to rename file: ${error.message}`);
      }
    }

    return workspaceInfo;
  }

  async getWorkspaceFiles(workspacePath: string): Promise<string[]> {
    try {
      const files: string[] = [];

      async function scanDirectory(dir: string, relativePath = ''): Promise<void> {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = join(dir, entry.name);
          const relPath = relativePath ? join(relativePath, entry.name) : entry.name;

          if (entry.isDirectory()) {
            await scanDirectory(fullPath, relPath);
          } else if (entry.isFile()) {
            files.push(relPath);
          }
        }
      }

      await scanDirectory(workspacePath);
      return files.sort();
    } catch (error: any) {
      throw new WorkspaceError(`Failed to scan workspace: ${error.message}`, {
        workspacePath,
        error: error.message,
      });
    }
  }

  async validateWorkspace(workspacePath: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Check if workspace exists
      const stats = await fs.stat(workspacePath);
      if (!stats.isDirectory()) {
        errors.push('Workspace path is not a directory');
        return { valid: false, errors };
      }

      // Check if workspace is within base directory
      if (!this.isPathSafe(workspacePath)) {
        errors.push('Workspace path is outside allowed directory');
        return { valid: false, errors };
      }

      // Get all files and validate
      const files = await this.getWorkspaceFiles(workspacePath);

      if (files.length === 0) {
        errors.push('Workspace contains no files');
      }

      if (files.length > this.maxFiles) {
        errors.push(`Too many files (${files.length} > ${this.maxFiles})`);
      }

      let totalSize = 0;
      for (const file of files) {
        const filePath = join(workspacePath, file);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;

          if (stats.size > this.maxFileSize) {
            errors.push(`File too large: ${file} (${stats.size} > ${this.maxFileSize})`);
          }

          if (!this.isExtensionAllowed(file)) {
            errors.push(`File extension not allowed: ${file}`);
          }
        } catch (error: any) {
          errors.push(`Cannot access file: ${file} - ${error.message}`);
        }
      }

      if (totalSize > this.maxTotalSize) {
        errors.push(`Total workspace too large (${totalSize} > ${this.maxTotalSize})`);
      }

      return { valid: errors.length === 0, errors };
    } catch (error: any) {
      errors.push(`Workspace validation failed: ${error.message}`);
      return { valid: false, errors };
    }
  }

  async cleanupWorkspace(workspacePath: string): Promise<void> {
    try {
      if (existsSync(workspacePath) && this.isPathSafe(workspacePath)) {
        await fs.rm(workspacePath, { recursive: true, force: true });
        logger.debug(`Cleaned up workspace: ${workspacePath}`);
      }
    } catch (error: any) {
      logger.warn(`Failed to cleanup workspace: ${workspacePath} - ${error.message}`);
      throw new WorkspaceError(`Cleanup failed: ${error.message}`, {
        workspacePath,
        error: error.message,
      });
    }
  }

  async cleanupExpiredWorkspaces(): Promise<number> {
    let cleanedCount = 0;

    try {
      const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
      const now = Date.now();

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('ws_')) {
          const workspacePath = join(this.baseDir, entry.name);

          try {
            const stats = await fs.stat(workspacePath);
            const age = now - stats.ctimeMs;

            // Clean up workspaces older than 2 hours
            if (age > 2 * 60 * 60 * 1000) {
              await this.cleanupWorkspace(workspacePath);
              cleanedCount++;
            }
          } catch (error) {
            logger.debug(`Failed to check workspace age: ${entry.name}`);
          }
        }
      }

      logger.info(`Cleaned up ${cleanedCount} expired workspaces`);
      return cleanedCount;
    } catch (error: any) {
      logger.error(`Failed to cleanup expired workspaces: ${error.message}`);
      throw new WorkspaceError(`Cleanup failed: ${error.message}`);
    }
  }

  generateContentHash(content: Buffer): string {
    return createHash('sha256').update(content).digest('hex');
  }

  getWorkspacePath(workspaceId: string): string {
    return join(this.baseDir, workspaceId);
  }
}
