import type { StatsRow } from './types';

interface Props {
  stats: StatsRow[];
  showsFilteredCount: boolean;
}

export function StatsTable({ stats, showsFilteredCount }: Props) {
  return (
    <section className="comparisonSection">
      <div className="comparisonSectionTitle">統計情報</div>
      <table className="comparisonStatsTable">
        <thead>
          <tr>
            <th>実行</th>
            <th>スコア合計</th>
            <th>Mean ± SD</th>
            <th>#Best</th>
            <th>#Unique</th>
            <th>#Fail</th>
            {showsFilteredCount && <th>フィルタ後件数</th>}
          </tr>
        </thead>
        <tbody>
          {stats.map((stat) => (
            <tr key={stat.name}>
              <td>{stat.name}</td>
              <td>{stat.totalScore.toLocaleString()}</td>
              <td>
                {stat.mean.toLocaleString()} ± {stat.sd.toLocaleString()}
              </td>
              <td>{stat.bestCount}</td>
              <td>{stat.uniqueBestCount}</td>
              <td>{stat.failCount}</td>
              {showsFilteredCount && (
                <td>
                  {stat.filteredCount}/{stat.totalCount}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
