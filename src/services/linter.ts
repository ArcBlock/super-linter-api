import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import { promises as fs } from 'fs';
import winston from 'winston';
import { LinterType, LinterOptions, OutputFormat } from '../types/api';
import { LinterExecution, LinterResult, LinterConfig, LINTER_CONFIGS } from '../types/linter';
import { LinterError, TimeoutError, WorkspaceError } from '../types/errors';
import { WorkspaceManager } from './workspace';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

export class LinterRunner {
  private workspaceManager: WorkspaceManager;
  private runningProcesses: Map<string, ChildProcess>;

  constructor(workspaceManager: WorkspaceManager) {
    this.workspaceManager = workspaceManager;
    this.runningProcesses = new Map();

    // Cleanup processes on exit
    process.on('SIGTERM', () => this.cleanup());
    process.on('SIGINT', () => this.cleanup());
  }

  async runLinter(execution: LinterExecution): Promise<LinterResult> {
    const { linter, workspace_path, options, timeout_ms } = execution;
    const config = LINTER_CONFIGS[linter];
    
    if (!config) {
      throw new LinterError('LINTER_NOT_FOUND', `Linter not supported: ${linter}`);
    }

    // Validate workspace
    const validation = await this.workspaceManager.validateWorkspace(workspace_path);
    if (!validation.valid) {
      throw new WorkspaceError(`Invalid workspace: ${validation.errors.join(', ')}`);
    }

    const files = await this.workspaceManager.getWorkspaceFiles(workspace_path);
    if (files.length === 0) {
      throw new WorkspaceError('No files found in workspace');
    }

    // Filter files by supported extensions
    const supportedFiles = files.filter(file => 
      this.isFileSupported(file, config)
    );

    if (supportedFiles.length === 0) {
      throw new LinterError(
        'LINTER_EXECUTION_FAILED',
        `No supported files found for linter ${linter}. Supported extensions: ${config.supported_extensions.join(', ')}`
      );
    }

    logger.info(`Running ${linter} on ${supportedFiles.length} files in ${workspace_path}`);

    try {
      const result = await this.executeLinter(config, workspace_path, options, timeout_ms);
      
      return {
        ...result,
        file_count: supportedFiles.length,
      };
    } catch (error: any) {
      if (error instanceof TimeoutError || error instanceof LinterError) {
        throw error;
      }
      throw new LinterError(
        'LINTER_EXECUTION_FAILED',
        `Linter execution failed: ${error.message}`,
        { linter, error: error.message }
      );
    }
  }

  private isFileSupported(filename: string, config: LinterConfig): boolean {
    if (filename.toLowerCase() === 'dockerfile' || filename.toLowerCase().endsWith('.dockerfile')) {
      return config.supported_extensions.includes('Dockerfile') || 
             config.supported_extensions.includes('.dockerfile');
    }
    
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    return config.supported_extensions.some(supportedExt => 
      supportedExt.toLowerCase() === ext
    );
  }

  private async executeLinter(
    config: LinterConfig,
    workspacePath: string,
    options: LinterOptions,
    timeoutMs: number
  ): Promise<LinterResult> {
    const processId = `${config.name}_${Date.now()}`;
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      // Prepare command and arguments
      const args = this.buildLinterArgs(config, options);
      const env = this.buildEnvironment(config, options);
      
      logger.debug(`Executing: ${config.executable} ${args.join(' ')}`, {
        linter: config.name,
        workspacePath,
        args,
      });

      // Spawn linter process
      const child = spawn(config.executable, [...args, workspacePath], {
        cwd: workspacePath,
        env: { ...process.env, ...env },
        stdio: 'pipe',
      });

      this.runningProcesses.set(processId, child);

      let stdout = '';
      let stderr = '';

      // Collect stdout
      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      // Collect stderr
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Handle timeout
      let finished = false;
      const timer = setTimeout(() => {
        if (finished) return;
        child.kill('SIGTERM');
        setTimeout(() => {
          if (!child.killed) {
            child.kill('SIGKILL');
          }
        }, 5000); // Force kill after 5 seconds
        
        this.runningProcesses.delete(processId);
        reject(new TimeoutError(`Linter timed out after ${timeoutMs}ms`, timeoutMs));
      }, timeoutMs);

      // Handle process completion
      child.on('close', (code, signal) => {
        clearTimeout(timer);
        finished = true;
        this.runningProcesses.delete(processId);
        
        const executionTime = Date.now() - startTime;
        
        logger.debug(`Linter finished`, {
          linter: config.name,
          exitCode: code,
          signal,
          executionTime,
          stdoutLength: stdout.length,
          stderrLength: stderr.length,
        });

        if (signal === 'SIGTERM' || signal === 'SIGKILL') {
          reject(new TimeoutError(`Linter was terminated (${signal})`, timeoutMs));
          return;
        }

        try {
          const parsed = this.parseLinterOutput(config, stdout, stderr, code || 0);
          
          resolve({
            success: code === 0 || this.isSuccessfulExitCode(config, code || 0),
            exit_code: code || 0,
            stdout,
            stderr,
            execution_time_ms: executionTime,
            parsed_output: parsed,
            file_count: 0, // Will be set by caller
            issues: this.extractIssues(parsed, config),
          });
        } catch (parseError: any) {
          reject(new LinterError(
            'LINTER_EXECUTION_FAILED',
            `Failed to parse linter output: ${parseError.message}`,
            { linter: config.name, parseError: parseError.message }
          ));
        }
      });

      // Handle process errors
      child.on('error', (error) => {
        clearTimeout(timer);
        this.runningProcesses.delete(processId);
        
        if (error.message.includes('ENOENT')) {
          reject(new LinterError(
            'LINTER_NOT_FOUND',
            `Linter executable not found: ${config.executable}`,
            { linter: config.name, executable: config.executable }
          ));
        } else {
          reject(new LinterError(
            'LINTER_EXECUTION_FAILED',
            `Process error: ${(error).message}`,
            { linter: config.name, error: (error).message }
          ));
        }
      });
    });
  }

  private buildLinterArgs(config: LinterConfig, options: LinterOptions): string[] {
    const args = [...config.args];
    
    // Add common options
    if (options.fix && config.fix_supported) {
      switch (config.name) {
        case 'eslint':
          args.push('--fix');
          break;
        // case 'prettier': // prettier not in LinterType enum
          // args.push('--write');
          // break;
        case 'black':
          // Remove --check and --diff for fix mode
          const checkIndex = args.indexOf('--check');
          if (checkIndex >= 0) args.splice(checkIndex, 1);
          const diffIndex = args.indexOf('--diff');
          if (diffIndex >= 0) args.splice(diffIndex, 1);
          break;
        // Add more linter-specific fix flags as needed
      }
    }

    // Add config file if specified
    if (options.config_file) {
      switch (config.name) {
        case 'eslint':
          args.push('--config', options.config_file);
          break;
        case 'pylint':
          args.push('--rcfile', options.config_file);
          break;
        // Add more linter-specific config flags as needed
      }
    }

    return args;
  }

  private buildEnvironment(config: LinterConfig, options: LinterOptions): Record<string, string> {
    const env = { ...config.env_vars };
    
    // Add log level mapping
    if (options.log_level) {
      switch (config.name) {
        case 'eslint':
          // ESLint doesn't have direct log level env var
          break;
        case 'pylint':
          env.PYLINT_LOG_LEVEL = options.log_level.toLowerCase();
          break;
        // Add more linter-specific log level mappings
      }
    }

    // Super-linter compatibility environment variables
    env.DEFAULT_WORKSPACE = '/tmp/lint';
    env.RUN_LOCAL = 'true';
    env.OUTPUT_DETAILS = 'detailed';
    
    if (options.validate_all) {
      env.VALIDATE_ALL_CODEBASE = 'true';
    }

    return env;
  }

  private isSuccessfulExitCode(config: LinterConfig, exitCode: number): boolean {
    // Some linters use non-zero exit codes for warnings
    switch (config.name) {
      case 'eslint':
      case 'pylint':
      case 'rubocop':
        return exitCode <= 1; // 0 = no issues, 1 = warnings/errors found
      case 'shellcheck':
        return exitCode <= 1;
      default:
        return exitCode === 0;
    }
  }

  private parseLinterOutput(config: LinterConfig, stdout: string, stderr: string, exitCode: number): any {
    // Try JSON parser first if available
    if (config.output_parsers.json && this.isJsonOutput(config, stdout)) {
      try {
        return config.output_parsers.json(stdout);
      } catch (error: unknown) {
        logger.warn(`Failed to parse JSON output for ${config.name}: ${(error as Error).message}`);
      }
    }

    // Fallback to text parser
    if (config.output_parsers.text) {
      return config.output_parsers.text(stdout);
    }

    // Default: return raw output
    return {
      stdout,
      stderr,
      exit_code: exitCode,
      raw: true,
    };
  }

  private isJsonOutput(config: LinterConfig, output: string): boolean {
    const trimmed = output.trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }

  private extractIssues(parsedOutput: any, config: LinterConfig): any[] {
    if (!parsedOutput || typeof parsedOutput !== 'object') {
      return [];
    }

    // ESLint format
    if (Array.isArray(parsedOutput)) {
      return parsedOutput.flatMap(file => 
        (file.messages || []).map((msg: any) => ({
          file: file.filePath || 'unknown',
          line: msg.line,
          column: msg.column,
          rule: msg.ruleId,
          severity: msg.severity === 2 ? 'error' : 'warning',
          message: msg.message,
        }))
      );
    }

    // Generic format - try to extract common patterns
    const issues = [];
    
    if (parsedOutput.files) {
      // Some linters group by files
      for (const file of Object.values(parsedOutput.files)) {
        if ((file as any)?.messages) {
          issues.push(...(file as any).messages);
        }
      }
    }

    return issues;
  }

  async cancelExecution(processId: string): Promise<boolean> {
    const process = this.runningProcesses.get(processId);
    if (process) {
      process.kill('SIGTERM');
      this.runningProcesses.delete(processId);
      return true;
    }
    return false;
  }

  getRunningProcesses(): string[] {
    return Array.from(this.runningProcesses.keys());
  }

  private cleanup(): void {
    logger.info(`Cleaning up ${this.runningProcesses.size} running processes`);
    
    for (const [processId, process] of this.runningProcesses.entries()) {
      try {
        process.kill('SIGTERM');
        setTimeout(() => {
          if (!process.killed) {
            process.kill('SIGKILL');
          }
        }, 5000);
      } catch (error: unknown) {
        logger.warn(`Failed to kill process ${processId}: ${(error as Error).message}`);
      }
    }
    
    this.runningProcesses.clear();
  }

  async checkLinterAvailability(linter: LinterType): Promise<{ available: boolean; version?: string; error?: string }> {
    const config = LINTER_CONFIGS[linter];
    if (!config) {
      return { available: false, error: 'Linter not configured' };
    }

    try {
      return new Promise((resolve) => {
        const child = spawn(config.executable, ['--version'], {
          stdio: 'pipe',
          timeout: 5000,
        });

        let output = '';
        child.stdout?.on('data', (data) => {
          output += data.toString();
        });

        child.on('close', (code) => {
          if (code === 0) {
            const version = this.extractVersion(output);
            resolve({ available: true, version });
          } else {
            resolve({ available: false, error: `Exit code ${code}` });
          }
        });

        child.on('error', (error: Error) => {
          resolve({ available: false, error: error.message });
        });

        // Timeout handler
        setTimeout(() => {
          child.kill();
          resolve({ available: false, error: 'Version check timeout' });
        }, 5000);
      });
    } catch (error: any) {
      return { available: false, error: error.message };
    }
  }

  private extractVersion(output: string): string {
    // Try to extract version from common version output patterns
    const versionMatch = output.match(/v?(\d+\.\d+\.\d+)/);
    return versionMatch?.[1] || output.trim().split('\n')[0] || 'unknown';
  }

  async getAllLinterStatus(): Promise<Record<LinterType, { available: boolean; version?: string }>> {
    const results: Record<string, { available: boolean; version?: string }> = {};
    
    const linters = Object.keys(LINTER_CONFIGS) as LinterType[];
    const checks = await Promise.allSettled(
      linters.map(linter => this.checkLinterAvailability(linter))
    );

    for (let i = 0; i < linters.length; i++) {
      const linter = linters[i]!;
      const check = checks[i]!;
      
      if (check.status === 'fulfilled') {
        const result: { available: boolean; version?: string } = {
          available: check.value.available,
        };
        if (check.value.version) {
          result.version = check.value.version;
        }
        results[linter] = result;
      } else {
        results[linter] = {
          available: false,
        };
      }
    }

    return results as Record<LinterType, { available: boolean; version?: string }>;
  }
}
