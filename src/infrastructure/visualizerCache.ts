import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * ビジュアライザのキャッシュ管理
 */
export class VisualizerCache {
	constructor(private visualizerDir: string) {
		if (!fs.existsSync(visualizerDir)) {
			fs.mkdirSync(visualizerDir, { recursive: true });
		}
	}

	/**
	 * キャッシュされたHTMLファイル名を取得
	 */
	getCachedHtmlFileName(): string | null {
		if (!fs.existsSync(this.visualizerDir)) {
			return null;
		}

		const files = fs.readdirSync(this.visualizerDir);
		const htmlFile = files.find((f) => f.endsWith('.html'));
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
		return fs.existsSync(this.getHtmlPath(fileName));
	}

	/**
	 * HTMLファイルを読み込む
	 */
	readHtml(fileName: string): string {
		return fs.readFileSync(this.getHtmlPath(fileName), 'utf-8');
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
		return fs.existsSync(this.getResourcePath(fileName));
	}

	/**
	 * ビジュアライザディレクトリのパスを取得
	 */
	getVisualizerDir(): string {
		return this.visualizerDir;
	}
}
