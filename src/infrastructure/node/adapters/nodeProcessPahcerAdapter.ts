import { execSync, spawn } from 'node:child_process';
import type { IPahcerAdapter } from '../../../domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '../../../domain/interfaces/IPahcerConfigRepository';
import type { InitPahcerCommand, RunPahcerCommand } from '../../../domain/interfaces/pahcerJob';
import type { PahcerStatus } from '../../../domain/models/pahcerStatus';
import { ManagedPahcerJob } from '../../shared/managedPahcerJob';

export class NodeProcessPahcerAdapter implements IPahcerAdapter {
  constructor(
    private readonly pahcerConfigRepository: IPahcerConfigRepository,
    private readonly workspaceRoot: string,
  ) {}

  async checkStatus(): Promise<PahcerStatus> {
    try {
      execSync('pahcer --version', { cwd: this.workspaceRoot, stdio: 'ignore' });
    } catch {
      return 'notInstalled';
    }

    try {
      const config = await this.pahcerConfigRepository.findById('normal');
      return config ? 'ready' : 'notInitialized';
    } catch {
      return 'notInitialized';
    }
  }

  async startInit(command: InitPahcerCommand) {
    const args = [
      'init',
      '--problem',
      command.problemName,
      '--objective',
      command.objective,
      '--lang',
      command.language,
    ];
    if (command.isInteractive) {
      args.push('--interactive');
    }
    return this.spawnJob('init', args);
  }

  async startRun(command: RunPahcerCommand) {
    const args = ['run'];
    if (command.configFile) {
      args.push('--setting-file', command.configFile.path);
    }
    if (command.options?.freezeBestScores) {
      args.push('--freeze-best-scores');
    }
    return this.spawnJob('run', args);
  }

  private spawnJob(commandType: 'init' | 'run', args: string[]) {
    const job = new ManagedPahcerJob();
    job.emit({ type: 'started', command: commandType });

    const child = spawn('pahcer', args, {
      cwd: this.workspaceRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (chunk: Buffer) => {
      job.emit({ type: 'stdout', chunk: chunk.toString() });
    });
    child.stderr.on('data', (chunk: Buffer) => {
      job.emit({ type: 'stderr', chunk: chunk.toString() });
    });
    child.on('error', (error) => {
      job.fail(error.message);
    });
    child.on('close', (code) => {
      job.complete(code ?? 0);
    });

    return job;
  }
}
