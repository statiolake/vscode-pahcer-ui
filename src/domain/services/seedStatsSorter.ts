export namespace SeedStatsSorter {
  /**
   * Seed フィールドを持つオブジェクトの型
   */
  interface HasSeed {
    seed: number;
  }

  /**
   * Seed 統計を Seed 番号の昇順でソート
   *
   * @param statsMap seed => stats のマップ（stats は seed フィールドを持つ必要がある）
   * @returns ソート済み stats 配列（元のマップは変更しない）
   */
  export function bySeedAscending<T extends HasSeed>(statsMap: Map<number, T>): T[] {
    return Array.from(statsMap.values()).sort((a, b) => a.seed - b.seed);
  }

  /**
   * Seed 統計を Seed 番号の降順でソート
   *
   * @param statsMap seed => stats のマップ（stats は seed フィールドを持つ必要がある）
   * @returns ソート済み stats 配列（元のマップは変更しない）
   */
  export function bySeedDescending<T extends HasSeed>(statsMap: Map<number, T>): T[] {
    return Array.from(statsMap.values()).sort((a, b) => b.seed - a.seed);
  }
}
