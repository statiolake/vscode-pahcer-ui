import * as vscode from 'vscode';
import type { GroupingMode } from '../domain/services/testCaseSorter';
import { PahcerStatus } from '../infrastructure/pahcerAdapter';

/**
 * VSCode Context API を型安全に扱うアダプター
 *
 * Context の設定・取得を集約し、以下のメリットを提供：
 * - 型安全性（誤った値の設定を防ぐ）
 * - 一元管理（どの Context が存在するか把握しやすい）
 * - 変更時の影響範囲を限定
 */
export class VSCodeUIContext {
  /**
   * pahcer のステータスを設定
   * package.json の when 句で使用: `pahcer.status == 'ready'`
   */
  async setPahcerStatus(status: PahcerStatus): Promise<void> {
    const statusString = this.pahcerStatusToString(status);
    await vscode.commands.executeCommand('setContext', 'pahcer.status', statusString);
  }

  /**
   * 初期化ビューの表示状態を設定
   * package.json の when 句で使用: `pahcer.showInitialization`
   */
  async setShowInitialization(show: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'pahcer.showInitialization', show);
  }

  /**
   * 実行オプションビューの表示状態を設定
   * package.json の when 句で使用: `pahcer.showRunOptions`
   */
  async setShowRunOptions(show: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'pahcer.showRunOptions', show);
  }

  /**
   * グルーピングモードを設定
   * package.json の when 句で使用: `pahcer.groupingMode == 'byExecution'`
   */
  async setGroupingMode(mode: GroupingMode): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'pahcer.groupingMode', mode);
  }

  /**
   * 差分表示コマンドの有効/無効を設定
   * package.json の when 句で使用: `pahcer.canShowDiff`
   */
  async setCanShowDiff(canShow: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'pahcer.canShowDiff', canShow);
  }

  /**
   * PahcerStatus を文字列に変換
   */
  private pahcerStatusToString(status: PahcerStatus): string {
    switch (status) {
      case PahcerStatus.NotInstalled:
        return 'notInstalled';
      case PahcerStatus.NotInitialized:
        return 'notInitialized';
      case PahcerStatus.Ready:
        return 'ready';
      default:
        return 'unknown';
    }
  }
}
