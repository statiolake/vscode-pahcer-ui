/**
 * 比較モードの設定
 */
export interface ComparisonConfig {
	featureString: string; // e.g., "N M K"
	xAxis: string; // e.g., "seed", "N", "log(N)"
	yAxis: string; // e.g., "absScore", "relScore"
	chartType: 'line' | 'scatter';
}

/**
 * デフォルトの設定
 */
export const DEFAULT_COMPARISON_CONFIG: ComparisonConfig = {
	featureString: 'N M K',
	xAxis: 'seed',
	yAxis: 'absScore',
	chartType: 'line',
};
