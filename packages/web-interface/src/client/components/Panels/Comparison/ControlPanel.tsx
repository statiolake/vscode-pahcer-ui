import { useId } from 'react';

import { IconChevronDown } from '../../Tree/icons';
import type { ComparisonExpressionValidation } from './types';

interface Props {
  featureString: string;
  xAxis: string;
  yAxis: string;
  chartType: 'line' | 'scatter';
  skipFailed: boolean;
  filter: string;
  validation: ComparisonExpressionValidation;
  onFeatureStringChange: (value: string) => void;
  onXAxisChange: (value: string) => void;
  onYAxisChange: (value: string) => void;
  onChartTypeChange: (value: 'line' | 'scatter') => void;
  onSkipFailedChange: (value: boolean) => void;
  onFilterChange: (value: string) => void;
}

export function ControlPanel({
  featureString,
  xAxis,
  yAxis,
  chartType,
  skipFailed,
  filter,
  validation,
  onFeatureStringChange,
  onXAxisChange,
  onYAxisChange,
  onChartTypeChange,
  onSkipFailedChange,
  onFilterChange,
}: Props) {
  const chartTypeId = useId();
  const skipFailedId = useId();
  const xAxisId = useId();
  const xAxisErrorId = useId();
  const yAxisId = useId();
  const yAxisErrorId = useId();
  const featureStringId = useId();
  const filterId = useId();
  const filterErrorId = useId();

  return (
    <section className="comparisonControlPanel" aria-label="比較設定">
      <div className="comparisonSection">
        <div className="sectionLabel">グラフ</div>
        <div className="formField">
          <label htmlFor={chartTypeId}>グラフタイプ</label>
          <select
            id={chartTypeId}
            value={chartType}
            onChange={(event) => onChartTypeChange(event.target.value as 'line' | 'scatter')}
          >
            <option value="line">折れ線</option>
            <option value="scatter">散布図</option>
          </select>
        </div>
        <div className="checkboxControl">
          <input
            id={skipFailedId}
            type="checkbox"
            checked={skipFailed}
            onChange={(event) => onSkipFailedChange(event.target.checked)}
          />
          <label htmlFor={skipFailedId}>WA を無視</label>
        </div>
      </div>

      <div className="comparisonSection">
        <div className="sectionLabel">軸</div>
        <div className="fieldGrid">
          <div className={validation.xAxis ? 'formField' : 'formField invalid'}>
            <label htmlFor={xAxisId}>X軸</label>
            <input
              id={xAxisId}
              type="text"
              value={xAxis}
              onChange={(event) => onXAxisChange(event.target.value)}
              placeholder="例: seed, N, log(N)"
              title={validation.xAxis ? '' : '式が不正です'}
              aria-invalid={!validation.xAxis}
              aria-describedby={validation.xAxis ? undefined : xAxisErrorId}
            />
            {!validation.xAxis && (
              <span className="fieldError" id={xAxisErrorId}>
                式が不正です
              </span>
            )}
          </div>
          <div className={validation.yAxis ? 'formField' : 'formField invalid'}>
            <label htmlFor={yAxisId}>Y軸</label>
            <input
              id={yAxisId}
              type="text"
              value={yAxis}
              onChange={(event) => onYAxisChange(event.target.value)}
              placeholder="例: absScore, relScore"
              title={validation.yAxis ? '' : '式が不正です'}
              aria-invalid={!validation.yAxis}
              aria-describedby={validation.yAxis ? undefined : yAxisErrorId}
            />
            {!validation.yAxis && (
              <span className="fieldError" id={yAxisErrorId}>
                式が不正です
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="comparisonSection">
        <div className="sectionLabel">データ</div>
        <div className="fieldGrid">
          <div className="formField">
            <label htmlFor={featureStringId}>Features</label>
            <input
              id={featureStringId}
              type="text"
              value={featureString}
              onChange={(event) => onFeatureStringChange(event.target.value)}
              placeholder="例: N M K"
            />
          </div>
          <div className={validation.filter ? 'formField' : 'formField invalid'}>
            <label htmlFor={filterId}>Filter</label>
            <input
              id={filterId}
              type="text"
              value={filter}
              onChange={(event) => onFilterChange(event.target.value)}
              placeholder="例: N >= 100"
              title={validation.filter ? '' : '式が不正です'}
              aria-invalid={!validation.filter}
              aria-describedby={validation.filter ? undefined : filterErrorId}
            />
            {!validation.filter && (
              <span className="fieldError" id={filterErrorId}>
                式が不正です
              </span>
            )}
          </div>
        </div>
      </div>

      <details className="comparisonDetails">
        <summary>
          <IconChevronDown className="chevronIcon" />
          設定の詳細
        </summary>
        <div className="comparisonDetailsBody">
          <p>
            <strong>Features:</strong> 入力ファイルの先頭行を空白区切りで解釈 (例: N M K)
          </p>
          <p>
            <strong>X軸・Y軸:</strong> 式を使用できます
          </p>
          <ul>
            <li>
              <code>seed</code> - シード番号
            </li>
            <li>
              <code>absScore</code> - 絶対スコア
            </li>
            <li>
              <code>relScore</code> - 相対スコア (%)
            </li>
            <li>
              <code>msec</code> - 実行時間 (ミリ秒)
            </li>
            <li>
              Features で定義した変数 (例: <code>N</code>, <code>M</code>, <code>K</code>)
            </li>
            <li>
              <code>$varname</code> - 標準エラー出力から抽出した変数 (例: <code>$iter</code>)
            </li>
          </ul>
          <p>
            <strong>式の例:</strong> <code>seed</code>, <code>N</code>, <code>log(N)</code>,{' '}
            <code>N^2</code>, <code>2*N</code>, <code>absScore/1000</code>,{' '}
            <code>relScore*100</code>, <code>msec</code>, <code>log($iter)</code>
          </p>
          <p>
            <strong>標準エラー出力の変数:</strong> 標準エラー出力の先頭100行と末尾100行から{' '}
            <code>$varname = value</code> 形式で抽出
          </p>
          <p>
            <strong>利用可能な関数:</strong>
          </p>
          <ul>
            <li>
              要素ごと: <code>log(x)</code>, <code>ceil(x)</code>, <code>floor(x)</code>
            </li>
            <li>
              集計: <code>avg(x)</code>, <code>max(x)</code>, <code>min(x)</code>
            </li>
            <li>
              その他: <code>random()</code> - 0以上1未満の乱数
            </li>
          </ul>
          <p>
            <strong>Filter:</strong>{' '}
            条件式を指定してデータをフィルタリング（空欄の場合は全データを表示）
          </p>
          <ul>
            <li>
              比較演算子: <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>,{' '}
              <code>&gt;=</code>, <code>==</code>, <code>!=</code>
            </li>
            <li>
              例: <code>N &gt;= 100</code>, <code>N == 50</code>, <code>N * M &lt;= 1000</code>
            </li>
          </ul>
          <p>
            <strong>「WA を無視」:</strong>{' '}
            チェックすると、集計時にスコアが0のケース（WA）を除外します
          </p>
        </div>
      </details>
    </section>
  );
}
