import type { IExecutionRepository } from '../domain/interfaces/IExecutionRepository';
import type { IFileAnalyzer } from '../domain/interfaces/IFileAnalyzer';
import type { IInOutFilesAdapter } from '../domain/interfaces/IInOutFilesAdapter';
import type { IPahcerAdapter } from '../domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../domain/interfaces/ITestCaseRepository';
import type { PahcerJob } from '../domain/interfaces/pahcerJob';
import type { PahcerConfig } from '../domain/models/configFile';
import type { PahcerRunOptions } from '../domain/models/pahcerStatus';
import type { CommitResult, CommitResultsUseCase } from './commitResultsUseCase';
import { PreconditionFailedError, ResourceNotFoundError } from './exceptions';

export interface PrepareRunResult {
  type: 'ready' | 'requires-confirmation';
}

export interface ExecuteRunRequest {
  options: PahcerRunOptions;
  enableGitIntegration?: boolean;
}

export interface ExecuteRunCompletion {
  messages: string[];
  executionId: string;
}

export interface ExecuteRunResult {
  job: PahcerJob;
  completion: Promise<ExecuteRunCompletion>;
}

export class PrepareRunUseCase {
  constructor(private readonly commitResultsUseCase: CommitResultsUseCase) {}

  async execute(): Promise<PrepareRunResult> {
    const preparation = await this.commitResultsUseCase.prepareGitIntegration();
    if (preparation.type === 'requires-confirmation') {
      return { type: 'requires-confirmation' };
    }
    return { type: 'ready' };
  }
}

export class ExecuteRunUseCase {
  constructor(
    private readonly pahcerAdapter: IPahcerAdapter,
    private readonly commitResultsUseCase: CommitResultsUseCase,
    private readonly inOutFilesAdapter: IInOutFilesAdapter,
    private readonly fileAnalyzer: IFileAnalyzer,
    private readonly executionRepository: IExecutionRepository,
    private readonly testCaseRepository: ITestCaseRepository,
    private readonly pahcerConfigRepository: IPahcerConfigRepository,
  ) {}

  async execute(request: ExecuteRunRequest): Promise<ExecuteRunResult> {
    if (request.enableGitIntegration !== undefined) {
      await this.commitResultsUseCase.setGitIntegration(request.enableGitIntegration);
    }

    await this.inOutFilesAdapter.removeOutputs();
    const beforeResult = await this.commitResultsUseCase.commitBeforeExecution();
    const tempConfig = await this.prepareTemporaryConfig(request.options);

    const job = await this.pahcerAdapter.startRun({
      options: request.options,
      configFile: tempConfig,
    });

    const completion = this.finalizeRun(job, tempConfig, beforeResult);
    return { job, completion };
  }

  private async finalizeRun(
    job: PahcerJob,
    tempConfig: PahcerConfig | undefined,
    beforeResult: CommitResult,
  ): Promise<ExecuteRunCompletion> {
    const messages: string[] = [];
    if (beforeResult.message) {
      messages.push(beforeResult.message);
    }

    try {
      await job.wait();
    } finally {
      if (tempConfig) {
        await this.pahcerConfigRepository.delete('temporary');
      }
    }

    const allExecutions = await this.executionRepository.findAll();
    if (allExecutions.length === 0) {
      throw new PreconditionFailedError('実行結果が取得できませんでした');
    }
    const latestExecution = allExecutions[0];

    await this.inOutFilesAdapter.archiveOutputs(latestExecution.id);
    await this.inOutFilesAdapter.removeOutputs();
    await this.analyzeExecution(latestExecution.id);

    if (beforeResult.commitHash) {
      latestExecution.commitHash = beforeResult.commitHash;
      await this.executionRepository.upsert(latestExecution);
    }

    const executionTestCases = await this.testCaseRepository.findByExecutionId(latestExecution.id);
    const caseCount = executionTestCases.length;
    const totalScore = executionTestCases.reduce((sum, tc) => sum + tc.score, 0);

    const afterResult = await this.commitResultsUseCase.commitAfterExecution(caseCount, totalScore);
    if (afterResult.message) {
      messages.push(afterResult.message);
    }

    return {
      messages,
      executionId: latestExecution.id,
    };
  }

  private async prepareTemporaryConfig(
    options: PahcerRunOptions,
  ): Promise<PahcerConfig | undefined> {
    if (options.startSeed === undefined && options.endSeed === undefined) {
      return undefined;
    }

    const tempConfig = await this.pahcerConfigRepository.findById('temporary');
    if (!tempConfig) {
      throw new ResourceNotFoundError('テンポラリ設定ファイル');
    }

    if (options.startSeed !== undefined) {
      tempConfig.startSeed = options.startSeed;
    }
    if (options.endSeed !== undefined) {
      tempConfig.endSeed = options.endSeed;
    }

    await this.pahcerConfigRepository.upsert(tempConfig);
    return tempConfig;
  }

  private async analyzeExecution(executionId: string): Promise<void> {
    const testCases = await this.testCaseRepository.findByExecutionId(executionId);

    await Promise.all(
      testCases.map(async (tc) => {
        const inputPath = this.inOutFilesAdapter.getNonArchivedPath('in', tc.id.seed);
        const stderrPath = this.inOutFilesAdapter.getArchivedPath('err', tc.id);

        const firstInputLine = await this.fileAnalyzer.readFirstLine(inputPath);
        const stderrVars = (await this.fileAnalyzer.parseStderrVariables(stderrPath)) || {};

        tc.firstInputLine = firstInputLine;
        tc.stderrVars = stderrVars;

        await this.testCaseRepository.upsert(tc);
      }),
    );
  }
}
