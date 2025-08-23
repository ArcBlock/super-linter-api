import { LinterType, LinterOptions } from './api';

export interface LinterConfig {
  name: LinterType;
  executable: string;
  args: string[];
  env_vars: Record<string, string>;
  supported_extensions: string[];
  config_files: string[];
  output_parsers: {
    json?: (output: string) => any;
    text?: (output: string) => any;
    sarif?: (output: string) => any;
  };
  timeout_ms: number;
  fix_supported: boolean;
}

export interface LinterExecution {
  linter: LinterType;
  workspace_path: string;
  options: LinterOptions;
  timeout_ms: number;
}

export interface LinterResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  parsed_output?: any;
  file_count: number;
  issues?: LinterIssue[];
}

export interface LinterIssue {
  file: string;
  line?: number;
  column?: number;
  rule?: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  source?: string;
  fix?: {
    range: [number, number];
    text: string;
  };
}

export interface WorkspaceInfo {
  path: string;
  files: string[];
  size_bytes: number;
  created_at: string;
  cleanup_at: string;
}

export const LINTER_CONFIGS: Record<LinterType, LinterConfig> = {
  eslint: {
    name: 'eslint',
    executable: 'eslint',
    args: ['--format', 'json', '--no-eslintrc', '--no-ignore'],
    env_vars: {},
    supported_extensions: ['.js', '.jsx', '.ts', '.tsx', '.vue'],
    config_files: ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml'],
    output_parsers: {
      json: (output) => JSON.parse(output),
      text: (output) => output,
    },
    timeout_ms: 30000,
    fix_supported: true,
  },
  pylint: {
    name: 'pylint',
    executable: 'pylint',
    args: ['--output-format=json', '--score=no'],
    env_vars: {},
    supported_extensions: ['.py'],
    config_files: ['.pylintrc', 'pylint.toml', 'pyproject.toml'],
    output_parsers: {
      json: (output) => JSON.parse(output),
      text: (output) => output,
    },
    timeout_ms: 60000,
    fix_supported: false,
  },
  rubocop: {
    name: 'rubocop',
    executable: 'rubocop',
    args: ['--format', 'json', '--force-exclusion'],
    env_vars: {},
    supported_extensions: ['.rb', '.rake', '.gemfile'],
    config_files: ['.rubocop.yml', '.rubocop.yaml'],
    output_parsers: {
      json: (output) => JSON.parse(output),
      text: (output) => output,
    },
    timeout_ms: 45000,
    fix_supported: true,
  },
  'golangci-lint': {
    name: 'golangci-lint',
    executable: 'golangci-lint',
    args: ['run', '--out-format=json'],
    env_vars: { CGO_ENABLED: '0' },
    supported_extensions: ['.go'],
    config_files: ['.golangci.yml', '.golangci.yaml'],
    output_parsers: {
      json: (output) => JSON.parse(output),
      text: (output) => output,
    },
    timeout_ms: 120000,
    fix_supported: true,
  },
  shellcheck: {
    name: 'shellcheck',
    executable: 'shellcheck',
    args: ['--format=json'],
    env_vars: {},
    supported_extensions: ['.sh', '.bash', '.dash', '.ksh'],
    config_files: ['.shellcheckrc'],
    output_parsers: {
      json: (output) => JSON.parse(output),
      text: (output) => output,
    },
    timeout_ms: 30000,
    fix_supported: false,
  },
  hadolint: {
    name: 'hadolint',
    executable: 'hadolint',
    args: ['--format', 'json'],
    env_vars: {},
    supported_extensions: ['Dockerfile', '.dockerfile'],
    config_files: ['.hadolint.yaml', '.hadolint.yml'],
    output_parsers: {
      json: (output) => JSON.parse(output),
      text: (output) => output,
    },
    timeout_ms: 15000,
    fix_supported: false,
  },
  yamllint: {
    name: 'yamllint',
    executable: 'yamllint',
    args: ['--format', 'parsable'],
    env_vars: {},
    supported_extensions: ['.yml', '.yaml'],
    config_files: ['.yamllint', '.yamllint.yml'],
    output_parsers: {
      text: (output) => output,
    },
    timeout_ms: 20000,
    fix_supported: false,
  },
  // Add more linter configurations as needed...
  jshint: { name: 'jshint', executable: 'jshint', args: ['--reporter=json'], env_vars: {}, supported_extensions: ['.js'], config_files: ['.jshintrc'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 30000, fix_supported: false },
  standard: { name: 'standard', executable: 'standard', args: ['--verbose'], env_vars: {}, supported_extensions: ['.js'], config_files: [], output_parsers: { text: (o) => o }, timeout_ms: 30000, fix_supported: true },
  flake8: { name: 'flake8', executable: 'flake8', args: ['--format=json'], env_vars: {}, supported_extensions: ['.py'], config_files: ['.flake8', 'setup.cfg'], output_parsers: { text: (o) => o }, timeout_ms: 60000, fix_supported: false },
  black: { name: 'black', executable: 'black', args: ['--check', '--diff'], env_vars: {}, supported_extensions: ['.py'], config_files: ['pyproject.toml'], output_parsers: { text: (o) => o }, timeout_ms: 60000, fix_supported: true },
  isort: { name: 'isort', executable: 'isort', args: ['--check-only', '--diff'], env_vars: {}, supported_extensions: ['.py'], config_files: ['.isort.cfg'], output_parsers: { text: (o) => o }, timeout_ms: 30000, fix_supported: true },
  standardrb: { name: 'standardrb', executable: 'standardrb', args: ['--format=json'], env_vars: {}, supported_extensions: ['.rb'], config_files: [], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 45000, fix_supported: true },
  gofmt: { name: 'gofmt', executable: 'gofmt', args: ['-l'], env_vars: {}, supported_extensions: ['.go'], config_files: [], output_parsers: { text: (o) => o }, timeout_ms: 30000, fix_supported: true },
  goimports: { name: 'goimports', executable: 'goimports', args: ['-l'], env_vars: {}, supported_extensions: ['.go'], config_files: [], output_parsers: { text: (o) => o }, timeout_ms: 30000, fix_supported: true },
  rustfmt: { name: 'rustfmt', executable: 'rustfmt', args: ['--check'], env_vars: {}, supported_extensions: ['.rs'], config_files: ['rustfmt.toml'], output_parsers: { text: (o) => o }, timeout_ms: 60000, fix_supported: true },
  clippy: { name: 'clippy', executable: 'cargo', args: ['clippy', '--', '-D', 'warnings'], env_vars: {}, supported_extensions: ['.rs'], config_files: ['Cargo.toml'], output_parsers: { text: (o) => o }, timeout_ms: 120000, fix_supported: false },
  ktlint: { name: 'ktlint', executable: 'ktlint', args: ['--reporter=json'], env_vars: {}, supported_extensions: ['.kt', '.kts'], config_files: ['.ktlint'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 60000, fix_supported: true },
  detekt: { name: 'detekt', executable: 'detekt', args: ['--report', 'json'], env_vars: {}, supported_extensions: ['.kt'], config_files: ['detekt.yml'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 60000, fix_supported: false },
  swiftlint: { name: 'swiftlint', executable: 'swiftlint', args: ['--reporter', 'json'], env_vars: {}, supported_extensions: ['.swift'], config_files: ['.swiftlint.yml'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 60000, fix_supported: true },
  jsonlint: { name: 'jsonlint', executable: 'jsonlint', args: [], env_vars: {}, supported_extensions: ['.json'], config_files: [], output_parsers: { text: (o) => o }, timeout_ms: 15000, fix_supported: false },
  markdownlint: { name: 'markdownlint', executable: 'markdownlint', args: ['--json'], env_vars: {}, supported_extensions: ['.md'], config_files: ['.markdownlint.json'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 30000, fix_supported: true },
  htmlhint: { name: 'htmlhint', executable: 'htmlhint', args: ['--format', 'json'], env_vars: {}, supported_extensions: ['.html'], config_files: ['.htmlhintrc'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 30000, fix_supported: false },
  stylelint: { name: 'stylelint', executable: 'stylelint', args: ['--formatter', 'json'], env_vars: {}, supported_extensions: ['.css', '.scss', '.sass'], config_files: ['.stylelintrc.json'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 30000, fix_supported: true },
  phpcs: { name: 'phpcs', executable: 'phpcs', args: ['--report=json'], env_vars: {}, supported_extensions: ['.php'], config_files: ['phpcs.xml'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 60000, fix_supported: false },
  phpstan: { name: 'phpstan', executable: 'phpstan', args: ['analyse', '--error-format=json'], env_vars: {}, supported_extensions: ['.php'], config_files: ['phpstan.neon'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 120000, fix_supported: false },
  cppcheck: { name: 'cppcheck', executable: 'cppcheck', args: ['--enable=all', '--json'], env_vars: {}, supported_extensions: ['.c', '.cpp', '.h', '.hpp'], config_files: [], output_parsers: { text: (o) => o }, timeout_ms: 120000, fix_supported: false },
  checkstyle: { name: 'checkstyle', executable: 'checkstyle', args: ['-f', 'json'], env_vars: {}, supported_extensions: ['.java'], config_files: ['checkstyle.xml'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 60000, fix_supported: false },
  pmd: { name: 'pmd', executable: 'pmd', args: ['-format', 'json'], env_vars: {}, supported_extensions: ['.java'], config_files: ['pmd.xml'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 120000, fix_supported: false },
  spotbugs: { name: 'spotbugs', executable: 'spotbugs', args: ['-textui', '-json'], env_vars: {}, supported_extensions: ['.java'], config_files: ['spotbugs.xml'], output_parsers: { json: (o) => JSON.parse(o) }, timeout_ms: 180000, fix_supported: false },
};