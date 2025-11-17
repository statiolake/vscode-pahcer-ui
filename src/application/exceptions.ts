/**
 * アプリケーション層の例外
 *
 * ユースケース実行中に発生する例外。ビジネスロジックやワークフロー上の障害を表現します。
 * プレゼンテーション層でユーザーに表示するメッセージに変換されます。
 *
 * 命名規約：UI メッセージは日本語、例外クラス名は英語
 */

/**
 * アプリケーション層の例外の基底クラス
 */
export abstract class ApplicationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * 必要なリソースが見つからない場合にスロー
 */
export class ResourceNotFoundError extends ApplicationException {
  constructor(resourceType: string, resourceId?: string) {
    const message = resourceId
      ? `${resourceType} '${resourceId}' が見つかりませんでした`
      : `${resourceType} が見つかりませんでした`;
    super(message);
  }
}

/**
 * ワークフローの前提条件が満たされていない場合にスロー
 */
export class PreconditionFailedError extends ApplicationException {}

/**
 * ユースケース実行エラーの基底クラス
 *
 * 例外型ごとに異なるハンドリングが必要な場合のみサブクラスを作成してください。
 * メッセージをラッピングするだけで意味論的な違いがない場合は避けてください。
 */
export class UseCaseExecutionError extends ApplicationException {
  constructor(cause: string) {
    super(`ユースケース実行に失敗しました: ${cause}`);
  }
}
