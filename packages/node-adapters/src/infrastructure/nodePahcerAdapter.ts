import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { IPahcerAdapter } from '@pahcer/core/domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '@pahcer/core/domain/interfaces/IPahcerConfigRepository';
import type { PahcerConfig } from '@pahcer/core/domain/models/configFile';
import type { PahcerRunOptions, PahcerStatus } from '@pahcer/core/domain/models/pahcerStatus';
import { resolvePahcerStatus } from './pahcerStatus';

const execFileAsync = promisify(execFile);

export class NodePahcerAdapter implements IPahcerAdapter {
  constructor(
    private readonly pahcerConfigRepository: IPahcerConfigRepository,
    private readonly workspaceRoot: string,
    private readonly streamOutput = false,
  ) {}

  async checkStatus(): Promise<PahcerStatus> {
    return resolvePahcerStatus(this.pahcerConfigRepository, this.workspaceRoot);
  }

  async run(options?: PahcerRunOptions, configFile?: PahcerConfig): Promise<number | undefined> {
    const args = ['run'];
    if (configFile) {
      args.push('--setting-file', configFile.path);
    }
    if (options?.freezeBestScores) {
      args.push('--freeze-best-scores');
    }

    await this.execute(args);
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

    await this.execute(args);
    return 0;
  }

  private async execute(args: string[]): Promise<void> {
    if (!this.streamOutput) {
      await execFileAsync('pahcer', args, {
        cwd: this.workspaceRoot,
        maxBuffer: 1024 * 1024 * 20,
      });
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn('pahcer', args, {
        cwd: this.workspaceRoot,
        stdio: 'inherit',
      });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pahcer ${args[0] ?? 'command'} exited with code ${code ?? 1}`));
        }
      });
    });
  }
}
