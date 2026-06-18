import type { Execution } from '../models/execution';

export namespace TestCaseGrouper {
  export type CaseLike = {
    id: { executionId: string; seed: number };
  };

  /**
   * Seedごとにグルーピングされたデータ
   */
  export class SeedGroup<T extends CaseLike = CaseLike> {
    constructor(
      public seed: number,
      public executions: Array<{
        execution: Execution;
        testCase: T;
      }>,
    ) {}
  }

  /**
   * テストケースとExecutionをSeedごとにグルーピング（純粋関数）
   * @param testCases テストケース配列
   * @param executions 実行メタデータ配列
   */
  export function bySeed<T extends CaseLike>(
    testCases: T[],
    executions: Execution[],
  ): SeedGroup<T>[] {
    const seedMap = new Map<
      number,
      Array<{
        execution: Execution;
        testCase: T;
      }>
    >();

    // executionId -> Execution のマップを作成
    const executionMap = new Map(executions.map((e) => [e.id, e]));

    for (const testCase of testCases) {
      const execution = executionMap.get(testCase.id.executionId);
      if (!execution) {
        continue;
      }

      const executionList = seedMap.get(testCase.id.seed) || [];
      executionList.push({
        execution,
        testCase,
      });
      seedMap.set(testCase.id.seed, executionList);
    }

    const groups: SeedGroup<T>[] = [];
    for (const [seed, executionList] of seedMap.entries()) {
      groups.push(new SeedGroup(seed, executionList));
    }

    // Seed順にソート
    groups.sort((a, b) => a.seed - b.seed);

    return groups;
  }
}
