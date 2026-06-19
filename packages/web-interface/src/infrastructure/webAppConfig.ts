import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { IGitIntegrationConfig } from '@pahcer/core/application/commitResultsUseCase';
import type {
  ExecutionSortOrder,
  GroupingMode,
  SeedSortOrder,
} from '@pahcer/core/application/dtos/pahcerUIState';

export interface WebPreferences {
  gitIntegration: boolean | null;
  groupingMode: GroupingMode;
  executionSortOrder: ExecutionSortOrder;
  seedSortOrder: SeedSortOrder;
  visualizerZoomLevel: number;
}

const DEFAULT_PREFERENCES: WebPreferences = {
  gitIntegration: null,
  groupingMode: 'byExecution',
  executionSortOrder: 'seedAsc',
  seedSortOrder: 'executionAsc',
  visualizerZoomLevel: 1,
};

export class WebAppConfig implements IGitIntegrationConfig {
  private readonly configPath: string;

  constructor(workspaceRoot: string) {
    this.configPath = path.join(workspaceRoot, '.pahcer-ui', 'web-config.json');
  }

  async gitIntegration(): Promise<boolean | null> {
    return (await this.read()).gitIntegration;
  }

  async setGitIntegration(enabled: boolean): Promise<void> {
    await this.update({ gitIntegration: enabled });
  }

  async preferences(): Promise<WebPreferences> {
    return this.read();
  }

  async updatePreferences(preferences: Partial<WebPreferences>): Promise<WebPreferences> {
    return this.update(preferences);
  }

  private async update(preferences: Partial<WebPreferences>): Promise<WebPreferences> {
    const next = this.normalize({ ...(await this.read()), ...preferences });
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(next, null, 2), 'utf-8');
    return next;
  }

  private async read(): Promise<WebPreferences> {
    try {
      return this.normalize(JSON.parse(await fs.readFile(this.configPath, 'utf-8')));
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  private normalize(value: unknown): WebPreferences {
    const input = value && typeof value === 'object' ? (value as Partial<WebPreferences>) : {};
    return {
      gitIntegration:
        typeof input.gitIntegration === 'boolean' || input.gitIntegration === null
          ? input.gitIntegration
          : DEFAULT_PREFERENCES.gitIntegration,
      groupingMode: input.groupingMode === 'bySeed' ? 'bySeed' : 'byExecution',
      executionSortOrder: isExecutionSortOrder(input.executionSortOrder)
        ? input.executionSortOrder
        : DEFAULT_PREFERENCES.executionSortOrder,
      seedSortOrder: isSeedSortOrder(input.seedSortOrder)
        ? input.seedSortOrder
        : DEFAULT_PREFERENCES.seedSortOrder,
      visualizerZoomLevel:
        typeof input.visualizerZoomLevel === 'number' && Number.isFinite(input.visualizerZoomLevel)
          ? Math.min(3, Math.max(0.5, input.visualizerZoomLevel))
          : DEFAULT_PREFERENCES.visualizerZoomLevel,
    };
  }
}

function isExecutionSortOrder(value: unknown): value is ExecutionSortOrder {
  return (
    value === 'seedAsc' ||
    value === 'seedDesc' ||
    value === 'relativeScoreAsc' ||
    value === 'relativeScoreDesc' ||
    value === 'absoluteScoreAsc' ||
    value === 'absoluteScoreDesc'
  );
}

function isSeedSortOrder(value: unknown): value is SeedSortOrder {
  return (
    value === 'executionAsc' ||
    value === 'executionDesc' ||
    value === 'absoluteScoreAsc' ||
    value === 'absoluteScoreDesc'
  );
}
