/**
 * Tree 表示ユースケース向けの実行結果 DTO。
 */
export interface TreeExecutionSummary {
  id: string;
  shortTitle: string;
  longTitle: string;
  titleWithHash: string;
  startTimeMillis: number;
  comment: string;
  tagName: string | null;
  commitHash?: string;
}

/**
 * Tree 表示ユースケース向けのテストケース DTO。
 */
export interface TreeTestCase {
  executionId: string;
  seed: number;
  score: number;
  executionTime: number;
  errorMessage: string;
  foundOutput: boolean;
}

/**
 * Tree の集計表示に必要な軽量テストケース情報。
 */
export interface TreeViewTestCaseSummary {
  executionId: string;
  seed: number;
  score: number;
  executionTime: number;
  errorMessage: string;
}

export interface TreeExecutionStats {
  execution: TreeExecutionSummary;
  caseCount: number;
  acCount: number;
  totalScore: number;
  averageScore: number;
  averageRelativeScore: number;
  maxExecutionTime: number;
  waSeeds: number[];
}

/**
 * Tree 表示ユースケース向けの集約 DTO。
 */
export class PahcerTreeData {
  constructor(
    public readonly executions: TreeExecutionSummary[],
    public readonly testCases: TreeViewTestCaseSummary[],
    public readonly objective: 'max' | 'min',
    public readonly bestScores: Map<number, number>,
    public readonly executionStatsList: TreeExecutionStats[],
  ) {}
}

export interface TreeExecutionCase {
  testCase: TreeTestCase;
  relativeScore: number;
}

export interface TreeExecutionCases {
  executionStats: TreeExecutionStats;
  cases: TreeExecutionCase[];
}

export interface TreeSeedExecution {
  execution: TreeExecutionSummary;
  testCase: TreeTestCase;
  relativeScore: number;
  isLatest: boolean;
}

export interface TreeSeedStats {
  seed: number;
  count: number;
  averageScore: number;
  averageRelativeScore: number;
  bestScore: number;
}
