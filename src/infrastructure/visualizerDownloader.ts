import { existsSync, promises as fs } from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';
import type { IVisualizerDownloader } from '../domain/interfaces/IVisualizerDownloader';

/**
 * ビジュアライザのダウンロード処理
 */
export class VisualizerDownloader implements IVisualizerDownloader {
  private readonly MAX_DEPTH = 3;

  constructor(private visualizerDir: string) {}

  /**
   * ビジュアライザをダウンロード
   */
  async download(url: string): Promise<string> {
    // Ensure visualizer directory exists
    await fs.mkdir(this.visualizerDir, { recursive: true });
    console.log(`[VisualizerDownloader] Created directory: ${this.visualizerDir}`);

    // Remove query parameters for file operations
    const urlObj = new URL(url);
    const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;

    console.log(`[VisualizerDownloader] Starting download from: ${cleanUrl}`);

    // Download main HTML with recursion
    const htmlFileName = path.basename(urlObj.pathname);
    await this.downloadResourceRecursive(cleanUrl, 0);

    console.log(`[VisualizerDownloader] Download completed`);
    return htmlFileName;
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
        `[VisualizerDownloader] Max recursion depth (${this.MAX_DEPTH}) reached, stopping recursion`,
      );
      return;
    }

    const baseUrlObj = new URL(url);
    const baseDir = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/'));
    const fileName = path.basename(url);
    const filePath = path.join(this.visualizerDir, fileName);

    // すでにダウンロード済みならスキップ
    if (existsSync(filePath)) {
      console.log(`[VisualizerDownloader] File already exists, skipping: ${fileName}`);
      return;
    }

    // ファイルをダウンロード
    console.log(`[VisualizerDownloader] Downloading: ${url} (depth: ${depth})`);
    const content = await this.fetchUrl(url);
    await fs.writeFile(filePath, content);
    console.log(`[VisualizerDownloader] Saved: ${fileName} (size: ${content.length} bytes)`);

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
      console.log(`[VisualizerDownloader] No dependencies found in HTML`);
      return;
    }

    console.log(
      `[VisualizerDownloader] Found ${dependencies.size} dependencies in HTML:`,
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
          `[VisualizerDownloader] Failed to download dependency ${dep}:`,
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
      console.log(`[VisualizerDownloader] No imports found in JS file`);
      return;
    }

    console.log(
      `[VisualizerDownloader] Found ${dependencies.size} imports in JS file:`,
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
          `[VisualizerDownloader] Failed to download import ${dep}:`,
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
    console.log(`[VisualizerDownloader] Checking for WASM file: ${wasmFileName}`);

    try {
      const wasmPath = path.join(this.visualizerDir, wasmFileName);
      const wasmContent = await this.fetchUrlBinary(wasmUrl);
      await fs.writeFile(wasmPath, wasmContent);
      console.log(
        `[VisualizerDownloader] WASM file downloaded: ${wasmFileName} (size: ${wasmContent.length} bytes)`,
      );
    } catch (e) {
      console.warn(
        `[VisualizerDownloader] WASM file not found: ${wasmFileName}`,
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
      console.log(`[VisualizerDownloader] Skipping external URL: ${dep}`);
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
          console.log(`[VisualizerDownloader] HTTP response for ${url}: ${res.statusCode}`);

          if (res.statusCode === 301 || res.statusCode === 302) {
            if (res.headers.location) {
              console.log(`[VisualizerDownloader] Redirecting to: ${res.headers.location}`);
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
            `[VisualizerDownloader] Network error for ${url}:`,
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
          console.log(`[VisualizerDownloader] HTTP response for ${url}: ${res.statusCode}`);

          if (res.statusCode === 301 || res.statusCode === 302) {
            if (res.headers.location) {
              console.log(`[VisualizerDownloader] Redirecting to: ${res.headers.location}`);
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
            `[VisualizerDownloader] Network error for ${url}:`,
            e instanceof Error ? e.message : String(e),
          );
          reject(e);
        });
    });
  }
}
