/**
 * 比較ビューの表示設定。
 *
 * Domain model ではなく、比較ビュー用の永続化 DTO。
 */
export class ComparisonConfig {
  constructor(
    public featureString: string = 'N M K',
    public xAxis: string = 'seed',
    public yAxis: string = 'avg(absScore)',
    public chartType: 'line' | 'scatter' = 'line',
    public skipFailed: boolean = true,
    public filter: string = '',
  ) {}
}
