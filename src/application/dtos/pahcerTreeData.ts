import type { PahcerConfig } from '../../domain/models/configFile';
import type { Execution } from '../../domain/models/execution';
import type { TestCase, TestCaseId } from '../../domain/models/testCase';
import type { ExecutionStatsCalculator } from '../../domain/services/executionStatsAggregator';
import type { SeedStatsCalculator } from '../../domain/services/seedStatsCalculator';

/**
 * TreeView の集計表示に必要な軽量テストケース情報。
 *
 * Entity ではなく、TreeView 表示ユースケース向けの参照専用 DTO。
 */
export class TreeViewTestCaseSummary {
  constructor(
    public readonly id: TestCaseId,
    public readonly score: number,
    public readonly executionTime: number,
    public readonly errorMessage: string,
  ) {}
}

/**
 * TreeView 表示ユースケース向けの集約 DTO。
 */
export class PahcerTreeData {
  constructor(
    public readonly executions: Execution[],
    public readonly testCases: TreeViewTestCaseSummary[],
    public readonly config: PahcerConfig,
    public readonly bestScores: Map<number, number>,
    public readonly executionStatsList: ExecutionStatsCalculator.ExecutionStats[],
  ) {}
}

export interface TreeExecutionCase {
  testCase: TestCase;
  relativeScore: number;
}

export interface TreeExecutionCases {
  executionStats: ExecutionStatsCalculator.ExecutionStats;
  cases: TreeExecutionCase[];
}

export interface TreeSeedExecution {
  execution: Execution;
  testCase: TestCase;
  relativeScore: number;
  isLatest: boolean;
}

export type TreeSeedStats = SeedStatsCalculator.SeedStats;
