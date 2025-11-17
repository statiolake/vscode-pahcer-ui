/**
 * 比較モードの設定
 */
export class UIConfig {
  /**
   * UIConfig を構築する
   * @param featureString 入力ファイル1行目から抽出する変数（e.g., "N M K"）
   * @param xAxis X軸の式（e.g., "seed", "N", "log(N)"）
   * @param yAxis Y軸の指標（e.g., "absScore", "relScore"）
   * @param chartType グラフタイプ
   * @param filter フィルター式（e.g., "N >= 100", "N == 50"）
   */
  constructor(
    public featureString: string = 'N M K',
    public xAxis: string = 'seed',
    public yAxis: string = 'avg(absScore)',
    public chartType: 'line' | 'scatter' = 'line',
    public filter: string = '',
  ) {}
}
