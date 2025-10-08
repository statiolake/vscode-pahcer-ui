import { execSync } from 'node:child_process';
import * as vscode from 'vscode';

/**
 * Git操作を抽象化するアダプター
 */
export class GitAdapter {
	constructor(private workspaceRoot: string) {}

	/**
	 * 全ての変更をステージングしてコミットし、コミットハッシュを返す
	 * 変更がない場合は現在のHEADのコミットハッシュを返す
	 */
	async commitAll(message: string): Promise<string> {
		try {
			// git add -A
			execSync('git add -A', { cwd: this.workspaceRoot });

			// Check if there are changes to commit
			try {
				execSync('git diff-index --quiet HEAD', { cwd: this.workspaceRoot });
				// No changes - return current HEAD
				const hash = execSync('git rev-parse HEAD', { cwd: this.workspaceRoot }).toString().trim();
				return hash;
			} catch {
				// There are changes - proceed with commit
				execSync(`git commit -m "${message}"`, { cwd: this.workspaceRoot });

				// Get commit hash
				const hash = execSync('git rev-parse HEAD', { cwd: this.workspaceRoot }).toString().trim();

				return hash;
			}
		} catch (error) {
			throw new Error(`Git commit failed: ${error}`);
		}
	}

	/**
	 * 指定した2つのコミット間の差分をVS Codeで表示
	 * @param olderCommitHash 古い方のコミットハッシュ (left)
	 * @param newerCommitHash 新しい方のコミットハッシュ (right)
	 * @param leftTitle 左側（古い方）のタイトル
	 * @param rightTitle 右側（新しい方）のタイトル
	 */
	async showDiff(
		olderCommitHash: string,
		newerCommitHash: string,
		leftTitle: string,
		rightTitle: string,
	): Promise<void> {
		try {
			// Get list of changed files
			const output = execSync(`git diff --name-only ${olderCommitHash} ${newerCommitHash}`, {
				cwd: this.workspaceRoot,
			})
				.toString()
				.trim();

			if (!output) {
				vscode.window.showInformationMessage('変更されたファイルはありません');
				return;
			}

			const files = output.split('\n').filter((f) => f.trim());

			// Open diff for each file
			for (const file of files) {
				const fileUri = vscode.Uri.file(`${this.workspaceRoot}/${file}`);
				const leftUri = fileUri.with({
					scheme: 'git',
					query: JSON.stringify({ ref: olderCommitHash, path: fileUri.fsPath }),
				});
				const rightUri = fileUri.with({
					scheme: 'git',
					query: JSON.stringify({ ref: newerCommitHash, path: fileUri.fsPath }),
				});

				await vscode.commands.executeCommand(
					'vscode.diff',
					leftUri,
					rightUri,
					`${file} (${leftTitle} ↔ ${rightTitle})`,
				);
			}
		} catch (error) {
			throw new Error(`Git diff failed: ${error}`);
		}
	}

	/**
	 * Gitリポジトリが存在するかチェック
	 */
	isGitRepository(): boolean {
		try {
			execSync('git rev-parse --git-dir', { cwd: this.workspaceRoot });
			return true;
		} catch {
			return false;
		}
	}
}
