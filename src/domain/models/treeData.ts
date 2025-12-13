import type { ExecutionStatsCalculator } from '../services/executionStatsAggregator';
import type { PahcerConfig } from './configFile';
import type { Execution } from './execution';
import type { TestCase } from './testCase';

/**
 * TreeView 表示用のデータを保持するドメインモデル
 * ユースケース層で準備された計算済みデータを集約
 */
export class TreeData {
  constructor(
    /**
     * 実行結果のメタデータ
     */
    public readonly executions: Execution[],

    /**
     * すべてのテストケース
     */
    public readonly testCases: TestCase[],

    /**
     * pahcer 設定
     */
    public readonly config: PahcerConfig,

    /**
     * seed => ベストスコア のマップ
     */
    public readonly bestScores: Map<number, number>,

    /**
     * 実行ごとの集計情報（ソート順序は不定）
     */
    public readonly executionStatsList: ExecutionStatsCalculator.ExecutionStats[],
  ) {}
}
