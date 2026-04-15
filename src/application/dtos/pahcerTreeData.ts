import type { PahcerConfig } from '../../domain/models/configFile';
import type { Execution } from '../../domain/models/execution';
import type { TestCaseId } from '../../domain/models/testCase';
import type { ExecutionStatsCalculator } from '../../domain/services/executionStatsAggregator';

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
