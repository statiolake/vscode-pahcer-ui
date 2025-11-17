import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { IUIConfigRepository } from '../domain/interfaces/IUIConfigRepository';
import { UIConfig } from '../domain/models/uiConfig';
import { asErrnoException } from '../util/lang';
import { UIConfigSchema } from './schemas';

/**
 * 比較設定のリポジトリ
 */
export class UIConfigRepository implements IUIConfigRepository {
  private configDirPath: string;
  private configPath: string;

  constructor(workspaceRoot: string) {
    this.configDirPath = path.join(workspaceRoot, '.pahcer-ui');
    this.configPath = path.join(this.configDirPath, 'config.json');
  }

  /**
   * 設定を読み込む
   * ファイルが見つからない場合はデフォルト設定を返す
   * その他のエラーは投げ直す
   */
  async find(): Promise<UIConfig> {
    try {
      const content = await fs.readFile(this.configPath, { encoding: 'utf-8' });
      const loaded = UIConfigSchema.parse(JSON.parse(content));
      return new UIConfig(
        loaded.featureString,
        loaded.xAxis,
        loaded.yAxis,
        loaded.chartType,
        loaded.filter,
      );
    } catch (error) {
      // ファイルが見つからない場合のみデフォルト設定を返す
      if (!(error instanceof Error) || asErrnoException(error).code !== 'ENOENT') {
        throw error;
      }
      return new UIConfig();
    }
  }

  /**
   * 設定を保存する
   */
  async upsert(config: UIConfig): Promise<void> {
    await fs.mkdir(this.configDirPath, { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }
}
