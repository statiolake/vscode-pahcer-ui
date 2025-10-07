import * as fs from 'node:fs';
import * as https from 'node:https';
import * as path from 'node:path';

/**
 * ビジュアライザのダウンロード処理
 */
export class VisualizerDownloader {
	constructor(private visualizerDir: string) {
		if (!fs.existsSync(visualizerDir)) {
			fs.mkdirSync(visualizerDir, { recursive: true });
		}
	}

	/**
	 * ビジュアライザをダウンロード
	 */
	async download(url: string): Promise<string> {
		// Remove query parameters for file operations
		const urlObj = new URL(url);
		const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;

		// Download main HTML
		const htmlContent = await this.fetchUrl(cleanUrl);
		const htmlFileName = path.basename(urlObj.pathname);
		const htmlPath = path.join(this.visualizerDir, htmlFileName);
		fs.writeFileSync(htmlPath, htmlContent);

		// Parse and download dependencies
		await this.downloadDependencies(htmlContent, cleanUrl);

		return htmlFileName;
	}

	/**
	 * 依存ファイルをダウンロード
	 */
	private async downloadDependencies(htmlContent: string, baseUrl: string): Promise<void> {
		const baseUrlObj = new URL(baseUrl);
		const baseDir = baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf('/'));

		// Find script and link tags
		const scriptRegex = /<script[^>]+src=["']([^"']+)["']/g;
		const linkRegex = /<link[^>]+href=["']([^"']+)["']/g;
		const imgRegex = /<img[^>]+src=["']([^"']+)["']/g;
		// Also look for ES module imports
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

		// Download each dependency
		for (const dep of dependencies) {
			try {
				// Skip protocol-relative and absolute external URLs
				if (dep.startsWith('//') || dep.startsWith('http://') || dep.startsWith('https://')) {
					// Handle protocol-relative URLs (//img.atcoder.jp/...)
					if (dep.startsWith('//img.atcoder.jp/')) {
						const fullUrl = `https:${dep}`;
						const fileName = path.basename(new URL(fullUrl).pathname);
						const depPath = path.join(this.visualizerDir, fileName);

						if (!fs.existsSync(depPath)) {
							console.log(`Downloading ${fullUrl}`);
							const depContent = await this.fetchUrl(fullUrl);
							fs.writeFileSync(depPath, depContent);
						}
					}
					continue;
				}

				// Handle relative paths
				const depUrl = dep.startsWith('./')
					? `${baseUrlObj.origin}${baseDir}/${dep.substring(2)}`
					: `${baseUrlObj.origin}${baseDir}/${dep}`;

				console.log(`Downloading ${depUrl}`);
				const depContent = await this.fetchUrl(depUrl);

				const depPath = path.join(this.visualizerDir, path.basename(dep));
				fs.writeFileSync(depPath, depContent);

				// If it's a .js file, also try to download the .wasm file
				if (dep.endsWith('.js')) {
					const wasmFile = dep.replace('.js', '_bg.wasm');
					const wasmUrl = wasmFile.startsWith('./')
						? `${baseUrlObj.origin}${baseDir}/${wasmFile.substring(2)}`
						: `${baseUrlObj.origin}${baseDir}/${wasmFile}`;

					try {
						console.log(`Trying to download ${wasmUrl}`);
						const wasmContent = await this.fetchUrlBinary(wasmUrl);
						const wasmPath = path.join(this.visualizerDir, path.basename(wasmFile));
						fs.writeFileSync(wasmPath, wasmContent);
					} catch (e) {
						// WASM file might not exist, that's ok
						console.log(`WASM file not found: ${wasmUrl}`);
					}
				}
			} catch (e) {
				console.error(`Failed to download dependency ${dep}:`, e);
			}
		}
	}

	/**
	 * URLからテキストを取得
	 */
	private fetchUrl(url: string): Promise<string> {
		return new Promise((resolve, reject) => {
			https
				.get(url, (res) => {
					if (res.statusCode === 301 || res.statusCode === 302) {
						if (res.headers.location) {
							return this.fetchUrl(res.headers.location).then(resolve).catch(reject);
						}
					}

					let data = '';
					res.on('data', (chunk) => {
						data += chunk;
					});
					res.on('end', () => resolve(data));
				})
				.on('error', reject);
		});
	}

	/**
	 * URLからバイナリを取得
	 */
	private fetchUrlBinary(url: string): Promise<Buffer> {
		return new Promise((resolve, reject) => {
			https
				.get(url, (res) => {
					if (res.statusCode === 301 || res.statusCode === 302) {
						if (res.headers.location) {
							return this.fetchUrlBinary(res.headers.location).then(resolve).catch(reject);
						}
					}

					const chunks: Buffer[] = [];
					res.on('data', (chunk) => chunks.push(chunk));
					res.on('end', () => resolve(Buffer.concat(chunks)));
				})
				.on('error', reject);
		});
	}
}
