import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { ComparisonConfig } from '@pahcer/core/application/dtos/comparisonConfig';
import type { IComparisonConfigRepository } from '@pahcer/core/application/repositories/IComparisonConfigRepository';
import { ensureDir } from '../util/fs';
import { asErrnoException } from '../util/lang';
import { ComparisonConfigSchema } from './schemas';

/**
 * 比較ビュー設定のリポジトリ。
 */
export class ComparisonConfigRepository implements IComparisonConfigRepository {
  private configDirPath: string;
  private configPath: string;

  constructor(workspaceRoot: string) {
    this.configDirPath = path.join(workspaceRoot, '.pahcer-ui');
    this.configPath = path.join(this.configDirPath, 'config.json');
  }

  async find(): Promise<ComparisonConfig> {
    try {
      const content = await fs.readFile(this.configPath, { encoding: 'utf-8' });
      const loaded = ComparisonConfigSchema.parse(JSON.parse(content));
      return new ComparisonConfig(
        loaded.featureString,
        loaded.xAxis,
        loaded.yAxis,
        loaded.chartType,
        loaded.filter,
      );
    } catch (error) {
      if (!(error instanceof Error) || asErrnoException(error).code !== 'ENOENT') {
        throw new Error(
          `設定の読み込みに失敗しました (${this.configPath}): ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return new ComparisonConfig();
    }
  }

  async upsert(config: ComparisonConfig): Promise<void> {
    await ensureDir(this.configDirPath);
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }
}
