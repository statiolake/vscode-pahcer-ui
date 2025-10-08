import { exec } from 'node:child_process';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * ローカルテスターのダウンロードと展開を行うアダプター
 */
export class TesterDownloader {
	constructor(private workspaceRoot: string) {}

	/**
	 * ZIPファイルをダウンロードして展開
	 */
	async downloadAndExtract(url: string): Promise<void> {
		const zipPath = path.join(this.workspaceRoot, 'tester.zip');

		try {
			// Download ZIP file
			await this.downloadFile(url, zipPath);

			// Extract ZIP file to workspace root
			await this.extractZip(zipPath, this.workspaceRoot);

			// Remove ZIP file
			fs.unlinkSync(zipPath);
		} catch (error) {
			// Clean up on error
			if (fs.existsSync(zipPath)) {
				fs.unlinkSync(zipPath);
			}
			throw error;
		}
	}

	/**
	 * ファイルをダウンロード
	 */
	private downloadFile(url: string, destPath: string): Promise<void> {
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

					const fileStream = fs.createWriteStream(destPath);
					response.pipe(fileStream);

					fileStream.on('finish', () => {
						fileStream.close();
						resolve();
					});

					fileStream.on('error', (err) => {
						fs.unlinkSync(destPath);
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
}
