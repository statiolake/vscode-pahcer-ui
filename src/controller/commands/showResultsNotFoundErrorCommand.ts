import type { DialogAdapter } from '../../infrastructure/dialogAdapter';

/**
 * 結果が見つからないエラーを表示するコマンドハンドラ
 */
export function showResultsNotFoundErrorCommand(
	dialogAdapter: DialogAdapter,
): (seed: number) => void {
	return (seed: number) => {
		const seedStr = String(seed).padStart(4, '0');
		dialogAdapter.showErrorMessage(
			`Seed ${seedStr} の結果が見つからないため、ビジュアライザを開けません。`,
		);
	};
}
