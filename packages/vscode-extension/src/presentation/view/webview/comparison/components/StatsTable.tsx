import type { StatsRow } from '../types';

interface Props {
  stats: StatsRow[];
  showsFilteredCount: boolean;
  bestRankingInclude: string;
  bestRankingExclude: string;
  onBestRankingIncludeChange: (value: string) => void;
  onBestRankingExcludeChange: (value: string) => void;
}

export function StatsTable({
  stats,
  showsFilteredCount,
  bestRankingInclude,
  bestRankingExclude,
  onBestRankingIncludeChange,
  onBestRankingExcludeChange,
}: Props) {
  const sectionStyle = {
    marginBottom: '20px',
    padding: '10px',
    border: '1px solid var(--vscode-panel-border)',
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
  };

  const cellStyle = {
    padding: '8px',
    textAlign: 'left' as const,
  };

  const thStyle = {
    ...cellStyle,
    borderBottom: '1px solid var(--vscode-panel-border)',
    fontWeight: 'bold' as const,
  };

  const inputStyle = {
    padding: '4px 8px',
    backgroundColor: 'var(--vscode-input-background)',
    color: 'var(--vscode-input-foreground)',
    border: '1px solid var(--vscode-input-border)',
  };

  const labelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.9em',
  };

  const controlsStyle = {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap' as const,
    marginBottom: '10px',
  };

  return (
    <div style={sectionStyle}>
      <div
        style={{
          marginBottom: '10px',
          fontSize: '0.9em',
          color: 'var(--vscode-descriptionForeground)',
        }}
      >
        統計情報
      </div>
      <div style={controlsStyle}>
        <label style={labelStyle}>
          Best対象:
          <input
            type="text"
            value={bestRankingInclude}
            onChange={(e) => onBestRankingIncludeChange(e.target.value)}
            placeholder="コメント部分一致（空欄=全提出）"
            style={{ ...inputStyle, width: '220px' }}
          />
        </label>
        <label style={labelStyle}>
          Best除外:
          <input
            type="text"
            value={bestRankingExclude}
            onChange={(e) => onBestRankingExcludeChange(e.target.value)}
            placeholder="コメント部分一致"
            style={{ ...inputStyle, width: '220px' }}
          />
        </label>
      </div>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>実行</th>
            <th style={thStyle}>スコア合計</th>
            <th style={thStyle}>Mean ± SD</th>
            <th style={thStyle}>#Best</th>
            <th style={thStyle}>#Unique</th>
            <th style={thStyle}>#Fail</th>
            {showsFilteredCount && <th style={thStyle}>フィルタ後件数</th>}
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
            <tr key={stat.name}>
              <td style={cellStyle}>{stat.name}</td>
              <td style={cellStyle}>{stat.totalScore.toLocaleString()}</td>
              <td style={cellStyle}>
                {stat.mean.toLocaleString()} ± {stat.sd.toLocaleString()}
              </td>
              <td style={cellStyle}>{stat.bestCount}</td>
              <td style={cellStyle}>{stat.uniqueBestCount}</td>
              <td style={cellStyle}>{stat.failCount}</td>
              {showsFilteredCount && (
                <td style={cellStyle}>
                  {stat.filteredCount}/{stat.totalCount}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
