import type { StatsRow } from './types';

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
  return (
    <section className="comparisonStatsSection">
      <div className="comparisonSectionTitle">統計情報</div>
      <div className="comparisonStatsControls">
        <label>
          Best対象:
          <input
            type="text"
            value={bestRankingInclude}
            onChange={(event) => onBestRankingIncludeChange(event.target.value)}
            placeholder="コメント部分一致（空欄=全提出）"
          />
        </label>
        <label>
          Best除外:
          <input
            type="text"
            value={bestRankingExclude}
            onChange={(event) => onBestRankingExcludeChange(event.target.value)}
            placeholder="コメント部分一致"
          />
        </label>
      </div>
      <div className="comparisonStatsTableViewport">
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
      </div>
    </section>
  );
}
