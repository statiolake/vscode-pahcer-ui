import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { IPahcerConfigRepository } from '../domain/interfaces/IPahcerConfigRepository';
import { type ConfigId, PahcerConfig } from '../domain/models/configFile';
import { ensureDirForFile } from '../util/fs';
import { asErrnoException } from '../util/lang';

/**
 * pahcer 設定ファイル（pahcer_config.toml）リポジトリ
 *
 * 責務:
 * - TOML ファイルの読み込み/書き込み
 * - TOML コンテンツから start_seed, end_seed, objective をパース
 * - PahcerConfig ドメインモデルへの変換
 */
export class PahcerConfigRepository implements IPahcerConfigRepository {
  constructor(private workspaceRoot: string) {}

  /**
   * 指定されたファイルを読み込み、PahcerConfig に変換
   * temporary の場合、通常ファイルから一時ファイルを作成してコピー
   *
   * ファイルが見つからない場合（ENOENT）は undefined を返す
   * その他の例外は投げ直す
   */
  async findById(id: ConfigId): Promise<PahcerConfig | undefined> {
    const normalPath = this.getNormalPath();
    const configPath = this.getPath(id);

    try {
      // temporary の場合、通常ファイルから一時ファイルを作成
      if (id === 'temporary') {
        await ensureDirForFile(configPath);
        const normalContent = await fs.readFile(normalPath, 'utf-8');
        await fs.writeFile(configPath, normalContent, 'utf-8');
      }

      const content = await fs.readFile(configPath, 'utf-8');

      // TOML コンテンツから start_seed/end_seed/objective をパース
      const problemName = this.extractProblemName(content);
      const startSeed = this.extractStartSeed(content);
      const endSeed = this.extractEndSeed(content);
      const objective = this.extractObjective(content);

      if (
        problemName === undefined ||
        startSeed === undefined ||
        endSeed === undefined ||
        objective === undefined
      ) {
        throw new Error(`Invalid pahcer config file: missing required fields in ${configPath}`);
      }

      return new PahcerConfig(id, configPath, problemName, startSeed, endSeed, objective);
    } catch (error) {
      // ファイルが見つからない場合のみ undefined を返す
      if (!(error instanceof Error) || asErrnoException(error).code !== 'ENOENT') {
        throw error;
      }
      return undefined;
    }
  }

  /**
   * PahcerConfig をファイルに保存
   * config.path に指定されているパスに保存
   */
  async upsert(config: PahcerConfig): Promise<void> {
    const currentContent = await fs.readFile(config.path, 'utf-8');

    // 現在のコンテンツに start_seed/end_seed を反映させる
    let newContent = currentContent;
    newContent = this.replaceStartSeed(newContent, config.startSeed);
    newContent = this.replaceEndSeed(newContent, config.endSeed);

    // 必要なディレクトリを作成
    await ensureDirForFile(config.path);

    await fs.writeFile(config.path, newContent, 'utf-8');
  }

  /**
   * 指定された id のファイルを削除
   * normal ファイルは保護されており削除されない
   * ファイルが見つからない場合（ENOENT）は無視される
   * その他の例外は投げ直される
   */
  async delete(id: ConfigId): Promise<void> {
    if (id === 'normal') {
      // normal ファイルは削除しない
      return;
    }

    const configPath = this.getPath(id);
    try {
      await fs.unlink(configPath);
    } catch (error) {
      // ファイルが見つからない場合のみ無視
      if (!(error instanceof Error) || asErrnoException(error).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private extractProblemName(content: string): string | undefined {
    const match = content.match(/^problem_name\s*=\s*['"](.+)['"]/m);
    return match ? match[1] : undefined;
  }

  /**
   * TOML コンテンツから start_seed の値をパース
   */
  private extractStartSeed(content: string): number | undefined {
    const match = content.match(/^start_seed\s*=\s*(\d+)/m);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * TOML コンテンツから end_seed の値をパース
   */
  private extractEndSeed(content: string): number | undefined {
    const match = content.match(/^end_seed\s*=\s*(\d+)/m);
    return match ? parseInt(match[1], 10) : undefined;
  }

  /**
   * TOML コンテンツから objective の値をパース
   */
  private extractObjective(content: string): 'max' | 'min' | undefined {
    const match = content.match(/objective\s*=\s*['"](max|min)['"]/i);

    if (match && (match[1].toLowerCase() === 'max' || match[1].toLowerCase() === 'min')) {
      return match[1].toLowerCase() as 'max' | 'min';
    }

    // objective が見つからない場合はデフォルト値を返す
    return undefined;
  }

  /**
   * TOML コンテンツの start_seed を置換
   * start_seed は必ず存在する前提
   */
  private replaceStartSeed(content: string, value: number): string {
    const regex = /^(start_seed\s*=\s*)\d+/m;
    return content.replace(regex, `$1${value}`);
  }

  /**
   * TOML コンテンツの end_seed を置換
   * end_seed は必ず存在する前提
   */
  private replaceEndSeed(content: string, value: number): string {
    const regex = /^(end_seed\s*=\s*)\d+/m;
    return content.replace(regex, `$1${value}`);
  }

  /**
   * normal ファイルのパスを取得
   */
  private getNormalPath(): string {
    return path.join(this.workspaceRoot, 'pahcer_config.toml');
  }

  /**
   * 指定された id のファイルパスを取得
   */
  private getPath(id: ConfigId): string {
    switch (id) {
      case 'normal':
        return this.getNormalPath();
      case 'temporary':
        return path.join(this.workspaceRoot, '.pahcer-ui', 'temp_pahcer_config.toml');
    }
  }
}
