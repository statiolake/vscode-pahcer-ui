import { isValidExpression } from '../../shared/utils/expression';
import { parseFeatures } from '../../shared/utils/features';

interface Props {
  featureString: string;
  xAxis: string;
  yAxis: string;
  chartType: 'line' | 'scatter';
  skipFailed: boolean;
  filter: string;
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
  onFeatureStringChange,
  onXAxisChange,
  onYAxisChange,
  onChartTypeChange,
  onSkipFailedChange,
  onFilterChange,
}: Props) {
  const features = parseFeatures(featureString);
  const variableNames = ['seed', 'absScore', 'relScore', ...features];

  const sectionStyle = {
    marginBottom: '20px',
    padding: '10px',
    border: '1px solid var(--vscode-panel-border)',
  };

  const controlsStyle = {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
  };

  const labelStyle = {
    marginRight: '10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const inputStyle = {
    padding: '4px 8px',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
  };

  const isXAxisValid = isValidExpression(xAxis, variableNames);
  const isYAxisValid = isValidExpression(yAxis, variableNames);
  const isFilterValid = filter.trim() === '' || isValidExpression(filter, variableNames);

  const xAxisInputStyle = {
    ...inputStyle,
    width: '200px',
    outline: isXAxisValid ? 'none' : '2px solid var(--vscode-inputValidation-errorBorder)',
    backgroundColor: isXAxisValid
      ? 'var(--vscode-input-background)'
      : 'var(--vscode-inputValidation-errorBackground)',
  };

  const yAxisInputStyle = {
    ...inputStyle,
    width: '200px',
    outline: isYAxisValid ? 'none' : '2px solid var(--vscode-inputValidation-errorBorder)',
    backgroundColor: isYAxisValid
      ? 'var(--vscode-input-background)'
      : 'var(--vscode-inputValidation-errorBackground)',
  };

  const filterInputStyle = {
    ...inputStyle,
    width: '200px',
    outline: isFilterValid ? 'none' : '2px solid var(--vscode-inputValidation-errorBorder)',
    backgroundColor: isFilterValid
      ? 'var(--vscode-input-background)'
      : 'var(--vscode-inputValidation-errorBackground)',
  };

  return (
    <div style={sectionStyle}>
      {/* First row: Features and Filter */}
      <div style={controlsStyle}>
        <label style={labelStyle}>
          Features:
          <input
            type="text"
            value={featureString}
            onChange={(e) => onFeatureStringChange(e.target.value)}
            placeholder="例: N M K"
            style={{ ...inputStyle, width: '300px' }}
          />
        </label>
        <label style={labelStyle}>
          Filter:
          <input
            type="text"
            value={filter}
            onChange={(e) => onFilterChange(e.target.value)}
            placeholder="例: N >= 100"
            style={filterInputStyle}
            title={isFilterValid ? '' : '式が不正です'}
          />
        </label>
      </div>
      {/* Second row: Chart type, X-axis, Y-axis, Skip Failed */}
      <div style={{ ...controlsStyle, marginTop: '10px' }}>
        <label style={labelStyle}>
          <select
            style={inputStyle}
            value={chartType}
            onChange={(e) => onChartTypeChange(e.target.value as 'line' | 'scatter')}
          >
            <option value="line">折れ線</option>
            <option value="scatter">散布図</option>
          </select>
        </label>
        <label style={labelStyle}>
          X軸:
          <input
            type="text"
            value={xAxis}
            onChange={(e) => onXAxisChange(e.target.value)}
            placeholder="例: seed, N, log(N)"
            style={xAxisInputStyle}
            title={isXAxisValid ? '' : '式が不正です（未完成の括弧や演算子があります）'}
          />
        </label>
        <label style={labelStyle}>
          Y軸:
          <input
            type="text"
            value={yAxis}
            onChange={(e) => onYAxisChange(e.target.value)}
            placeholder="例: absScore, relScore"
            style={yAxisInputStyle}
            title={isYAxisValid ? '' : '式が不正です（未完成の括弧や演算子があります）'}
          />
        </label>
        <label style={labelStyle}>
          <input
            type="checkbox"
            checked={skipFailed}
            onChange={(e) => onSkipFailedChange(e.target.checked)}
          />
          WA を無視
        </label>
      </div>
      <details style={{ marginTop: '10px' }}>
        <summary
          style={{
            fontSize: '0.9em',
            color: 'var(--vscode-descriptionForeground)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          設定の詳細
        </summary>
        <div
          style={{
            fontSize: '0.9em',
            color: 'var(--vscode-descriptionForeground)',
            marginTop: '8px',
            paddingLeft: '20px',
          }}
        >
          <p style={{ marginTop: '5px', marginBottom: '10px' }}>
            <strong>Features:</strong> 入力ファイルの先頭行を空白区切りで解釈し、ここで指定した名前
            (例: <code>N M K</code>) を変数として使います
          </p>
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>利用可能な変数:</strong>
          </p>
          <ul style={{ marginTop: '5px', marginBottom: '10px', paddingLeft: '20px' }}>
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
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>算術演算子:</strong> <code>+</code>, <code>-</code>, <code>*</code>,{' '}
            <code>/</code>, <code>^</code> (累乗、右結合)
          </p>
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>比較演算子:</strong> <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>,{' '}
            <code>&gt;=</code>, <code>==</code>, <code>!=</code> (真で <code>1</code>、偽で{' '}
            <code>0</code> を返す。X軸・Y軸・Filter すべてで使用可能)
          </p>
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>その他の記法:</strong>
          </p>
          <ul style={{ marginTop: '5px', marginBottom: '10px', paddingLeft: '20px' }}>
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
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>利用可能な関数:</strong>
          </p>
          <ul style={{ marginTop: '5px', marginBottom: '10px', paddingLeft: '20px' }}>
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
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>式の例:</strong> <code>seed</code>, <code>N</code>, <code>log(N)</code>,{' '}
            <code>N^2</code>, <code>2*N</code>, <code>(N + M) / 2</code>, <code>absScore/1000</code>
            , <code>avg(absScore)</code>, <code>max(relScore)</code>, <code>msec</code>,{' '}
            <code>log($iter)</code>, <code>N &gt;= 100</code>
          </p>
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>X軸・Y軸の動作:</strong>
          </p>
          <ul style={{ marginTop: '5px', marginBottom: '10px', paddingLeft: '20px' }}>
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
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>標準エラー出力の変数:</strong> 標準エラー出力の先頭100行と末尾100行から{' '}
            <code>$varname = value</code> 形式で抽出 (末尾の値が同名変数より優先)
          </p>
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>Filter:</strong>{' '}
            条件式を指定してデータをフィルタリング（空欄の場合は全データを表示）
          </p>
          <ul style={{ marginTop: '5px', marginBottom: '10px', paddingLeft: '20px' }}>
            <li>
              例: <code>N &gt;= 100</code>, <code>N == 50</code>, <code>N * M &lt;= 1000</code>
            </li>
          </ul>
          <p style={{ marginTop: '0', marginBottom: '10px' }}>
            <strong>グラフタイプ:</strong> 折れ線は X 値の昇順で点を結び、散布図は点のみを表示します
          </p>
          <p style={{ marginTop: '0', marginBottom: '5px' }}>
            <strong>「WA を無視」:</strong>{' '}
            チェックすると、集計時にスコアが0のケース（WA）を除外します
          </p>
        </div>
      </details>
    </div>
  );
}
