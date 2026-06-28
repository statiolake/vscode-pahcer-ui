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
      <div className="comparisonControlRows">
        <div className="comparisonControlRow">
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
        </div>

        <div className="comparisonControlRow comparisonDataRow">
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
          <div className="checkboxControl comparisonSkipFailed">
            <input
              id={skipFailedId}
              type="checkbox"
              checked={skipFailed}
              onChange={(event) => onSkipFailedChange(event.target.checked)}
            />
            <label htmlFor={skipFailedId}>WA を無視</label>
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
            <strong>Features:</strong> 入力ファイルの先頭行を空白区切りで解釈し、ここで指定した名前
            (例: <code>N M K</code>) を変数として使います
          </p>
          <p>
            <strong>利用可能な変数:</strong>
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
              <code>sec</code> - 実行時間 (秒)
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
            <strong>算術演算子:</strong> <code>+</code>, <code>-</code>, <code>*</code>,{' '}
            <code>/</code>, <code>^</code> (累乗、右結合)
          </p>
          <p>
            <strong>比較演算子:</strong> <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>,{' '}
            <code>&gt;=</code>, <code>==</code>, <code>!=</code> (真で <code>1</code>、偽で{' '}
            <code>0</code> を返す。X軸・Y軸・Filter すべてで使用可能)
          </p>
          <p>
            <strong>その他の記法:</strong>
          </p>
          <ul>
            <li>
              単項演算子: <code>+x</code>, <code>-x</code>
            </li>
            <li>
              括弧: <code>(式)</code>
            </li>
            <li>
              数値リテラル: <code>100</code>, <code>2.5</code> など
            </li>
            <li>
              演算子の優先順位 (高→低): 括弧 &gt; <code>^</code> &gt; <code>*</code> /{' '}
              <code>/</code> &gt; <code>+</code> / <code>-</code> &gt; 比較演算子
            </li>
            <li>
              暗黙の乗算は不可 (<code>2N</code> ではなく <code>2*N</code> と書く)
            </li>
          </ul>
          <p>
            <strong>利用可能な関数:</strong>
          </p>
          <ul>
            <li>
              要素ごと: <code>log(x)</code>, <code>ceil(x)</code>, <code>floor(x)</code>
            </li>
            <li>
              集計 (同じ X 値の Seed をまとめて計算): <code>avg(x)</code>, <code>max(x)</code>,{' '}
              <code>min(x)</code>
            </li>
            <li>
              その他: <code>random()</code> - 引数なし、0以上1未満の乱数
            </li>
          </ul>
          <p>
            <strong>式の例:</strong> <code>seed</code>, <code>N</code>, <code>log(N)</code>,{' '}
            <code>N^2</code>, <code>2*N</code>, <code>(N + M) / 2</code>, <code>absScore/1000</code>
            , <code>avg(absScore)</code>, <code>max(relScore)</code>, <code>sec</code>,{' '}
            <code>msec</code>, <code>log(msec)</code>, <code>log($iter)</code>,{' '}
            <code>N &gt;= 100</code>
          </p>
          <p>
            <strong>X軸・Y軸の動作:</strong>
          </p>
          <ul>
            <li>X軸は各 Seed ごとに1つの値 (スカラー) になる必要があります</li>
            <li>同じ X 値の Seed は1つのグループにまとめられます</li>
            <li>
              Y軸で集計関数 (<code>avg</code> 等) を使うと、グループごとに1点として表示されます
            </li>
            <li>Y軸で集計関数を使わない場合、グループ内の各 Seed ごとに個別の点が表示されます</li>
            <li>
              長さ1の配列は他の配列の長さにブロードキャストされます (例: <code>2*absScore</code> の{' '}
              <code>2</code> は各 Seed に適用)
            </li>
          </ul>
          <p>
            <strong>標準エラー出力の変数:</strong> 標準エラー出力の先頭100行と末尾100行から{' '}
            <code>$varname = value</code> 形式で抽出 (末尾の値が同名変数より優先)
          </p>
          <p>
            <strong>Filter:</strong>{' '}
            条件式を指定してデータをフィルタリング（空欄の場合は全データを表示）
          </p>
          <ul>
            <li>
              例: <code>N &gt;= 100</code>, <code>N == 50</code>, <code>N * M &lt;= 1000</code>
            </li>
          </ul>
          <p>
            <strong>グラフタイプ:</strong> 折れ線は X 値の昇順で点を結び、散布図は点のみを表示します
          </p>
          <p>
            <strong>「WA を無視」:</strong>{' '}
            チェックすると、集計時にスコアが0のケース（WA）を除外します
          </p>
        </div>
      </details>
    </section>
  );
}
