import dayjs from 'dayjs';
import type {
  ConfirmGitIntegration,
  IGitIntegrationConfig,
} from '../../src/application/commitResultsUseCase';
import { ComparisonConfig } from '../../src/application/dtos/comparisonConfig';
import type { TreeViewTestCaseSummary } from '../../src/application/dtos/pahcerTreeData';
import type { ITestCaseSummaryQueryService } from '../../src/application/queryServices/testCaseSummaryQueryService';
import type { IComparisonConfigRepository } from '../../src/application/repositories/IComparisonConfigRepository';
import type { IExecutionRepository } from '../../src/domain/interfaces/IExecutionRepository';
import type { IFileAnalyzer } from '../../src/domain/interfaces/IFileAnalyzer';
import type { IGitAdapter } from '../../src/domain/interfaces/IGitAdapter';
import type { IGitignoreAdapter } from '../../src/domain/interfaces/IGitignoreAdapter';
import type { IInOutFilesAdapter } from '../../src/domain/interfaces/IInOutFilesAdapter';
import type { IPahcerAdapter } from '../../src/domain/interfaces/IPahcerAdapter';
import type { IPahcerConfigRepository } from '../../src/domain/interfaces/IPahcerConfigRepository';
import type { ITestCaseRepository } from '../../src/domain/interfaces/ITestCaseRepository';
import type {
  DownloadedTester,
  ITesterDownloader,
} from '../../src/domain/interfaces/ITesterDownloader';
import type { IVisualizerAdapter } from '../../src/domain/interfaces/IVisualizerAdapter';
import { type ConfigId, PahcerConfig } from '../../src/domain/models/configFile';
import { Execution } from '../../src/domain/models/execution';
import { type PahcerRunOptions, PahcerStatus } from '../../src/domain/models/pahcerStatus';
import { TestCase, TestCaseId } from '../../src/domain/models/testCase';

export function execution({
  id = '20260101010101',
  isoTime = '2026-01-01T01:01:01',
  comment = '',
  tagName = null,
  commitHash,
}: {
  id?: string;
  isoTime?: string;
  comment?: string;
  tagName?: string | null;
  commitHash?: string;
} = {}): Execution {
  return new Execution(id, dayjs(isoTime), comment, tagName, commitHash);
}

export function testCase({
  executionId = '20260101010101',
  seed = 0,
  score = 10,
  executionTime = 1,
  errorMessage = '',
  foundOutput = true,
  firstInputLine,
  stderrVars,
}: {
  executionId?: string;
  seed?: number;
  score?: number;
  executionTime?: number;
  errorMessage?: string;
  foundOutput?: boolean;
  firstInputLine?: string;
  stderrVars?: Record<string, number>;
} = {}): TestCase {
  return new TestCase(
    new TestCaseId(executionId, seed),
    score,
    executionTime,
    errorMessage,
    foundOutput,
    firstInputLine,
    stderrVars,
  );
}

export function config(objective: 'max' | 'min' = 'max'): PahcerConfig {
  return new PahcerConfig('normal', 'pahcer_config.toml', 'problem', 0, 9, objective);
}

export class InMemoryExecutionRepository implements IExecutionRepository {
  upserted: Execution[] = [];

  constructor(public executions: Execution[] = []) {}

  async findById(executionId: string): Promise<Execution | undefined> {
    return this.executions.find((item) => item.id === executionId);
  }

  async findAll(): Promise<Execution[]> {
    return this.executions;
  }

  async upsert(execution: Execution): Promise<void> {
    this.upserted.push(execution);
    const index = this.executions.findIndex((item) => item.id === execution.id);
    if (index >= 0) {
      this.executions[index] = execution;
    } else {
      this.executions.push(execution);
    }
  }
}

export class InMemoryTestCaseRepository implements ITestCaseRepository {
  upserted: TestCase[] = [];

  constructor(public testCases: TestCase[] = []) {}

  async findById(id: TestCaseId): Promise<TestCase | undefined> {
    return this.testCases.find(
      (item) => item.id.executionId === id.executionId && item.id.seed === id.seed,
    );
  }

  async findByExecutionId(executionId: string): Promise<TestCase[]> {
    return this.testCases.filter((item) => item.id.executionId === executionId);
  }

  async upsert(testCase: TestCase): Promise<void> {
    this.upserted.push(testCase);
    const index = this.testCases.findIndex(
      (item) =>
        item.id.executionId === testCase.id.executionId && item.id.seed === testCase.id.seed,
    );
    if (index >= 0) {
      this.testCases[index] = testCase;
    } else {
      this.testCases.push(testCase);
    }
  }
}

export class InMemoryPahcerConfigRepository implements IPahcerConfigRepository {
  configs = new Map<ConfigId, PahcerConfig>();
  upserted: PahcerConfig[] = [];
  deleted: ConfigId[] = [];

  constructor(normalConfig: PahcerConfig | null = config('max')) {
    if (normalConfig) {
      this.configs.set('normal', normalConfig);
    }
  }

  async findById(id: ConfigId): Promise<PahcerConfig | undefined> {
    return this.configs.get(id);
  }

  async upsert(config: PahcerConfig): Promise<void> {
    this.upserted.push(config);
    this.configs.set(config.id, config);
  }

  async delete(id: ConfigId): Promise<void> {
    this.deleted.push(id);
    this.configs.delete(id);
  }
}

export class InMemoryComparisonConfigRepository implements IComparisonConfigRepository {
  upserted: ComparisonConfig[] = [];

  constructor(public comparisonConfig = new ComparisonConfig()) {}

  async find(): Promise<ComparisonConfig> {
    return this.comparisonConfig;
  }

  async upsert(config: ComparisonConfig): Promise<void> {
    this.upserted.push(config);
    this.comparisonConfig = config;
  }
}

export class InMemoryTestCaseSummaryQueryService implements ITestCaseSummaryQueryService {
  constructor(public summaries: TreeViewTestCaseSummary[] = []) {}

  async findByExecutionId(executionId: string): Promise<TreeViewTestCaseSummary[]> {
    return this.summaries.filter((item) => item.executionId === executionId);
  }
}

export class FakePahcerAdapter implements IPahcerAdapter {
  status = PahcerStatus.Ready;
  runCalls: Array<{ options?: PahcerRunOptions; config?: PahcerConfig }> = [];
  initCalls: Array<{
    problemName: string;
    objective: 'max' | 'min';
    language: 'rust' | 'cpp' | 'python' | 'go';
    isInteractive: boolean;
  }> = [];
  runError?: Error;
  initError?: Error;

  async checkStatus(): Promise<PahcerStatus> {
    return this.status;
  }

  async run(options?: PahcerRunOptions, runConfig?: PahcerConfig): Promise<number | undefined> {
    this.runCalls.push({ options, config: runConfig });
    if (this.runError) {
      throw this.runError;
    }
    return 0;
  }

  async init(
    problemName: string,
    objective: 'max' | 'min',
    language: 'rust' | 'cpp' | 'python' | 'go',
    isInteractive: boolean,
  ): Promise<number | undefined> {
    this.initCalls.push({ problemName, objective, language, isInteractive });
    if (this.initError) {
      throw this.initError;
    }
    return 0;
  }
}

export class FakeGitAdapter implements IGitAdapter {
  commitHashes: string[] = ['abcdef123456'];
  commitMessages: string[] = [];
  diffCalls: Array<{
    olderCommitHash: string;
    newerCommitHash: string;
    leftTitle: string;
    rightTitle: string;
  }> = [];
  sourceFiles = new Map<string, string[]>();
  fileContents = new Map<string, string>();
  isRepository = true;
  commitError?: Error;

  async commitAll(message: string): Promise<string> {
    this.commitMessages.push(message);
    if (this.commitError) {
      throw this.commitError;
    }
    return this.commitHashes.shift() ?? 'abcdef123456';
  }

  async showDiff(
    olderCommitHash: string,
    newerCommitHash: string,
    leftTitle: string,
    rightTitle: string,
  ): Promise<void> {
    this.diffCalls.push({ olderCommitHash, newerCommitHash, leftTitle, rightTitle });
  }

  isGitRepository(): boolean {
    return this.isRepository;
  }

  async getSourceFilesAtCommit(commitHash: string): Promise<string[]> {
    return this.sourceFiles.get(commitHash) ?? [];
  }

  async getFileContentAtCommit(commitHash: string, filePath: string): Promise<string> {
    return this.fileContents.get(`${commitHash}:${filePath}`) ?? '';
  }
}

export class InMemoryGitIntegrationConfig implements IGitIntegrationConfig {
  saved: boolean[] = [];

  constructor(public value: boolean | null = null) {}

  async gitIntegration(): Promise<boolean | null> {
    return this.value;
  }

  async setGitIntegration(enabled: boolean): Promise<void> {
    this.saved.push(enabled);
    this.value = enabled;
  }
}

export class FakeInOutFilesAdapter implements IInOutFilesAdapter {
  removedOutputs = 0;
  archivedExecutionIds: string[] = [];
  inputs = new Map<number, string>();
  archived = new Map<string, string>();

  getNonArchivedPath(type: 'in' | 'out' | 'err', seed: number): string {
    return `tools/${type}/${String(seed).padStart(4, '0')}.txt`;
  }

  getArchivedPath(type: 'out' | 'err', id: TestCaseId): string {
    return `.pahcer-ui/results/result_${id.executionId}/${type}/${String(id.seed).padStart(4, '0')}.txt`;
  }

  async loadArchived(type: 'out' | 'err', id: TestCaseId): Promise<string> {
    return this.archived.get(`${type}:${id.executionId}:${id.seed}`) ?? '';
  }

  async loadIn(seed: number): Promise<string> {
    return this.inputs.get(seed) ?? '';
  }

  async removeOutputs(): Promise<void> {
    this.removedOutputs++;
  }

  async archiveOutputs(executionId: string): Promise<void> {
    this.archivedExecutionIds.push(executionId);
  }
}

export class FakeFileAnalyzer implements IFileAnalyzer {
  firstLines = new Map<string, string>();
  headAndTail = new Map<string, { head: string; tail: string }>();
  stderrVariables = new Map<string, Record<string, number>>();

  async readFirstLine(filePath: string): Promise<string> {
    return this.firstLines.get(filePath) ?? '';
  }

  async readHeadAndTail(filePath: string): Promise<{ head: string; tail: string }> {
    return this.headAndTail.get(filePath) ?? { head: '', tail: '' };
  }

  async readFirstLinesParallel(filePaths: string[]): Promise<Map<string, string>> {
    return new Map(filePaths.map((filePath) => [filePath, this.firstLines.get(filePath) ?? '']));
  }

  async readHeadAndTailParallel(
    filePaths: string[],
  ): Promise<Map<string, { head: string; tail: string }>> {
    return new Map(
      filePaths.map((filePath) => [
        filePath,
        this.headAndTail.get(filePath) ?? { head: '', tail: '' },
      ]),
    );
  }

  async parseStderrVariables(filePath: string): Promise<Record<string, number>> {
    return this.stderrVariables.get(filePath) ?? {};
  }

  async parseStderrVariablesParallel(
    filePaths: string[],
  ): Promise<Map<string, Record<string, number>>> {
    return new Map(
      filePaths.map((filePath) => [filePath, this.stderrVariables.get(filePath) ?? {}]),
    );
  }
}

export class FakeTesterDownloader implements ITesterDownloader {
  downloadedUrls: string[] = [];
  result: DownloadedTester = { seemsInteractive: false };
  error?: Error;

  async downloadAndExtract(url: string): Promise<DownloadedTester> {
    this.downloadedUrls.push(url);
    if (this.error) {
      throw this.error;
    }
    return this.result;
  }
}

export class FakeGitignoreAdapter implements IGitignoreAdapter {
  entries: string[] = [];
  error?: Error;

  getGitignorePath(): string {
    return '.gitignore';
  }

  async addEntry(entry: string): Promise<void> {
    this.entries.push(entry);
    if (this.error) {
      throw this.error;
    }
  }
}

export class FakeVisualizerAdapter implements IVisualizerAdapter {
  cachedHtmlFileName: string | null = null;
  downloadedUrls: string[] = [];
  resources = new Set<string>();
  html = new Map<string, string>();
  visualizerDir = '.pahcer-ui/visualizer';

  async getCachedHtmlFileName(): Promise<string | null> {
    return this.cachedHtmlFileName;
  }

  async download(url: string): Promise<string> {
    this.downloadedUrls.push(url);
    return 'visualizer.html';
  }

  getHtmlPath(fileName: string): string {
    return `${this.visualizerDir}/${fileName}`;
  }

  async readHtml(fileName: string): Promise<string> {
    return this.html.get(fileName) ?? '';
  }

  getResourcePath(fileName: string): string {
    return `${this.visualizerDir}/${fileName}`;
  }

  async resourceExists(fileName: string): Promise<boolean> {
    return this.resources.has(fileName);
  }

  getVisualizerDir(): string {
    return this.visualizerDir;
  }
}

export const confirmGitIntegration =
  (value: boolean): ConfirmGitIntegration =>
  async () =>
    value;
