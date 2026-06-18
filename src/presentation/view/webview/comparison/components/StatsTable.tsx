import type { StatsRow } from '../types';

interface Props {
  stats: StatsRow[];
  showsFilteredCount: boolean;
}

export function StatsTable({ stats, showsFilteredCount }: Props) {
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
