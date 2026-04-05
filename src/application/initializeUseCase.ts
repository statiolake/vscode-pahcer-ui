import type { IGitignoreAdapter } from '../domain/interfaces/IGitignoreAdapter';
import type { IPahcerAdapter } from '../domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { ITesterDownloader } from '../domain/interfaces/ITesterDownloader';
import type { PahcerJob } from '../domain/interfaces/pahcerJob';
import { ApplicationError } from './exceptions';

export interface InitializeOptions {
  problemName: string;
  objective: 'max' | 'min';
  language: 'rust' | 'cpp' | 'python' | 'go';
  isInteractive: boolean;
  testerUrl: string;
}

export type PrepareInitializeResult =
  | { type: 'ready'; options: InitializeOptions }
  | {
      type: 'requires-confirmation';
      options: InitializeOptions;
      detectedInteractive: boolean;
    };

export interface ExecuteInitializeResult {
  job: PahcerJob;
}

export class DownloadTesterError extends ApplicationError {}
export class InitializeError extends ApplicationError {}

export class GetDefaultProjectNameQuery {
  constructor(
    private readonly pahcerConfigRepository: IPahcerConfigRepository,
    private readonly workspaceName: string,
  ) {}

  async execute(): Promise<string> {
    const config = await this.pahcerConfigRepository.findById('normal');
    return config?.problemName ?? this.workspaceName;
  }
}

export class PrepareInitializeUseCase {
  constructor(private readonly testerDownloader: ITesterDownloader) {}

  async execute(options: InitializeOptions): Promise<PrepareInitializeResult> {
    if (!options.testerUrl) {
      return { type: 'ready', options };
    }

    try {
      const tester = await this.testerDownloader.downloadAndExtract(options.testerUrl);
      if (tester.seemsInteractive !== options.isInteractive) {
        return {
          type: 'requires-confirmation',
          options,
          detectedInteractive: tester.seemsInteractive,
        };
      }
      return { type: 'ready', options };
    } catch (error) {
      throw new DownloadTesterError(`テスターのダウンロードに失敗しました: ${error}`);
    }
  }
}

export class ExecuteInitializeUseCase {
  constructor(
    private readonly gitignoreAdapter: IGitignoreAdapter,
    private readonly pahcerAdapter: IPahcerAdapter,
  ) {}

  async execute(options: InitializeOptions): Promise<ExecuteInitializeResult> {
    await this.updateGitignore();

    try {
      const job = await this.pahcerAdapter.startInit({
        problemName: options.problemName,
        objective: options.objective,
        language: options.language,
        isInteractive: options.isInteractive,
      });
      return { job };
    } catch (error) {
      throw new InitializeError(`初期化処理に失敗しました: ${error}`);
    }
  }

  private async updateGitignore(): Promise<void> {
    try {
      await this.gitignoreAdapter.addEntry('tools/target');
    } catch (error) {
      console.error('Failed to update .gitignore:', error);
    }
  }
}
