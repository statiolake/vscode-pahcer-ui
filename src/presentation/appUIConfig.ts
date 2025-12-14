import { ConfigurationTarget, workspace } from 'vscode';
import type { SeedSortOrder } from '../domain/services/seedExecutionSorter';
import type { ExecutionSortOrder, GroupingMode } from '../domain/services/testCaseSorter';

const PREFERENCES_SECTION = 'pahcer-ui';

export class AppUIConfig {
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
