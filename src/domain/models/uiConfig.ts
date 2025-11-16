/**
 * 比較モードの設定
 */
export interface UIConfig {
  featureString: string; // e.g., "N M K"
  xAxis: string; // e.g., "seed", "N", "log(N)"
  yAxis: string; // e.g., "absScore", "relScore"
  chartType: 'line' | 'scatter';
  filter: string; // e.g., "N >= 100", "N == 50"
}

/**
 * デフォルトの設定
 */
export const DEFAULT_UI_CONFIG: UIConfig = {
  featureString: 'N M K',
  xAxis: 'seed',
  yAxis: 'avg(absScore)',
  chartType: 'line',
  filter: '',
};
