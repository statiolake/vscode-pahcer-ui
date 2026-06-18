import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CheckPahcerStatusUseCase } from '../../src/application/checkPahcerStatusUseCase';
import { CommitResultsUseCase } from '../../src/application/commitResultsUseCase';
import { CopySourceAtExecutionUseCase } from '../../src/application/copySourceAtExecutionUseCase';
import { PreconditionFailedError } from '../../src/application/exceptions';
import { InitializeError, InitializeUseCase } from '../../src/application/initializeUseCase';
import { OpenCaseFileUseCase } from '../../src/application/openCaseFileUseCase';
import { RunPahcerUseCase } from '../../src/application/runPahcerUseCase';
import { ShowExecutionDiffUseCase } from '../../src/application/showExecutionDiffUseCase';
import { UpdateExecutionCommentUseCase } from '../../src/application/updateExecutionCommentUseCase';
import { VisualizerUseCase } from '../../src/application/visualizerUseCase';
import { PahcerConfig } from '../../src/domain/models/configFile';
import { PahcerRunOptions, PahcerStatus } from '../../src/domain/models/pahcerStatus';
import { ExecutionStatsCalculator } from '../../src/domain/services/executionStatsAggregator';
import {
  config,
  confirmGitIntegration,
  execution,
  FakeFileAnalyzer,
  FakeGitAdapter,
  FakeGitignoreAdapter,
  FakeInOutFilesAdapter,
  FakePahcerAdapter,
  FakeTesterDownloader,
  FakeVisualizerAdapter,
  InMemoryExecutionRepository,
  InMemoryGitIntegrationConfig,
  InMemoryPahcerConfigRepository,
  InMemoryTestCaseRepository,
  testCase,
} from './testDoubles';

describe('simple use cases', () => {
  it('maps pahcer status to UI status and readiness', async () => {
    const pahcerAdapter = new FakePahcerAdapter();
    const useCase = new CheckPahcerStatusUseCase(pahcerAdapter);

    pahcerAdapter.status = PahcerStatus.NotInstalled;
    assert.equal(await useCase.check(), 'notInstalled');
    assert.equal(await useCase.isReady(), false);

    pahcerAdapter.status = PahcerStatus.NotInitialized;
    assert.equal(await useCase.check(), 'notInitialized');

    pahcerAdapter.status = PahcerStatus.Ready;
    assert.equal(await useCase.check(), 'ready');
    assert.equal(await useCase.isReady(), true);
  });

  it('updates execution comments only when execution exists', async () => {
    const executionRepository = new InMemoryExecutionRepository([
      execution({ id: 'e1', comment: 'before' }),
    ]);
    const useCase = new UpdateExecutionCommentUseCase(executionRepository);

    assert.equal(await useCase.update('missing', 'after'), false);
    assert.equal(await useCase.update('e1', 'after'), true);
    assert.equal((await executionRepository.findById('e1'))?.comment, 'after');
    assert.equal(executionRepository.upserted.length, 1);
  });

  it('resolves input, output, and error paths for case files', () => {
    const inOutFilesAdapter = new FakeInOutFilesAdapter();
    const useCase = new OpenCaseFileUseCase(inOutFilesAdapter);

    assert.equal(useCase.resolvePath({ kind: 'input', seed: 1 }), 'tools/in/0001.txt');
    assert.equal(
      useCase.resolvePath({ kind: 'output', executionId: 'e1', seed: 2 }),
      '.pahcer-ui/results/result_e1/out/0002.txt',
    );
    assert.equal(
      useCase.resolvePath({ kind: 'error', executionId: 'e1', seed: 3 }),
      '.pahcer-ui/results/result_e1/err/0003.txt',
    );
    assert.equal(useCase.resolvePath({ kind: 'output', seed: 2 }), undefined);
  });
});

describe('CommitResultsUseCase', () => {
  it('asks once for git integration and commits before execution when enabled', async () => {
    const gitAdapter = new FakeGitAdapter();
    gitAdapter.commitHashes = ['before123456'];
    const gitIntegrationConfig = new InMemoryGitIntegrationConfig(null);
    const useCase = new CommitResultsUseCase(gitAdapter, gitIntegrationConfig);

    const result = await useCase.commitBeforeExecution(confirmGitIntegration(true));

    assert.deepEqual(result, {
      commitHash: 'before123456',
      message: 'コミット作成: before1',
    });
    assert.deepEqual(gitIntegrationConfig.saved, [true]);
    assert.deepEqual(gitAdapter.commitMessages, ['Run']);
  });

  it('does not ask or commit when repository is unavailable or git integration is disabled', async () => {
    const gitAdapter = new FakeGitAdapter();
    gitAdapter.isRepository = false;
    const unsetConfig = new InMemoryGitIntegrationConfig(null);
    const unsetUseCase = new CommitResultsUseCase(gitAdapter, unsetConfig);

    assert.deepEqual(await unsetUseCase.commitBeforeExecution(confirmGitIntegration(true)), {
      commitHash: null,
    });
    assert.deepEqual(unsetConfig.saved, []);

    const disabledUseCase = new CommitResultsUseCase(
      new FakeGitAdapter(),
      new InMemoryGitIntegrationConfig(false),
    );
    assert.deepEqual(await disabledUseCase.commitBeforeExecution(confirmGitIntegration(true)), {
      commitHash: null,
    });
  });

  it('commits results with a stats-derived message and reports failures', async () => {
    const gitAdapter = new FakeGitAdapter();
    gitAdapter.commitHashes = ['after123456'];
    const useCase = new CommitResultsUseCase(gitAdapter, new InMemoryGitIntegrationConfig(true));
    const stats = new ExecutionStatsCalculator.ExecutionStats(
      execution({ id: 'e1' }),
      [],
      2,
      30,
      3,
      [],
      2,
      15,
      100,
    );

    assert.deepEqual(await useCase.commitAfterExecution(stats), {
      commitHash: 'after123456',
      message: '結果コミット作成: after12',
    });
    assert.deepEqual(gitAdapter.commitMessages, ['Results - 2 cases, total score: 30, avg: 15.00']);

    gitAdapter.commitError = new Error('git failed');
    assert.deepEqual(await useCase.commitAfterExecution(stats), {
      commitHash: null,
      message: '結果コミット作成に失敗しました: git failed',
    });
  });
});

describe('InitializeUseCase', () => {
  it('downloads tester, accepts detected interactivity, updates gitignore, and runs init', async () => {
    const testerDownloader = new FakeTesterDownloader();
    testerDownloader.result = { seemsInteractive: true };
    const gitignoreAdapter = new FakeGitignoreAdapter();
    const pahcerAdapter = new FakePahcerAdapter();
    const useCase = new InitializeUseCase(
      testerDownloader,
      gitignoreAdapter,
      pahcerAdapter,
      new InMemoryPahcerConfigRepository(),
      'workspace-name',
    );

    await useCase.handle({
      problemName: 'abc001',
      objective: 'max',
      language: 'rust',
      isInteractive: false,
      testerUrl: 'https://example.com/tester.zip',
      confirmToUseDetected: async () => true,
    });

    assert.deepEqual(testerDownloader.downloadedUrls, ['https://example.com/tester.zip']);
    assert.deepEqual(gitignoreAdapter.entries, ['tools/target']);
    assert.deepEqual(pahcerAdapter.initCalls, [
      {
        problemName: 'abc001',
        objective: 'max',
        language: 'rust',
        isInteractive: true,
      },
    ]);
  });

  it('uses workspace name as default project name until config exists', async () => {
    const configRepository = new InMemoryPahcerConfigRepository(null);
    const useCase = new InitializeUseCase(
      new FakeTesterDownloader(),
      new FakeGitignoreAdapter(),
      new FakePahcerAdapter(),
      configRepository,
      'workspace-name',
    );

    assert.equal(await useCase.getDefaultProjectName(), 'workspace-name');
    configRepository.configs.set(
      'normal',
      new PahcerConfig('normal', 'pahcer_config.toml', 'abc001', 0, 9, 'max'),
    );
    assert.equal(await useCase.getDefaultProjectName(), 'abc001');
  });

  it('wraps init errors', async () => {
    const pahcerAdapter = new FakePahcerAdapter();
    pahcerAdapter.initError = new Error('init failed');
    const useCase = new InitializeUseCase(
      new FakeTesterDownloader(),
      new FakeGitignoreAdapter(),
      pahcerAdapter,
      new InMemoryPahcerConfigRepository(),
      'workspace-name',
    );

    await assert.rejects(
      () =>
        useCase.handle({
          problemName: 'abc001',
          objective: 'max',
          language: 'rust',
          isInteractive: false,
          testerUrl: '',
          confirmToUseDetected: async () => false,
        }),
      InitializeError,
    );
  });
});

describe('RunPahcerUseCase', () => {
  it('orchestrates run, temporary config, analysis, and git commits', async () => {
    const pahcerAdapter = new FakePahcerAdapter();
    const gitAdapter = new FakeGitAdapter();
    gitAdapter.commitHashes = ['beforeabcdef', 'afterabcdef'];
    const commitUseCase = new CommitResultsUseCase(
      gitAdapter,
      new InMemoryGitIntegrationConfig(true),
    );
    const inOutFilesAdapter = new FakeInOutFilesAdapter();
    const fileAnalyzer = new FakeFileAnalyzer();
    const latestExecution = execution({ id: 'e2' });
    const executionRepository = new InMemoryExecutionRepository([latestExecution]);
    const cases = [
      testCase({ executionId: 'e2', seed: 0, score: 10 }),
      testCase({ executionId: 'e2', seed: 1, score: 20 }),
    ];
    const testCaseRepository = new InMemoryTestCaseRepository(cases);
    const configRepository = new InMemoryPahcerConfigRepository(config('max'));
    configRepository.configs.set(
      'temporary',
      new PahcerConfig('temporary', 'temp_pahcer_config.toml', 'problem', 0, 9, 'max'),
    );
    fileAnalyzer.firstLines.set('tools/in/0000.txt', 'N=1');
    fileAnalyzer.firstLines.set('tools/in/0001.txt', 'N=2');
    fileAnalyzer.stderrVariables.set('.pahcer-ui/results/result_e2/err/0000.txt', { width: 10 });
    fileAnalyzer.stderrVariables.set('.pahcer-ui/results/result_e2/err/0001.txt', { width: 20 });

    const useCase = new RunPahcerUseCase(
      pahcerAdapter,
      commitUseCase,
      inOutFilesAdapter,
      fileAnalyzer,
      executionRepository,
      testCaseRepository,
      configRepository,
    );

    const result = await useCase.handle({
      options: new PahcerRunOptions(1, 3, true),
      confirmGitIntegration: confirmGitIntegration(true),
    });

    assert.deepEqual(result.messages, ['コミット作成: beforea', '結果コミット作成: afterab']);
    assert.equal(configRepository.upserted[0].startSeed, 1);
    assert.equal(configRepository.upserted[0].endSeed, 3);
    assert.deepEqual(configRepository.deleted, ['temporary']);
    assert.equal(pahcerAdapter.runCalls[0].config?.id, 'temporary');
    assert.deepEqual(inOutFilesAdapter.archivedExecutionIds, ['e2']);
    assert.equal(inOutFilesAdapter.removedOutputs, 2);
    assert.equal(cases[0].firstInputLine, 'N=1');
    assert.deepEqual(cases[1].stderrVars, { width: 20 });
    assert.equal(latestExecution.commitHash, 'beforeabcdef');
    assert.deepEqual(gitAdapter.commitMessages, [
      'Run',
      'Results - 2 cases, total score: 30, avg: 15.00',
    ]);
  });

  it('cleans temporary config even when pahcer run fails', async () => {
    const pahcerAdapter = new FakePahcerAdapter();
    pahcerAdapter.runError = new Error('run failed');
    const configRepository = new InMemoryPahcerConfigRepository(config('max'));
    configRepository.configs.set(
      'temporary',
      new PahcerConfig('temporary', 'temp_pahcer_config.toml', 'problem', 0, 9, 'max'),
    );
    const useCase = new RunPahcerUseCase(
      pahcerAdapter,
      new CommitResultsUseCase(new FakeGitAdapter(), new InMemoryGitIntegrationConfig(false)),
      new FakeInOutFilesAdapter(),
      new FakeFileAnalyzer(),
      new InMemoryExecutionRepository([]),
      new InMemoryTestCaseRepository([]),
      configRepository,
    );

    await assert.rejects(
      () =>
        useCase.handle({
          options: new PahcerRunOptions(1, undefined, false),
          confirmGitIntegration: confirmGitIntegration(false),
        }),
      /run failed/,
    );
    assert.deepEqual(configRepository.deleted, ['temporary']);
  });

  it('fails when no execution is produced', async () => {
    const useCase = new RunPahcerUseCase(
      new FakePahcerAdapter(),
      new CommitResultsUseCase(new FakeGitAdapter(), new InMemoryGitIntegrationConfig(false)),
      new FakeInOutFilesAdapter(),
      new FakeFileAnalyzer(),
      new InMemoryExecutionRepository([]),
      new InMemoryTestCaseRepository([]),
      new InMemoryPahcerConfigRepository(config('max')),
    );

    await assert.rejects(
      () =>
        useCase.handle({
          options: new PahcerRunOptions(),
          confirmGitIntegration: confirmGitIntegration(false),
        }),
      PreconditionFailedError,
    );
  });
});

describe('diff, copy, and visualizer use cases', () => {
  it('shows execution diff ordered by execution time and reports invalid states', async () => {
    const executionRepository = new InMemoryExecutionRepository([
      execution({ id: 'old', isoTime: '2026-01-01T00:00:00', commitHash: 'oldhash' }),
      execution({ id: 'new', isoTime: '2026-01-02T00:00:00', commitHash: 'newhash' }),
      execution({ id: 'missingHash', isoTime: '2026-01-03T00:00:00' }),
    ]);
    const gitAdapter = new FakeGitAdapter();
    const useCase = new ShowExecutionDiffUseCase(executionRepository, gitAdapter);

    assert.deepEqual(await useCase.showDiff(['new', 'old']), { status: 'shown' });
    assert.equal(gitAdapter.diffCalls[0].olderCommitHash, 'oldhash');
    assert.equal(gitAdapter.diffCalls[0].newerCommitHash, 'newhash');
    assert.deepEqual(await useCase.showDiff(['old']), { status: 'invalidSelection' });
    assert.deepEqual(await useCase.showDiff(['old', 'missingHash']), {
      status: 'missingCommitHash',
    });
    assert.equal(await useCase.canShowDiff(['old', 'new']), true);
    assert.equal(await useCase.canShowDiff(['old', 'missingHash']), false);
  });

  it('prepares and loads source files from an execution commit', async () => {
    const executionRepository = new InMemoryExecutionRepository([
      execution({ id: 'e1', commitHash: 'hash1' }),
      execution({ id: 'withoutHash' }),
    ]);
    const gitAdapter = new FakeGitAdapter();
    gitAdapter.sourceFiles.set('hash1', ['src/main.rs']);
    gitAdapter.fileContents.set('hash1:src/main.rs', 'fn main() {}');
    const useCase = new CopySourceAtExecutionUseCase(executionRepository, gitAdapter);

    assert.deepEqual(await useCase.prepare('missing'), { status: 'notFound' });
    assert.deepEqual(await useCase.prepare('withoutHash'), { status: 'missingCommitHash' });
    assert.deepEqual(await useCase.prepare('e1'), {
      status: 'ready',
      files: ['src/main.rs'],
    });
    assert.equal(await useCase.loadContent('e1', 'src/main.rs'), 'fn main() {}');
    assert.equal(await useCase.loadContent('withoutHash', 'src/main.rs'), undefined);

    gitAdapter.sourceFiles.set('hash1', []);
    assert.deepEqual(await useCase.prepare('e1'), { status: 'noFiles' });
  });

  it('delegates visualizer operations and loads case data', async () => {
    const inOutFilesAdapter = new FakeInOutFilesAdapter();
    inOutFilesAdapter.inputs.set(1, 'input');
    inOutFilesAdapter.archived.set('out:e1:1', 'output');
    const visualizerAdapter = new FakeVisualizerAdapter();
    visualizerAdapter.cachedHtmlFileName = 'index.html';
    visualizerAdapter.html.set('index.html', '<html></html>');
    visualizerAdapter.resources.add('main.js');
    const useCase = new VisualizerUseCase(
      inOutFilesAdapter,
      new InMemoryExecutionRepository([execution({ id: 'e1' })]),
      visualizerAdapter,
    );

    assert.equal(await useCase.getCachedHtmlFileName(), 'index.html');
    assert.equal(await useCase.download('https://example.com/index.html'), 'visualizer.html');
    assert.equal(useCase.getVisualizerDir(), '.pahcer-ui/visualizer');
    assert.equal(await useCase.readHtml('index.html'), '<html></html>');
    assert.equal(await useCase.resourceExists('main.js'), true);
    assert.equal(useCase.getResourcePath('main.js'), '.pahcer-ui/visualizer/main.js');
    assert.deepEqual(await useCase.loadCaseData(1, 'e1'), {
      executionTimeLabel: ' (1/1/2026, 1:01:01 AM)',
      input: 'input',
      output: 'output',
    });
  });
});
