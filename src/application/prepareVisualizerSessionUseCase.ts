import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IInOutFilesAdapter } from '../domain/interfaces/IInOutFilesAdapter';
import type { IVisualizerAdapter } from '../domain/interfaces/IVisualizerAdapter';

export type PrepareVisualizerSessionResult =
  | { type: 'requires-visualizer-url' }
  | {
      type: 'ready';
      htmlFileName: string;
      input: string;
      output: string;
      executionTime: string;
    };

export class RegisterVisualizerSourceUseCase {
  constructor(private readonly visualizerAdapter: IVisualizerAdapter) {}

  async execute(url: string): Promise<string> {
    return this.visualizerAdapter.download(url);
  }
}

export class PrepareVisualizerSessionUseCase {
  constructor(
    private readonly inOutFilesAdapter: IInOutFilesAdapter,
    private readonly executionRepository: IExecutionRepository,
    private readonly visualizerAdapter: IVisualizerAdapter,
  ) {}

  async execute(seed: number, executionId?: string): Promise<PrepareVisualizerSessionResult> {
    const htmlFileName = await this.visualizerAdapter.getCachedHtmlFileName();
    if (!htmlFileName) {
      return { type: 'requires-visualizer-url' };
    }
    if (!executionId) {
      throw new Error('実行IDが指定されていません');
    }

    let executionTime = '';
    const execution = await this.executionRepository.findById(executionId);
    if (execution) {
      executionTime = ` (${execution.startTime.toDate().toLocaleString()})`;
    }

    const input = await this.inOutFilesAdapter.loadIn(seed);
    const output = await this.inOutFilesAdapter.loadArchived('out', {
      executionId,
      seed,
    });

    return {
      type: 'ready',
      htmlFileName,
      input,
      output,
      executionTime,
    };
  }
}
