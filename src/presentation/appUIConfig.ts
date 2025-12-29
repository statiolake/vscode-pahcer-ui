import { ConfigurationTarget, workspace } from 'vscode';
import type { SeedSortOrder } from '../domain/services/seedExecutionSorter';
import type { ExecutionSortOrder, GroupingMode } from '../domain/services/testCaseSorter';

const PREFERENCES_SECTION = 'pahcer-ui';

export class AppUIConfig {
  /**
   * Git 統合設定を取得
   * @returns true: 有効, false: 無効, null: 未設定
   */
  public async gitIntegration(): Promise<boolean | null> {
    return this.config().get<boolean | null>('gitIntegration', null);
  }

  /**
   * Git 統合設定を設定（ワークスペースレベル）
   */
  public async setGitIntegration(enabled: boolean): Promise<void> {
    await this.config().update('gitIntegration', enabled, ConfigurationTarget.Workspace);
  }

  public async groupingMode(): Promise<GroupingMode> {
    return this.config().get<GroupingMode>('groupingMode', 'byExecution');
  }

  public async setGroupingMode(mode: GroupingMode): Promise<void> {
    await this.config().update('groupingMode', mode, ConfigurationTarget.Global);
  }

  public async executionSortOrder(): Promise<ExecutionSortOrder> {
    return this.config().get<ExecutionSortOrder>('executionSortOrder', 'seedAsc');
  }

  public async setExecutionSortOrder(order: ExecutionSortOrder): Promise<void> {
    await this.config().update('executionSortOrder', order, ConfigurationTarget.Global);
  }

  public async seedSortOrder(): Promise<SeedSortOrder> {
    return this.config().get<SeedSortOrder>('seedSortOrder', 'executionAsc');
  }

  public async setSeedSortOrder(order: SeedSortOrder): Promise<void> {
    await this.config().update('seedSortOrder', order, ConfigurationTarget.Global);
  }

  private config() {
    return workspace.getConfiguration(PREFERENCES_SECTION);
  }
}
