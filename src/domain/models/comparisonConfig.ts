/**
 * 比較モードの設定
 */
export interface ComparisonConfig {
	features?: string; // e.g., "N M K"
	xAxis?: string; // e.g., "seed", "N", "log(N)"
	yAxis?: string; // e.g., "absolute", "relative"
}
