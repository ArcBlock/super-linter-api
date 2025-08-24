import { LinterRunner } from '../../src/services/linter';
import { WorkspaceManager } from '../../src/services/workspace';
import { LinterExecution, LINTER_CONFIGS } from '../../src/types/linter';
import { LinterError, WorkspaceError } from '../../src/types/errors';

// Mock dependencies
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

const MockedWorkspaceManager = WorkspaceManager as jest.MockedClass<typeof WorkspaceManager>;

describe('LinterRunner', () => {
  let linterRunner: LinterRunner;
  let workspaceManager: jest.Mocked<WorkspaceManager>;

  beforeEach(() => {
    workspaceManager = new MockedWorkspaceManager() as jest.Mocked<WorkspaceManager>;
    linterRunner = new LinterRunner(workspaceManager);

    // Setup default mocks
    workspaceManager.validateWorkspace.mockResolvedValue({ valid: true, errors: [] });
    workspaceManager.getWorkspaceFiles.mockResolvedValue(['test.js', 'app.js']);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should initialize with workspace manager', () => {
      expect(linterRunner).toBeInstanceOf(LinterRunner);
    });

    it('should have access to linter configurations', () => {
      expect(LINTER_CONFIGS.eslint).toBeDefined();
      expect(LINTER_CONFIGS.eslint.name).toBe('eslint');
      expect(LINTER_CONFIGS.eslint.supported_extensions).toContain('.js');
    });
  });

  describe('Validation', () => {
    const baseExecution: LinterExecution = {
      linter: 'eslint',
      workspace_path: '/tmp/ws1',
      options: {},
      timeout_ms: 5000,
    };

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
      await expect(linterRunner.runLinter(baseExecution)).rejects.toThrow(LinterError);
      await expect(linterRunner.runLinter(baseExecution)).rejects.toThrow(
        'No supported files found for linter eslint'
      );
    });

    it('should throw WorkspaceError if no files found in workspace', async () => {
      workspaceManager.getWorkspaceFiles.mockResolvedValue([]);
      await expect(linterRunner.runLinter(baseExecution)).rejects.toThrow(WorkspaceError);
      await expect(linterRunner.runLinter(baseExecution)).rejects.toThrow('No files found in workspace');
    });
  });

  describe('File Support Detection', () => {
    it('should detect supported JavaScript files', () => {
      const eslintConfig = LINTER_CONFIGS.eslint;
      expect(eslintConfig.supported_extensions).toContain('.js');
      expect(eslintConfig.supported_extensions).toContain('.jsx');
      expect(eslintConfig.supported_extensions).toContain('.ts');
      expect(eslintConfig.supported_extensions).toContain('.tsx');
    });

    it('should have correct executable and arguments for ESLint', () => {
      const eslintConfig = LINTER_CONFIGS.eslint;
      expect(eslintConfig.executable).toBe('eslint');
      expect(eslintConfig.args).toContain('--format');
      expect(eslintConfig.args).toContain('json');
    });
  });

  describe('Process Management', () => {
    it('should initialize with empty running processes', () => {
      const running = linterRunner.getRunningProcesses();
      expect(running).toEqual([]);
    });

    it('should return false when cancelling a non-existent process', async () => {
      const cancelled = await linterRunner.cancelExecution('non-existent-id');
      expect(cancelled).toBe(false);
    });
  });

  describe('Linter Configurations', () => {
    it('should have all expected linters configured', () => {
      const expectedLinters = [
        'eslint', 'prettier', 'jshint', 'pylint', 'flake8', 'black', 'isort', 
        'bandit', 'mypy', 'shellcheck', 'golangci-lint', 'gofmt', 'rubocop', 
        'hadolint', 'yamllint', 'jsonlint', 'markdownlint', 'stylelint'
      ];

      expectedLinters.forEach(linter => {
        expect(LINTER_CONFIGS[linter as keyof typeof LINTER_CONFIGS]).toBeDefined();
      });
    });

    it('should have proper timeout configurations', () => {
      Object.values(LINTER_CONFIGS).forEach(config => {
        expect(config.timeout_ms).toBeGreaterThan(0);
        expect(config.timeout_ms).toBeLessThanOrEqual(120000); // Max 2 minutes
      });
    });

    it('should have valid supported extensions', () => {
      Object.values(LINTER_CONFIGS).forEach(config => {
        expect(config.supported_extensions).toBeDefined();
        expect(config.supported_extensions.length).toBeGreaterThan(0);
      });
    });
  });
});