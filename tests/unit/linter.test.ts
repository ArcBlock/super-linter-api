
import { LinterRunner } from '../../src/services/linter';
import { WorkspaceManager } from '../../src/services/workspace';
import { LinterExecution, LinterConfig, LINTER_CONFIGS } from '../../src/types/linter';
import { LinterType } from '../../src/types/api';
import { LinterError, TimeoutError, WorkspaceError } from '../../src/types/errors';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

// Mock dependencies
jest.mock('child_process');
jest.mock('../../src/services/workspace');

// Mock winston logger
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

const mockedSpawn = spawn as jest.Mock;
const MockedWorkspaceManager = WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>;

// A mock ChildProcess that we can control in tests
class MockChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  killed = false;
  kill = jest.fn(() => {
    this.killed = true;
    this.emit('close', null, 'SIGTERM');
  });
  constructor() {
    super();
  }
}

describe('LinterRunner', () => {
  let linterRunner: LinterRunner;
  let workspaceManager: jest.Mocked<WorkspaceManager>;
  let childProcess: MockChildProcess;

  beforeEach(() => {
    workspaceManager = new MockedWorkspaceManager() as jest.Mocked<WorkspaceManager>;
    linterRunner = new LinterRunner(workspaceManager);
    childProcess = new MockChildProcess();

    // Setup default mocks
    mockedSpawn.mockReturnValue(childProcess);
    workspaceManager.validateWorkspace.mockResolvedValue({ valid: true, errors: [] });
    workspaceManager.getWorkspaceFiles.mockResolvedValue(['test.js', 'test.py']);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('runLinter', () => {
    const baseExecution: LinterExecution = {
      linter: 'eslint',
      workspace_path: '/tmp/ws1',
      options: {},
      timeout_ms: 5000,
    };

    it('should successfully run a linter and parse JSON output', async () => {
      const promise = linterRunner.runLinter(baseExecution);
      
      const mockOutput = JSON.stringify([{ filePath: 'test.js', messages: [] }]);
      childProcess.stdout.emit('data', mockOutput);
      childProcess.emit('close', 0); // Success exit code

      const result = await promise;
      const linterConfig = LINTER_CONFIGS[baseExecution.linter];

      expect(mockedSpawn).toHaveBeenCalledWith(
        linterConfig.executable,
        [...linterConfig.args, baseExecution.workspace_path],
        expect.any(Object)
      );
      expect(result.success).toBe(true);
      expect(result.exit_code).toBe(0);
      expect(result.file_count).toBe(1);
      expect(result.parsed_output).toEqual(JSON.parse(mockOutput));
    });

    it('should throw a LinterError if the linter is not supported', async () => {
      await expect(
        linterRunner.runLinter({ ...baseExecution, linter: 'unsupported' as any })
      ).rejects.toThrow(LinterError);
    });

    it('should throw a WorkspaceError for an invalid workspace', async () => {
      workspaceManager.validateWorkspace.mockResolvedValue({ valid: false, errors: ['test error'] });
      await expect(linterRunner.runLinter(baseExecution)).rejects.toThrow(WorkspaceError);
    });

    it('should throw a LinterError if no supported files are found', async () => {
      workspaceManager.getWorkspaceFiles.mockResolvedValue(['README.md']); // .md is not supported by eslint
      await expect(linterRunner.runLinter(baseExecution)).rejects.toThrow(
        'No supported files found for linter eslint'
      );
    });

    it('should throw a TimeoutError if the process times out', async () => {
      jest.useFakeTimers();
      const promise = linterRunner.runLinter(baseExecution);
      
      // Fast-forward time to trigger the timeout
      jest.runAllTimers();

      await expect(promise).rejects.toThrow(TimeoutError);
      expect(childProcess.kill).toHaveBeenCalled();
      jest.useRealTimers();
    });

    it('should throw a LinterError if the process emits an error (e.g., command not found)', async () => {
      const promise = linterRunner.runLinter(baseExecution);
      const error = new Error('spawn ENOENT');
      childProcess.emit('error', error);
      const linterConfig = LINTER_CONFIGS[baseExecution.linter];

      await expect(promise).rejects.toThrow(LinterError);
      await expect(promise).rejects.toThrow(`Linter executable not found: ${linterConfig.executable}`);
    });

    it('should handle non-zero exit codes correctly', async () => {
        const promise = linterRunner.runLinter(baseExecution);
        
        const mockOutput = JSON.stringify([{ filePath: 'test.js', messages: [{ruleId: 'no-console'}] }]);
        childProcess.stdout.emit('data', mockOutput);
        childProcess.emit('close', 1); // Non-zero exit code

        const result = await promise;
        expect(result.success).toBe(true); // exit code 1 is considered success for eslint
        expect(result.exit_code).toBe(1);
        expect(result.issues!.length).toBe(1);
    });
  });

  describe('Argument and Environment Building', () => {
    const baseExecution: LinterExecution = {
      linter: 'eslint',
      workspace_path: '/tmp/ws1',
      options: {
        fix: true,
        config_file: './.eslintrc.js',
        validate_all: true,
      },
      timeout_ms: 5000,
    };

    it('should build correct arguments for the linter', async () => {
      const promise = linterRunner.runLinter(baseExecution);
      childProcess.emit('close', 0);
      await promise;

      const linterConfig = LINTER_CONFIGS[baseExecution.linter];
      const expectedArgs = [
        ...linterConfig.args,
        '--fix', 
        '--config', 
        './.eslintrc.js', 
        baseExecution.workspace_path
      ];
      
      expect(mockedSpawn).toHaveBeenCalledWith(linterConfig.executable, expectedArgs, expect.any(Object));
    });

    it('should build the correct environment variables', async () => {
        const promise = linterRunner.runLinter(baseExecution);
        childProcess.emit('close', 0);
        await promise;

        const spawnOptions = mockedSpawn.mock.calls[0][2];
        expect(spawnOptions.env).toMatchObject({
            VALIDATE_ALL_CODEBASE: 'true',
            RUN_LOCAL: 'true'
        });
    });
  });

  describe('Process Management', () => {
    it('should cancel a running execution', async () => {
      // We need to get the processId, which is private. We'll test the public interface.
      const promise = linterRunner.runLinter({
        linter: 'eslint',
        workspace_path: '/tmp/ws1',
        options: {},
        timeout_ms: 10000,
      });

      // Find the running process to cancel it
      const running = linterRunner.getRunningProcesses();
      expect(running.length).toBe(1);
      const processId = running[0];

      if (processId) {
        const cancelled = await linterRunner.cancelExecution(processId);
        expect(cancelled).toBe(true);
      }
      
      expect(childProcess.kill).toHaveBeenCalled();

      // The original promise should reject with a timeout/termination error
      await expect(promise).rejects.toThrow(TimeoutError);
    });

    it('should return false when cancelling a non-existent process', async () => {
        const cancelled = await linterRunner.cancelExecution('non-existent-id');
        expect(cancelled).toBe(false);
    });
  });
});
