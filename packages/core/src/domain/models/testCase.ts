export class TestCaseId {
  constructor(
    /** 実行ID */
    public readonly executionId: string,
    /** Seed番号 */
    public readonly seed: number,
  ) {}

  toString(): string {
    return `${this.executionId}:${this.seed}`;
  }
}

/**
 * テストケースのドメインモデル（集約ルート）
 * executionId と seed の複合キーで識別
 * 実行結果のデータと解析データを包含
 */
export class TestCase {
  constructor(
    /** ID */
    public readonly id: TestCaseId,
    /** スコア（0以下の場合は WA） */
    public readonly score: number,
    /** 実行時間（秒） */
    public readonly executionTime: number,
    /** エラーメッセージ */
    public readonly errorMessage: string,
    /** 出力ファイルが見つかったかどうか */
    public readonly foundOutput: boolean,
    /** 入力ファイルの1行目（feature抽出用） */
    public firstInputLine?: string,
    /** 標準エラー出力から抽出した変数 */
    public stderrVars?: Record<string, number>,
  ) {}
}
