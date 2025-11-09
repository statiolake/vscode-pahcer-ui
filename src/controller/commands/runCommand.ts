import * as vscode from 'vscode';
import type { PahcerTreeViewController } from '../../controller/pahcerTreeViewController';
import type { ExecutionRepository } from '../../infrastructure/executionRepository';
import {
	commitResultsAfterExecution,
	commitSourceBeforeExecution,
} from '../../infrastructure/gitIntegration';
import type { InOutRepository } from '../../infrastructure/inOutRepository';
import type { TaskAdapter } from '../../infrastructure/taskAdapter';
import { TestCaseRepository } from '../../infrastructure/testCaseRepository';

/**
 * pahcer run コマンドハンドラ
 */
export function runCommand(
	taskAdapter: TaskAdapter,
	inOutRepository: InOutRepository,
	executionRepository: ExecutionRepository,
	treeViewController: PahcerTreeViewController,
): () => Promise<void> {
	return async () => {
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

		if (!workspaceRoot) {
			vscode.window.showErrorMessage('ワークスペースが開かれていません');
			return;
		}

		// Git統合: 実行前にソースコードをコミット
		let commitHash: string | null = null;
		try {
			commitHash = await commitSourceBeforeExecution(workspaceRoot);
		} catch (error) {
			vscode.window.showErrorMessage(`gitの操作に失敗しました: ${error}`);
			return;
		}

		await taskAdapter.runPahcer(workspaceRoot);

		// Task completed - copy output files
		const latestExecution = await executionRepository.getLatestExecution();
		if (latestExecution) {
			// output ファイルをコピーして meta.json に commitHash を保存
			await inOutRepository.copyOutputFiles(
				latestExecution.id,
				latestExecution,
				commitHash || undefined,
			);

			// Git統合: 実行後に結果をコミット
			try {
				const testCaseRepository = new TestCaseRepository(workspaceRoot);
				const allTestCases = await testCaseRepository.loadAllTestCases();
				const executionTestCases = allTestCases.filter(
					(tc) => tc.executionId === latestExecution.id,
				);
				const totalScore = executionTestCases.reduce((sum, tc) => sum + tc.score, 0);
				await commitResultsAfterExecution(workspaceRoot, executionTestCases.length, totalScore);
			} catch (error) {
				vscode.window.showErrorMessage(`結果コミットに失敗しました: ${error}`);
			}
		}
		treeViewController.refresh();
	};
}
