import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IPahcerAdapter } from '@pahcer/core/domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '@pahcer/core/domain/interfaces/IPahcerConfigRepository';
import type { PahcerConfig } from '@pahcer/core/domain/models/configFile';
import { type PahcerRunOptions, PahcerStatus } from '@pahcer/core/domain/models/pahcerStatus';

const execFileAsync = promisify(execFile);

export class WebPahcerAdapter implements IPahcerAdapter {
  constructor(
    private readonly pahcerConfigRepository: IPahcerConfigRepository,
    private readonly workspaceRoot: string,
  ) {}

  async checkStatus(): Promise<PahcerStatus> {
    try {
      await execFileAsync('pahcer', ['--version'], { cwd: this.workspaceRoot });
    } catch {
      return PahcerStatus.NotInstalled;
    }

    try {
      return (await this.pahcerConfigRepository.findById('normal'))
        ? PahcerStatus.Ready
        : PahcerStatus.NotInitialized;
    } catch {
      return PahcerStatus.NotInitialized;
    }
  }

  async run(options?: PahcerRunOptions, configFile?: PahcerConfig): Promise<number | undefined> {
    const args = ['run'];
    if (configFile) {
      args.push('--setting-file', configFile.path);
    }
    if (options?.freezeBestScores) {
      args.push('--freeze-best-scores');
    }

    await execFileAsync('pahcer', args, {
      cwd: this.workspaceRoot,
      maxBuffer: 1024 * 1024 * 20,
    });
    return 0;
  }

  async init(
    problemName: string,
    objective: 'max' | 'min',
    language: 'rust' | 'cpp' | 'python' | 'go',
    isInteractive: boolean,
  ): Promise<number | undefined> {
    const args = ['init', '--problem', problemName, '--objective', objective, '--lang', language];
    if (isInteractive) {
      args.push('--interactive');
    }

    await execFileAsync('pahcer', args, {
      cwd: this.workspaceRoot,
      maxBuffer: 1024 * 1024 * 20,
    });
    return 0;
  }
}
