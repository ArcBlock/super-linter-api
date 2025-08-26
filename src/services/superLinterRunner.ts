import { spawn } from 'child_process';
import winston from 'winston';
import { LinterType, LinterOptions } from '../types/api';
import { LinterExecution, LinterResult, LinterIssue } from '../types/linter';
import { LinterError, TimeoutError, WorkspaceError } from '../types/errors';
import { WorkspaceManager } from './workspace';
import { LinterRunner } from './linter';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

/**
 * Super-linter specific linter configurations
 * Maps our API linter types to Super-linter's command-line tools
 */
const SUPERLINTER_CONFIGS = {
  // JavaScript/TypeScript
  eslint: {
    executable: 'eslint',
    args: ['--format', 'json', '--config', '/action/lib/.automation/eslint.config.mjs'],
    outputFormat: 'json',
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  prettier: {
    executable: 'prettier',
    args: ['--check', '--list-different'],
    outputFormat: 'text',
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json', '.md', '.css'],
  },
  jshint: {
    executable: 'jshint',
    args: ['--reporter=json'],
    outputFormat: 'json',
    extensions: ['.js'],
  },

  // Python
  pylint: {
    executable: 'pylint',
    args: ['--output-format=json', '--score=no'],
    outputFormat: 'json',
    extensions: ['.py'],
  },
  flake8: {
    executable: 'flake8',
    args: ['--format=json'],
    outputFormat: 'text', // flake8 doesn't have native JSON output
    extensions: ['.py'],
  },
  black: {
    executable: 'black',
    args: ['--check', '--diff'],
    outputFormat: 'text',
    extensions: ['.py'],
  },
  isort: {
    executable: 'isort',
    args: ['--check-only', '--diff'],
    outputFormat: 'text',
    extensions: ['.py'],
  },
  bandit: {
    executable: 'bandit',
    args: ['--format', 'json'],
    outputFormat: 'json',
    extensions: ['.py'],
  },
  mypy: {
    executable: 'mypy',
    args: ['--show-error-codes', '--no-error-summary'],
    outputFormat: 'text',
    extensions: ['.py'],
  },

  // Shell
  shellcheck: {
    executable: 'shellcheck',
    args: ['--format=json'],
    outputFormat: 'json',
    extensions: ['.sh', '.bash', '.dash', '.ksh'],
  },

  // Go
  'golangci-lint': {
    executable: 'golangci-lint',
    args: ['run', '--out-format=json'],
    outputFormat: 'json',
    extensions: ['.go'],
  },
  gofmt: {
    executable: 'gofmt',
    args: ['-l', '-d'],
    outputFormat: 'text',
    extensions: ['.go'],
  },

  // Ruby
  rubocop: {
    executable: 'rubocop',
    args: ['--format', 'json'],
    outputFormat: 'json',
    extensions: ['.rb'],
  },

  // Docker
  hadolint: {
    executable: 'hadolint',
    args: ['--format', 'json'],
    outputFormat: 'json',
    extensions: ['Dockerfile', '.dockerfile'],
  },

  // YAML
  yamllint: {
    executable: 'yamllint',
    args: ['--format', 'parsable'],
    outputFormat: 'text',
    extensions: ['.yml', '.yaml'],
  },

  // JSON
  jsonlint: {
    executable: 'jsonlint',
    args: [],
    outputFormat: 'text',
    extensions: ['.json'],
  },

  // Markdown
  markdownlint: {
    executable: 'markdownlint',
    args: ['--json'],
    outputFormat: 'json',
    extensions: ['.md'],
  },

  // CSS
  stylelint: {
    executable: 'stylelint',
    args: ['--formatter', 'json'],
    outputFormat: 'json',
    extensions: ['.css', '.scss', '.sass'],
  },
} as const;

export class SuperLinterRunner extends LinterRunner {
  constructor(workspaceManager: WorkspaceManager) {
    super(workspaceManager);
  }

  override async runLinter(execution: LinterExecution): Promise<LinterResult> {
    const { linter, workspace_path, options, timeout_ms } = execution;
    const config = SUPERLINTER_CONFIGS[linter as keyof typeof SUPERLINTER_CONFIGS];

    if (!config) {
      // Fallback to parent class for unsupported linters
      logger.warn(
        `Linter ${linter} not configured for Super-linter, falling back to standard runner`
      );
      return super.runLinter(execution);
    }

    logger.info(`Running Super-linter: ${linter}`, { workspace_path, linter });

    // Validate workspace
    const validation = await this.workspaceManager.validateWorkspace(workspace_path);
    if (!validation.valid) {
      throw new WorkspaceError(`Invalid workspace: ${validation.errors.join(', ')}`);
    }

    // Get files to lint
    const allFiles = await this.workspaceManager.getWorkspaceFiles(workspace_path);
    logger.debug(`Found ${allFiles?.length || 0} files in workspace`, { allFiles });

    if (!allFiles) {
      throw new WorkspaceError('Failed to get workspace files');
    }

    const filteredFiles = this.filterFilesByExtensions(allFiles, [...config.extensions]);

    if (filteredFiles.length === 0) {
      return {
        success: true,
        exit_code: 0,
        stdout: '',
        stderr: '',
        execution_time_ms: 0,
        parsed_output: [],
        file_count: 0,
        issues: [],
      };
    }

    const startTime = Date.now();

    try {
      const result = await this.executeSuperlinter(
        config.executable,
        [...config.args, ...filteredFiles],
        workspace_path,
        timeout_ms,
        options
      );

      const execution_time_ms = Date.now() - startTime;

      // Parse the output based on format
      let parsed_output: any;
      let issues: LinterIssue[] = [];

      try {
        if (config.outputFormat === 'json' && result.stdout) {
          parsed_output = JSON.parse(result.stdout);
          issues = this.parseJsonOutput(linter, parsed_output);
        } else {
          parsed_output = result.stdout;
          issues = this.parseTextOutput(linter, result.stdout, filteredFiles);
        }
      } catch (parseError) {
        logger.warn(`Failed to parse ${linter} output`, { error: (parseError as Error).message });
        parsed_output = result.stdout;
        issues = [];
      }

      return {
        success: result.exit_code === 0,
        exit_code: result.exit_code,
        stdout: result.stdout,
        stderr: result.stderr,
        execution_time_ms,
        parsed_output,
        file_count: filteredFiles.length,
        issues,
      };
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }

      throw new LinterError(
        'LINTER_EXECUTION_FAILED',
        `Failed to execute ${linter}: ${(error as Error).message}`
      );
    }
  }

  /**
   * Execute linter with proper environment setup (helper method)
   */
  private async executeSuperlinter(
    executable: string,
    args: string[],
    workspacePath: string,
    timeoutMs: number,
    options: LinterOptions
  ): Promise<{ exit_code: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      logger.info(`Executing Super-linter command`, {
        executable,
        args,
        workspacePath,
        timeoutMs,
        cwd: workspacePath,
      });

      const childProcess = spawn(executable, args, {
        cwd: workspacePath,
        env: {
          ...process.env,
          // Super-linter environment variables
          RUN_LOCAL: 'true',
          DEFAULT_WORKSPACE: workspacePath,
          // Pass through any custom options as environment variables
          ...(options.log_level && { LOG_LEVEL: options.log_level }),
        },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
      });

      let stdout = '';
      let stderr = '';
      let finished = false;

      // Set up timeout
      const timeout = setTimeout(() => {
        if (!finished) {
          finished = true;
          childProcess.kill('SIGKILL');
          reject(new TimeoutError(`Linter execution timed out after ${timeoutMs}ms`, timeoutMs));
        }
      }, timeoutMs);

      // Collect output
      childProcess.stdout?.on('data', (data: any) => {
        const chunk = data.toString();
        stdout += chunk;
        logger.debug('ESLint stdout chunk', { chunk: chunk.substring(0, 200) });
      });

      childProcess.stderr?.on('data', (data: any) => {
        const chunk = data.toString();
        stderr += chunk;
        logger.debug('ESLint stderr chunk', { chunk: chunk.substring(0, 200) });
      });

      childProcess.on('close', (exit_code: any) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          logger.info('linter process completed', {
            exit_code,
            stdoutLength: stdout.length,
            stderrLength: stderr.length,
          });
          resolve({
            exit_code: exit_code || 0,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        }
      });

      childProcess.on('error', (error: any) => {
        if (!finished) {
          finished = true;
          clearTimeout(timeout);
          logger.error('linter process error', { error: error.message, code: error.code });
          reject(new LinterError('LINTER_EXECUTION_FAILED', `Process error: ${error.message}`));
        }
      });

      childProcess.on('spawn', () => {
        logger.info('linter process spawned successfully', { pid: childProcess.pid });
        // Close stdin to prevent hanging on input
        if (childProcess.stdin) {
          childProcess.stdin.end();
        }
      });

      childProcess.on('exit', (code: any, signal: any) => {
        logger.info('linter process exited', { code, signal, finished });
        if (!finished && code !== null) {
          finished = true;
          clearTimeout(timeout);
          resolve({
            exit_code: code,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
          });
        }
      });
    });
  }

  /**
   * Filter files by supported extensions
   */
  private filterFilesByExtensions(files: string[], extensions: string[]): string[] {
    return files.filter(file => {
      return extensions.some(ext => {
        if (ext.includes('.')) {
          return file.endsWith(ext);
        } else {
          // Handle special cases like 'Dockerfile'
          return file.includes(ext);
        }
      });
    });
  }

  /**
   * Parse JSON output into standardized issues
   */
  private parseJsonOutput(linter: LinterType, output: any): LinterIssue[] {
    const issues: LinterIssue[] = [];

    try {
      switch (linter) {
        case 'eslint':
          if (Array.isArray(output)) {
            output.forEach((file: any) => {
              if (file.messages) {
                file.messages.forEach((msg: any) => {
                  issues.push({
                    file: file.filePath || 'unknown',
                    line: msg.line,
                    column: msg.column,
                    rule: msg.ruleId,
                    severity: msg.severity === 2 ? 'error' : 'warning',
                    message: msg.message,
                    source: linter,
                  });
                });
              }
            });
          }
          break;

        case 'pylint':
          if (Array.isArray(output)) {
            output.forEach((issue: any) => {
              issues.push({
                file: issue.path || 'unknown',
                line: issue.line,
                column: issue.column,
                rule: issue['message-id'],
                severity: issue.type === 'error' ? 'error' : 'warning',
                message: issue.message,
                source: linter,
              });
            });
          }
          break;

        case 'shellcheck':
          if (Array.isArray(output)) {
            output.forEach((issue: any) => {
              issues.push({
                file: issue.file || 'unknown',
                line: issue.line,
                column: issue.column,
                rule: `SC${issue.code}`,
                severity: issue.level === 'error' ? 'error' : 'warning',
                message: issue.message,
                source: linter,
              });
            });
          }
          break;

        // Add more linter-specific parsing as needed
        default:
          // Generic JSON parsing attempt
          if (Array.isArray(output)) {
            output.forEach((item: any) => {
              if (item.message || item.description) {
                issues.push({
                  file: item.file || item.path || 'unknown',
                  line: item.line || item.lineNumber,
                  column: item.column || item.columnNumber,
                  rule: item.rule || item.code || item.ruleId,
                  severity: this.mapSeverity(item.severity || item.level || 'warning'),
                  message: item.message || item.description || 'Issue detected',
                  source: linter,
                });
              }
            });
          }
      }
    } catch (error) {
      logger.warn(`Failed to parse JSON output for ${linter}`, { error: (error as Error).message });
    }

    return issues;
  }

  /**
   * Parse text output into standardized issues
   */
  private parseTextOutput(linter: LinterType, output: string, files: string[]): LinterIssue[] {
    const issues: LinterIssue[] = [];

    if (!output.trim()) {
      return issues;
    }

    try {
      const lines = output.split('\n');

      lines.forEach((line, index) => {
        if (line.trim()) {
          // Basic text parsing - can be enhanced per linter
          const issue: LinterIssue = {
            file: files[0] || 'unknown', // Default to first file
            line: index + 1,
            severity: line.toLowerCase().includes('error') ? 'error' : 'warning',
            message: line.trim(),
            source: linter,
          };

          // Try to extract more specific information
          const lineMatch = line.match(/(\S+):(\d+):(\d+):\s*(.+)/);
          if (lineMatch && lineMatch[1] && lineMatch[2] && lineMatch[3] && lineMatch[4]) {
            issue.file = lineMatch[1];
            issue.line = parseInt(lineMatch[2], 10);
            issue.column = parseInt(lineMatch[3], 10);
            issue.message = lineMatch[4];
          }

          issues.push(issue);
        }
      });
    } catch (error) {
      logger.warn(`Failed to parse text output for ${linter}`, { error: (error as Error).message });
    }

    return issues;
  }

  /**
   * Map various severity strings to standard levels
   */
  private mapSeverity(severity: string): 'error' | 'warning' | 'info' {
    const s = severity.toLowerCase();
    if (s.includes('error') || s === 'high' || s === '2') {
      return 'error';
    } else if (s.includes('warn') || s === 'medium' || s === '1') {
      return 'warning';
    } else {
      return 'info';
    }
  }

  /**
   * Get available linters in Super-linter environment
   */
  async getAvailableSuperlinterLinters(): Promise<string[]> {
    const available: string[] = [];

    for (const [linter, config] of Object.entries(SUPERLINTER_CONFIGS)) {
      try {
        const result = await this.executeSuperlinter(
          'which',
          [config.executable],
          process.cwd(),
          5000,
          {}
        );

        if (result.exit_code === 0) {
          available.push(linter);
        }
      } catch {
        // Linter not available
      }
    }

    return available;
  }
}
