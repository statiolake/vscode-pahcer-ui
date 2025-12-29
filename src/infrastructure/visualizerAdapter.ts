import * as fs from 'node:fs/promises';
import * as https from 'node:https';
import * as path from 'node:path';
import type { IVisualizerAdapter } from '../domain/interfaces/IVisualizerAdapter';
import { ensureDir, exists } from '../util/fs';

/**
 * ビジュアライザのキャッシュ管理とダウンロードを行うアダプター
 *
 * 責務:
 * - ビジュアライザファイルのダウンロード（HTML、JS、CSS、WASM などの依存ファイル含む）
 * - キャッシュされたファイルの読み込み・存在確認
 * - リソースパスの管理
 */
export class VisualizerAdapter implements IVisualizerAdapter {
  private readonly MAX_DEPTH = 3;
  private readonly visualizerDir: string;

  constructor(workspaceRoot: string) {
    this.visualizerDir = path.join(workspaceRoot, '.pahcer-ui', 'visualizer');
  }

  /**
   * キャッシュされたHTMLファイル名を取得
   */
  async getCachedHtmlFileName(): Promise<string | null> {
    if (!(await exists(this.visualizerDir))) {
      console.log(`[VisualizerAdapter] Cache directory does not exist: ${this.visualizerDir}`);
      return null;
    }

    const files = await fs.readdir(this.visualizerDir);
    console.log(`[VisualizerAdapter] Files in cache directory:`, files);

    const htmlFile = files.find((f) => f.endsWith('.html'));
    if (htmlFile) {
      console.log(`[VisualizerAdapter] Found cached HTML file: ${htmlFile}`);
    } else {
      console.log(`[VisualizerAdapter] No HTML file found in cache`);
    }
    return htmlFile || null;
  }

  /**
   * ビジュアライザをダウンロード
   */
  async download(url: string): Promise<string> {
    // Ensure visualizer directory exists
    await ensureDir(this.visualizerDir);
    console.log(`[VisualizerAdapter] Created directory: ${this.visualizerDir}`);

    // Remove query parameters for file operations
    const urlObj = new URL(url);
    const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;

    console.log(`[VisualizerAdapter] Starting download from: ${cleanUrl}`);

    // Download main HTML with recursion
    const htmlFileName = path.basename(urlObj.pathname);
    await this.downloadResourceRecursive(cleanUrl, 0);

    console.log(`[VisualizerAdapter] Download completed`);
    return htmlFileName;
  }

  /**
   * HTMLファイルのパスを取得
   */
  getHtmlPath(fileName: string): string {
    return path.join(this.visualizerDir, fileName);
  }

  /**
   * HTMLファイルを読み込む
   */
  async readHtml(fileName: string): Promise<string> {
    return fs.readFile(this.getHtmlPath(fileName), 'utf-8');
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
  async resourceExists(fileName: string): Promise<boolean> {
    return exists(this.getResourcePath(fileName));
  }

  /**
   * ビジュアライザディレクトリのパスを取得
   */
  getVisualizerDir(): string {
    return this.visualizerDir;
  }

  /**
   * リソース（HTML/JS）を再帰的にダウンロード
   * @param url ダウンロードするリソースのURL
   * @param depth 再帰の深さ（循環参照防止）
   */
  private async downloadResourceRecursive(url: string, depth: number): Promise<void> {
    // 深さチェック
    if (depth > this.MAX_DEPTH) {
      console.log(
        `[VisualizerAdapter] Max recursion depth (${this.MAX_DEPTH}) reached, stopping recursion`,
      );
      return;
    }

    const baseUrlObj = new URL(url);
    const baseDir = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/'));
    const fileName = path.basename(url);
    const filePath = path.join(this.visualizerDir, fileName);

    // すでにダウンロード済みならスキップ
    if (await exists(filePath)) {
      console.log(`[VisualizerAdapter] File already exists, skipping: ${fileName}`);
      return;
    }

    // ファイルをダウンロード
    console.log(`[VisualizerAdapter] Downloading: ${url} (depth: ${depth})`);
    const content = await this.fetchUrl(url);
    await fs.writeFile(filePath, content);
    console.log(`[VisualizerAdapter] Saved: ${fileName} (size: ${content.length} bytes)`);

    if (fileName.endsWith('.html')) {
      // HTMLファイルの場合：依存ファイルを抽出して再帰ダウンロード
      await this.downloadDependenciesFromHtml(content, baseUrlObj, baseDir, depth);
    } else if (fileName.endsWith('.js')) {
      // JavaScriptファイルの場合：import文を抽出して再帰ダウンロード
      await this.downloadDependenciesFromJs(content, baseUrlObj, baseDir, depth);

      // JSファイルに対応するWASMファイルを試行的にダウンロード
      await this.maybeDownloadWasmFromJs(fileName, baseUrlObj, baseDir);
    }
  }

  /**
   * HTMLファイルから依存ファイルを抽出して再帰ダウンロード
   */
  private async downloadDependenciesFromHtml(
    htmlContent: string,
    baseUrlObj: URL,
    baseDir: string,
    depth: number,
  ): Promise<void> {
    const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
    const linkRegex = /<link[^>]+href=["']([^"']+)["']/g;
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
    const importRegex = /from\s+["']([^"']+\.js)["']/g;

    const dependencies = new Set<string>();

    let match: RegExpExecArray | null;
    match = scriptRegex.exec(htmlContent);
    while (match !== null) {
      dependencies.add(match[1]);
      match = scriptRegex.exec(htmlContent);
    }
    match = linkRegex.exec(htmlContent);
    while (match !== null) {
      dependencies.add(match[1]);
      match = linkRegex.exec(htmlContent);
    }
    match = imgRegex.exec(htmlContent);
    while (match !== null) {
      dependencies.add(match[1]);
      match = imgRegex.exec(htmlContent);
    }
    match = importRegex.exec(htmlContent);
    while (match !== null) {
      dependencies.add(match[1]);
      match = importRegex.exec(htmlContent);
    }

    if (dependencies.size === 0) {
      console.log(`[VisualizerAdapter] No dependencies found in HTML`);
      return;
    }

    console.log(
      `[VisualizerAdapter] Found ${dependencies.size} dependencies in HTML:`,
      Array.from(dependencies),
    );

    // 各依存ファイルをダウンロード
    for (const dep of dependencies) {
      try {
        const depUrl = this.resolveUrl(dep, baseUrlObj, baseDir);
        if (depUrl) {
          await this.downloadResourceRecursive(depUrl, depth + 1);
        }
      } catch (e) {
        console.error(
          `[VisualizerAdapter] Failed to download dependency ${dep}:`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }

  /**
   * JavaScriptファイルから import 文を抽出して再帰ダウンロード
   */
  private async downloadDependenciesFromJs(
    jsContent: string,
    baseUrlObj: URL,
    baseDir: string,
    depth: number,
  ): Promise<void> {
    const importRegex = /from\s+["']([^"']+\.js)["']/g;

    const dependencies = new Set<string>();

    let match: RegExpExecArray | null;
    match = importRegex.exec(jsContent);
    while (match !== null) {
      dependencies.add(match[1]);
      match = importRegex.exec(jsContent);
    }

    if (dependencies.size === 0) {
      console.log(`[VisualizerAdapter] No imports found in JS file`);
      return;
    }

    console.log(
      `[VisualizerAdapter] Found ${dependencies.size} imports in JS file:`,
      Array.from(dependencies),
    );

    // 各インポートファイルをダウンロード
    for (const dep of dependencies) {
      try {
        const depUrl = this.resolveUrl(dep, baseUrlObj, baseDir);
        if (depUrl) {
          await this.downloadResourceRecursive(depUrl, depth + 1);
        }
      } catch (e) {
        console.error(
          `[VisualizerAdapter] Failed to download import ${dep}:`,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  }

  private async maybeDownloadWasmFromJs(
    fileName: string,
    baseUrlObj: URL,
    baseDir: string,
  ): Promise<void> {
    const wasmFileName = fileName.replace('.js', '_bg.wasm');
    const wasmUrl = `${baseUrlObj.origin}${baseDir}/${wasmFileName}`;
    console.log(`[VisualizerAdapter] Checking for WASM file: ${wasmFileName}`);

    try {
      const wasmPath = path.join(this.visualizerDir, wasmFileName);
      const wasmContent = await this.fetchUrlBinary(wasmUrl);
      await fs.writeFile(wasmPath, wasmContent);
      console.log(
        `[VisualizerAdapter] WASM file downloaded: ${wasmFileName} (size: ${wasmContent.length} bytes)`,
      );
    } catch (e) {
      console.warn(
        `[VisualizerAdapter] WASM file not found: ${wasmFileName}`,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  /**
   * 相対パスまたはプロトコル相対URLを完全なURLに変換
   */
  private resolveUrl(dep: string, baseUrlObj: URL, baseDir: string): string | null {
    // プロトコル相対URLの場合（//img.atcoder.jp/...）
    if (dep.startsWith('//img.atcoder.jp/')) {
      return `https:${dep}`;
    }

    // 外部URLはスキップ
    if (dep.startsWith('//') || dep.startsWith('http://') || dep.startsWith('https://')) {
      console.log(`[VisualizerAdapter] Skipping external URL: ${dep}`);
      return null;
    }

    // 相対パスを解決
    return dep.startsWith('./')
      ? `${baseUrlObj.origin}${baseDir}/${dep.substring(2)}`
      : `${baseUrlObj.origin}${baseDir}/${dep}`;
  }

  /**
   * URLからテキストを取得
   */
  private fetchUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          console.log(`[VisualizerAdapter] HTTP response for ${url}: ${res.statusCode}`);

          if (res.statusCode === 301 || res.statusCode === 302) {
            if (res.headers.location) {
              console.log(`[VisualizerAdapter] Redirecting to: ${res.headers.location}`);
              return this.fetchUrl(res.headers.location).then(resolve).catch(reject);
            }
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Unknown error'}`),
            );
          }

          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => resolve(data));
        })
        .on('error', (e) => {
          console.error(
            `[VisualizerAdapter] Network error for ${url}:`,
            e instanceof Error ? e.message : String(e),
          );
          reject(e);
        });
    });
  }

  /**
   * URLからバイナリを取得
   */
  private fetchUrlBinary(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https
        .get(url, (res) => {
          console.log(`[VisualizerAdapter] HTTP response for ${url}: ${res.statusCode}`);

          if (res.statusCode === 301 || res.statusCode === 302) {
            if (res.headers.location) {
              console.log(`[VisualizerAdapter] Redirecting to: ${res.headers.location}`);
              return this.fetchUrlBinary(res.headers.location).then(resolve).catch(reject);
            }
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(`HTTP ${res.statusCode}: ${res.statusMessage || 'Unknown error'}`),
            );
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(Buffer.concat(chunks)));
        })
        .on('error', (e) => {
          console.error(
            `[VisualizerAdapter] Network error for ${url}:`,
            e instanceof Error ? e.message : String(e),
          );
          reject(e);
        });
    });
  }
}
