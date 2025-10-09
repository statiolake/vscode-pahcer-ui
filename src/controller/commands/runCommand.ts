import * as vscode from 'vscode';
import type { PahcerTreeViewController } from '../../controller/pahcerTreeViewController';
import { checkAndCommitIfEnabled } from '../../infrastructure/gitIntegration';
import type { OutputFileRepository } from '../../infrastructure/outputFileRepository';
import type { PahcerResultRepository } from '../../infrastructure/pahcerResultRepository';
import type { TaskAdapter } from '../../infrastructure/taskAdapter';
import type { WorkspaceAdapter } from '../../infrastructure/workspaceAdapter';

/**
 * pahcer run コマンドハンドラ
 */
export async function runCommand(
	workspaceAdapter: WorkspaceAdapter,
	taskAdapter: TaskAdapter,
	outputFileRepository: OutputFileRepository,
	resultRepository: PahcerResultRepository,
	treeViewController: PahcerTreeViewController,
): Promise<void> {
	const workspaceRoot = workspaceAdapter.getWorkspaceRoot();

	if (!workspaceRoot) {
		vscode.window.showErrorMessage('ワークスペースが開かれていません');
		return;
	}

	// Git統合チェック＆コミット
	let commitHash: string | null = null;
	try {
		commitHash = await checkAndCommitIfEnabled(workspaceRoot);
	} catch (error) {
		// エラーメッセージは checkAndCommitIfEnabled 内で表示済み
		return;
	}

	await taskAdapter.runPahcer(workspaceRoot);

	// Task completed - copy output files and refresh
	const latestResult = await resultRepository.getLatestResult();
	if (latestResult) {
		const pahcerResult = await resultRepository.loadResult(latestResult.id);
		if (pahcerResult) {
			await outputFileRepository.copyOutputFiles(
				latestResult.id,
				pahcerResult,
				commitHash || undefined,
			);
		}
	}
	treeViewController.refresh();
}
