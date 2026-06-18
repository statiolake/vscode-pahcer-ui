import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IInOutFilesAdapter } from '../domain/interfaces/IInOutFilesAdapter';
import type { IVisualizerAdapter } from '../domain/interfaces/IVisualizerAdapter';

export interface VisualizerCaseData {
  executionTimeLabel: string;
  input: string;
  output: string;
}

export class VisualizerUseCase {
  constructor(
    private readonly inOutFilesAdapter: IInOutFilesAdapter,
    private readonly executionRepository: IExecutionRepository,
    private readonly visualizerAdapter: IVisualizerAdapter,
  ) {}

  async getCachedHtmlFileName(): Promise<string | undefined> {
    return (await this.visualizerAdapter.getCachedHtmlFileName()) ?? undefined;
  }

  async download(url: string): Promise<string> {
    return this.visualizerAdapter.download(url);
  }

  getVisualizerDir(): string {
    return this.visualizerAdapter.getVisualizerDir();
  }

  async readHtml(htmlFileName: string): Promise<string> {
    return this.visualizerAdapter.readHtml(htmlFileName);
  }

  async resourceExists(fileName: string): Promise<boolean> {
    return this.visualizerAdapter.resourceExists(fileName);
  }

  getResourcePath(fileName: string): string {
    return this.visualizerAdapter.getResourcePath(fileName);
  }

  async loadCaseData(seed: number, resultId: string): Promise<VisualizerCaseData> {
    const result = await this.executionRepository.findById(resultId);
    const executionTimeLabel = result ? ` (${result.startTime.toDate().toLocaleString()})` : '';
    const input = await this.inOutFilesAdapter.loadIn(seed);
    const output = await this.inOutFilesAdapter.loadArchived('out', {
      executionId: resultId,
      seed,
    });

    return { executionTimeLabel, input, output };
  }
}
