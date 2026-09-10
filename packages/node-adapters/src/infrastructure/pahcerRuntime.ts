import * as path from 'node:path';
import { CheckPahcerStatusUseCase } from '@pahcer/core/application/checkPahcerStatusUseCase';
import { CommitResultsUseCase } from '@pahcer/core/application/commitResultsUseCase';
import { CopySourceAtExecutionUseCase } from '@pahcer/core/application/copySourceAtExecutionUseCase';
import { InitializeUseCase } from '@pahcer/core/application/initializeUseCase';
import { LoadComparisonDataUseCase } from '@pahcer/core/application/loadComparisonDataUseCase';
import { LoadPahcerTreeDataUseCase } from '@pahcer/core/application/loadPahcerTreeDataUseCase';
import { OpenCaseFileUseCase } from '@pahcer/core/application/openCaseFileUseCase';
import { RunPahcerUseCase } from '@pahcer/core/application/runPahcerUseCase';
import { ShowExecutionDiffUseCase } from '@pahcer/core/application/showExecutionDiffUseCase';
import { UpdateExecutionCommentUseCase } from '@pahcer/core/application/updateExecutionCommentUseCase';
import { VisualizerUseCase } from '@pahcer/core/application/visualizerUseCase';
import { ComparisonConfigRepository } from './comparisonConfigRepository';
import { ExecutionRepository } from './executionRepository';
import { FileAnalyzer } from './fileAnalyzer';
import { GitignoreAdapter } from './gitignoreAdapter';
import { InOutFilesAdapter } from './inOutFilesAdapter';
import { NodeGitAdapter } from './nodeGitAdapter';
import { NodePahcerAdapter } from './nodePahcerAdapter';
import { PahcerConfigRepository } from './pahcerConfigRepository';
import { PahcerUIConfig } from './pahcerUIConfig';
import { TestCaseRepository } from './testCaseRepository';
import { TestCaseSummaryQueryService } from './testCaseSummaryQueryService';
import { TesterDownloader } from './testerDownloader';
import { VisualizerAdapter } from './visualizerAdapter';

export function createPahcerRuntime(
  workspaceRoot: string,
  options: { streamPahcerOutput?: boolean } = {},
): PahcerRuntime {
  const executionRepository = new ExecutionRepository(workspaceRoot);
  const inOutFilesAdapter = new InOutFilesAdapter(workspaceRoot);
  const testCaseRepository = new TestCaseRepository(inOutFilesAdapter, workspaceRoot);
  const testCaseSummaryQueryService = new TestCaseSummaryQueryService(workspaceRoot);
  const comparisonConfigRepository = new ComparisonConfigRepository(workspaceRoot);
  const pahcerConfigRepository = new PahcerConfigRepository(workspaceRoot);
  const appConfig = new PahcerUIConfig(workspaceRoot);
  const gitAdapter = new NodeGitAdapter(workspaceRoot);
  const pahcerAdapter = new NodePahcerAdapter(
    pahcerConfigRepository,
    workspaceRoot,
    options.streamPahcerOutput === true,
  );
  const commitResults = new CommitResultsUseCase(gitAdapter, appConfig);

  return {
    appConfig,
    status: new CheckPahcerStatusUseCase(pahcerAdapter),
    initialize: new InitializeUseCase(
      new TesterDownloader(workspaceRoot),
      new GitignoreAdapter(workspaceRoot),
      pahcerAdapter,
      pahcerConfigRepository,
      path.basename(workspaceRoot),
    ),
    run: new RunPahcerUseCase(
      pahcerAdapter,
      commitResults,
      inOutFilesAdapter,
      new FileAnalyzer(),
      executionRepository,
      testCaseRepository,
      pahcerConfigRepository,
    ),
    tree: new LoadPahcerTreeDataUseCase(
      executionRepository,
      testCaseRepository,
      testCaseSummaryQueryService,
      pahcerConfigRepository,
    ),
    comparison: new LoadComparisonDataUseCase(
      executionRepository,
      testCaseRepository,
      testCaseSummaryQueryService,
      comparisonConfigRepository,
      pahcerConfigRepository,
    ),
    updateComment: new UpdateExecutionCommentUseCase(executionRepository),
    openCaseFile: new OpenCaseFileUseCase(inOutFilesAdapter),
    copySource: new CopySourceAtExecutionUseCase(executionRepository, gitAdapter),
    diff: new ShowExecutionDiffUseCase(executionRepository, gitAdapter),
    visualizer: new VisualizerUseCase(
      inOutFilesAdapter,
      executionRepository,
      new VisualizerAdapter(workspaceRoot),
    ),
  };
}

/**
 * Use cases wired for a workspace.
 *
 * Only use cases are exposed: callers go through the application layer instead
 * of reaching for repositories and adapters directly. `appConfig` is the one
 * exception, as UI preferences have no use case of their own.
 */
export interface PahcerRuntime {
  appConfig: PahcerUIConfig;
  status: CheckPahcerStatusUseCase;
  initialize: InitializeUseCase;
  run: RunPahcerUseCase;
  tree: LoadPahcerTreeDataUseCase;
  comparison: LoadComparisonDataUseCase;
  updateComment: UpdateExecutionCommentUseCase;
  openCaseFile: OpenCaseFileUseCase;
  copySource: CopySourceAtExecutionUseCase;
  diff: ShowExecutionDiffUseCase;
  visualizer: VisualizerUseCase;
}
