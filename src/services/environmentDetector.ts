import { spawn } from 'child_process';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

export interface EnvironmentCapabilities {
  isSuperlinterEnvironment: boolean;
  availableLinters: string[];
  containerized: boolean;
  nodeVersion: string;
  platform: string;
}

export class EnvironmentDetector {
  private static _capabilities: EnvironmentCapabilities | null = null;

  /**
   * Detect the current environment and available linting capabilities
   */
  static async detectCapabilities(): Promise<EnvironmentCapabilities> {
    if (this._capabilities) {
      return this._capabilities;
    }

    logger.info('Detecting environment capabilities...');

    const capabilities: EnvironmentCapabilities = {
      isSuperlinterEnvironment: false,
      availableLinters: [],
      containerized: this.isContainerized(),
      nodeVersion: process.version,
      platform: process.platform,
    };

    // Check if we're in a Super-linter environment
    capabilities.isSuperlinterEnvironment = await this.checkSuperlinterEnvironment();

    // Detect available linters
    capabilities.availableLinters = await this.detectAvailableLinters();

    this._capabilities = capabilities;

    logger.info('Environment detection completed', {
      isSuperlinterEnvironment: capabilities.isSuperlinterEnvironment,
      availableLinters: capabilities.availableLinters,
      containerized: capabilities.containerized,
    });

    return capabilities;
  }

  /**
   * Check if running in a Super-linter environment
   */
  private static async checkSuperlinterEnvironment(): Promise<boolean> {
    // Check environment variable first
    if (process.env.SUPERLINTER_AVAILABLE === 'true') {
      return true;
    }

    // Check for Super-linter specific files/directories
    try {
      const fs = await import('fs').then(m => m.promises);

      // Super-linter typically has these paths
      const superlinterIndicators = ['/action/lib/linter.sh', '/github/workspace', '/tmp/lint'];

      for (const path of superlinterIndicators) {
        try {
          await fs.access(path);
          logger.info(`Found Super-linter indicator: ${path}`);
          return true;
        } catch {
          // Path doesn't exist, continue checking
        }
      }
    } catch (error) {
      logger.warn('Error checking Super-linter environment indicators', {
        error: (error as Error).message,
      });
    }

    // Check for multiple linters that typically come with Super-linter
    const commonSuperlinterLinters = ['eslint', 'pylint', 'shellcheck', 'hadolint', 'yamllint'];
    const availableCount = await this.countAvailableLinters(commonSuperlinterLinters);

    // If we have most of the common Super-linter tools, we're probably in that environment
    return availableCount >= 3;
  }

  /**
   * Detect available linters in the current environment
   */
  private static async detectAvailableLinters(): Promise<string[]> {
    const potentialLinters = [
      // JavaScript/TypeScript
      'eslint',
      'prettier',
      'jshint',
      'standard',

      // Python
      'pylint',
      'flake8',
      'black',
      'isort',
      'bandit',
      'mypy',

      // Shell
      'shellcheck',
      'shfmt',

      // Go
      'golangci-lint',
      'gofmt',
      'goimports',

      // Ruby
      'rubocop',
      'standardrb',

      // Java
      'checkstyle',
      'pmd',
      'spotbugs',

      // C/C++
      'cppcheck',
      'clang-format',

      // Rust
      'rustfmt',
      'cargo', // for clippy

      // Kotlin
      'ktlint',
      'detekt',

      // Swift
      'swiftlint',

      // Docker
      'hadolint',

      // YAML/JSON
      'yamllint',
      'jsonlint',

      // Markdown
      'markdownlint',

      // CSS
      'stylelint',

      // HTML
      'htmlhint',

      // PHP
      'phpcs',
      'phpstan',
    ];

    const availableLinters: string[] = [];

    for (const linter of potentialLinters) {
      if (await this.isLinterAvailable(linter)) {
        availableLinters.push(linter);
      }
    }

    return availableLinters;
  }

  /**
   * Check if a specific linter is available
   */
  private static async isLinterAvailable(linter: string): Promise<boolean> {
    return new Promise(resolve => {
      const process = spawn('which', [linter], { stdio: 'ignore' });

      let resolved = false;
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          process.kill();
          resolve(false);
        }
      }, 1000); // 1 second timeout

      process.on('close', code => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(code === 0);
        }
      });

      process.on('error', () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve(false);
        }
      });
    });
  }

  /**
   * Count how many linters from a list are available
   */
  private static async countAvailableLinters(linters: string[]): Promise<number> {
    let count = 0;

    for (const linter of linters) {
      if (await this.isLinterAvailable(linter)) {
        count++;
      }
    }

    return count;
  }

  /**
   * Check if running in a containerized environment
   */
  private static isContainerized(): boolean {
    try {
      const fs = require('fs');

      // Check for Docker-specific files
      if (fs.existsSync('/.dockerenv')) {
        return true;
      }

      // Check cgroup for container indicators
      try {
        const cgroup = fs.readFileSync('/proc/1/cgroup', 'utf8');
        if (cgroup.includes('docker') || cgroup.includes('containerd')) {
          return true;
        }
      } catch {
        // /proc/1/cgroup might not exist or be readable
      }

      // Check environment variables commonly set in containers
      if (process.env.DOCKER_CONTAINER || process.env.container) {
        return true;
      }
    } catch (error) {
      logger.debug('Error checking containerized environment', { error: (error as Error).message });
    }

    return false;
  }

  /**
   * Get a summary of the current environment
   */
  static async getEnvironmentSummary(): Promise<string> {
    const caps = await this.detectCapabilities();

    let summary = `Environment: ${caps.isSuperlinterEnvironment ? 'Super-linter' : 'Standard'}`;
    summary += ` (${caps.containerized ? 'Containerized' : 'Host'})`;
    summary += `\nNode.js: ${caps.nodeVersion}`;
    summary += `\nPlatform: ${caps.platform}`;
    summary += `\nAvailable linters: ${caps.availableLinters.length}`;

    if (caps.availableLinters.length > 0) {
      summary += `\n  - ${caps.availableLinters.slice(0, 10).join(', ')}`;
      if (caps.availableLinters.length > 10) {
        summary += ` (and ${caps.availableLinters.length - 10} more...)`;
      }
    }

    return summary;
  }

  /**
   * Reset cached capabilities (useful for testing)
   */
  static resetCache(): void {
    this._capabilities = null;
  }
}
