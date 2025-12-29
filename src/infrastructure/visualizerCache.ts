import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import type { IVisualizerCache } from '../domain/interfaces/IVisualizerCache';

/**
 * ビジュアライザのキャッシュ管理
 */
export class VisualizerCache implements IVisualizerCache {
  constructor(private visualizerDir: string) {
    // Ensure directory exists synchronously on construction
    // This is acceptable as it's called once during extension activation
    if (!existsSync(visualizerDir)) {
      mkdirSync(visualizerDir, { recursive: true });
    }
  }

  /**
   * キャッシュされたHTMLファイル名を取得
   */
  getCachedHtmlFileName(): string | null {
    if (!existsSync(this.visualizerDir)) {
      console.log(`[VisualizerCache] Cache directory does not exist: ${this.visualizerDir}`);
      return null;
    }

    const files = readdirSync(this.visualizerDir);
    console.log(`[VisualizerCache] Files in cache directory:`, files);

    const htmlFile = files.find((f) => f.endsWith('.html'));
    if (htmlFile) {
      console.log(`[VisualizerCache] Found cached HTML file: ${htmlFile}`);
    } else {
      console.log(`[VisualizerCache] No HTML file found in cache`);
    }
    return htmlFile || null;
  }

  /**
   * HTMLファイルのパスを取得
   */
  getHtmlPath(fileName: string): string {
    return path.join(this.visualizerDir, fileName);
  }

  /**
   * HTMLファイルが存在するかチェック
   */
  exists(fileName: string): boolean {
    return existsSync(this.getHtmlPath(fileName));
  }

  /**
   * HTMLファイルを読み込む
   */
  readHtml(fileName: string): string {
    return readFileSync(this.getHtmlPath(fileName), 'utf-8');
  }

  /**
   * リソースファイルのパスを取得
   */
  getResourcePath(fileName: string): string {
    return path.join(this.visualizerDir, fileName);
  }

  /**
   * リソースファイルが存在するかチェック
   */
  resourceExists(fileName: string): boolean {
    return existsSync(this.getResourcePath(fileName));
  }

  /**
   * ビジュアライザディレクトリのパスを取得
   */
  getVisualizerDir(): string {
    return this.visualizerDir;
  }
}
