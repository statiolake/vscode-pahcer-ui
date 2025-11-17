import type { TestCaseId } from '../models/testCase';

/**
 * ファイル型
 */
export type FileType = 'in' | 'out' | 'err';

/**
 * 入力・出力・エラーファイルの処理を統合管理するアダプターインターフェース
 *
 * pahcer の出力ファイルと過去の実行結果をアーカイブ管理
 */
export interface IInOutFilesAdapter {
  /**
   * pahcer から出力されたファイルパスを取得（tools/in, tools/out, tools/err）
   * @param type ファイルタイプ
   * @param seed シード値
   */
  getNonArchivedPath(type: FileType, seed: number): string;

  /**
   * 過去の実行結果のファイルパスを取得
   * @param type ファイルタイプ（in 除く）
   * @param id テストケース ID
   */
  getArchivedPath(type: Exclude<FileType, 'in'>, id: TestCaseId): string;

  /**
   * アーカイブされたファイル（out, err）を読み込む
   * @param type ファイルタイプ
   * @param id テストケース ID
   * @returns ファイル内容（見つからない場合は空文字列）
   */
  loadArchived(type: Exclude<FileType, 'in'>, id: TestCaseId): Promise<string>;

  /**
   * 入力ファイルを読み込む
   * @param seed シード値
   * @returns ファイル内容（見つからない場合は空文字列）
   */
  loadIn(seed: number): Promise<string>;

  /**
   * tools/out と tools/err ディレクトリを削除
   */
  removeOutputs(): Promise<void>;

  /**
   * 出力ファイル（out, err）をアーカイブ
   * @param executionId 実行 ID
   */
  archiveOutputs(executionId: string): Promise<void>;
}
