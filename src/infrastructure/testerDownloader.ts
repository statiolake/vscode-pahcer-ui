import { exec } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, unlink } from 'node:fs/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { DownloadedTester, ITesterDownloader } from '../domain/interfaces/ITesterDownloader';

// Re-export for backward compatibility
export type { DownloadedTester };

const execAsync = promisify(exec);

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * ローカルテスターのダウンロードと展開を行うアダプター
 */
export class TesterDownloader implements ITesterDownloader {
  constructor(private workspaceRoot: string) {}

  /**
   * ZIPファイルをダウンロードして展開
   */
  async downloadAndExtract(url: string): Promise<DownloadedTester> {
    const zipPath = path.join(this.workspaceRoot, 'tester.zip');

    try {
      // Download ZIP file
      await this.downloadFile(url, zipPath);

      // Extract ZIP file to workspace root
      await this.extractZip(zipPath, this.workspaceRoot);

      return {
        seemsInteractive: await this.estimateIsInteractive(),
      };
    } finally {
      // エラーでもそうじゃなくても zip ファイルは削除する
      if (await fileExists(zipPath)) {
        await unlink(zipPath);
      }
    }
  }

  /**
   * ファイルをダウンロード
   */
  private async downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      protocol
        .get(url, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              this.downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
              return;
            }
          }

          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
            return;
          }

          const fileStream = createWriteStream(destPath);
          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve();
          });

          fileStream.on('error', (err) => {
            unlink(destPath).catch(() => {});
            reject(err);
          });
        })
        .on('error', (err) => {
          reject(err);
        });
    });
  }

  /**
   * ZIPファイルを展開
   */
  private async extractZip(zipPath: string, destPath: string): Promise<void> {
    // Use unzip command on macOS/Linux, or expand-archive on Windows
    const platform = process.platform;

    if (platform === 'win32') {
      // Windows: Use PowerShell Expand-Archive
      const command = `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destPath}' -Force"`;
      await execAsync(command);
    } else {
      // macOS/Linux: Use unzip
      const command = `unzip -o "${zipPath}" -d "${destPath}"`;
      await execAsync(command);
    }
  }

  /**
   * インタラクティブなダウンローダーかどうかを推測する
   */
  private async estimateIsInteractive(): Promise<boolean> {
    // tester がある場合おそらくインタラクティブ
    return await fileExists(path.join(this.workspaceRoot, 'tools', 'src', 'bin', 'tester.rs'));
  }
}
