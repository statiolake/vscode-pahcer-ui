import type { ComparisonData } from '@pahcer/core/application/dtos/comparisonData';
import type {
  TreeExecutionCases,
  TreeExecutionStats,
  TreeSeedExecution,
  TreeSeedStats,
  TreeTestCase,
} from '@pahcer/core/application/dtos/pahcerTreeData';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

type TreeData = {
  executions: TreeExecutionStats['execution'][];
  testCases: Array<{ executionId: string; seed: number; score: number; executionTime: number }>;
  objective: 'max' | 'min';
  bestScores: Record<string, number>;
  executionStatsList: TreeExecutionStats[];
};

type Mode = 'executions' | 'seeds';

function App() {
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('executions');
  const [selectedExecutionIds, setSelectedExecutionIds] = useState<string[]>([]);
  const [openExecutionId, setOpenExecutionId] = useState<string | null>(null);
  const [executionCases, setExecutionCases] = useState<TreeExecutionCases | null>(null);
  const [seeds, setSeeds] = useState<TreeSeedStats[]>([]);
  const [openSeed, setOpenSeed] = useState<number | null>(null);
  const [seedExecutions, setSeedExecutions] = useState<TreeSeedExecution[]>([]);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTree = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<TreeData>('/api/tree');
      setTreeData(data);
      setSelectedExecutionIds(data.executions.slice(0, 2).map((execution) => execution.id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (mode === 'seeds') {
      void fetchJson<TreeSeedStats[]>('/api/seeds').then(setSeeds).catch(showError(setError));
    }
  }, [mode]);

  const totals = useMemo(() => {
    if (!treeData) {
      return { executionCount: 0, caseCount: 0, bestTotal: 0 };
    }
    return {
      executionCount: treeData.executions.length,
      caseCount: treeData.testCases.length,
      bestTotal: Object.values(treeData.bestScores).reduce((sum, score) => sum + score, 0),
    };
  }, [treeData]);

  async function openExecution(executionId: string) {
    setOpenExecutionId(executionId);
    setOpenSeed(null);
    setExecutionCases(await fetchJson<TreeExecutionCases>(`/api/executions/${executionId}/cases`));
  }

  async function openSeedExecutions(seed: number) {
    setOpenSeed(seed);
    setOpenExecutionId(null);
    setSeedExecutions(await fetchJson<TreeSeedExecution[]>(`/api/seeds/${seed}/executions`));
  }

  async function loadComparison() {
    if (selectedExecutionIds.length === 0) {
      setComparison(null);
      return;
    }
    setComparison(
      await fetchJson<ComparisonData>(
        `/api/comparison?executionIds=${selectedExecutionIds.map(encodeURIComponent).join(',')}`,
      ),
    );
  }

  function toggleSelectedExecution(executionId: string) {
    setSelectedExecutionIds((current) =>
      current.includes(executionId)
        ? current.filter((id) => id !== executionId)
        : [...current, executionId],
    );
  }

  return (
    <main>
      <style>{styles}</style>
      <header className="topbar">
        <div>
          <p className="eyebrow">Pahcer UI</p>
          <h1>結果を確認する</h1>
        </div>
        <button type="button" onClick={loadTree}>
          再読み込み
        </button>
      </header>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">読み込み中</p>}

      {treeData && (
        <>
          <section className="metrics">
            <Metric label="実行" value={totals.executionCount} />
            <Metric label="ケース" value={totals.caseCount} />
            <Metric label="目的" value={treeData.objective === 'max' ? '最大化' : '最小化'} />
            <Metric label="Best 合計" value={formatNumber(totals.bestTotal)} />
          </section>

          <nav className="tabs">
            <button
              type="button"
              className={mode === 'executions' ? 'active' : ''}
              onClick={() => setMode('executions')}
            >
              実行ごと
            </button>
            <button
              type="button"
              className={mode === 'seeds' ? 'active' : ''}
              onClick={() => setMode('seeds')}
            >
              Seed ごと
            </button>
          </nav>

          <section className="layout">
            <div className="listPane">
              {mode === 'executions' ? (
                <ExecutionList
                  stats={treeData.executionStatsList}
                  selectedExecutionIds={selectedExecutionIds}
                  openExecutionId={openExecutionId}
                  onToggleSelected={toggleSelectedExecution}
                  onOpen={openExecution}
                />
              ) : (
                <SeedList seeds={seeds} openSeed={openSeed} onOpen={openSeedExecutions} />
              )}
            </div>

            <div className="detailPane">
              {mode === 'executions' && executionCases && (
                <ExecutionCasesView cases={executionCases.cases} />
              )}
              {mode === 'seeds' && (
                <SeedExecutionsView seed={openSeed} executions={seedExecutions} />
              )}
            </div>
          </section>

          <section className="comparison">
            <div className="sectionHeader">
              <div>
                <h2>比較</h2>
                <p className="muted">選択中: {selectedExecutionIds.length} 件</p>
              </div>
              <button type="button" onClick={loadComparison}>
                比較を表示
              </button>
            </div>
            {comparison && <ComparisonView data={comparison} />}
          </section>
        </>
      )}
    </main>
  );
}

function Metric(props: { label: string; value: string | number }) {
  return (
    <div className="metric">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  );
}

function ExecutionList(props: {
  stats: TreeExecutionStats[];
  selectedExecutionIds: string[];
  openExecutionId: string | null;
  onToggleSelected: (executionId: string) => void;
  onOpen: (executionId: string) => Promise<void>;
}) {
  return (
    <div className="rows">
      {props.stats.map((stats) => (
        <article
          className={props.openExecutionId === stats.execution.id ? 'row selected' : 'row'}
          key={stats.execution.id}
        >
          <label>
            <input
              type="checkbox"
              checked={props.selectedExecutionIds.includes(stats.execution.id)}
              onChange={() => props.onToggleSelected(stats.execution.id)}
            />
            <span>{stats.execution.titleWithHash}</span>
          </label>
          <p>{stats.execution.comment || 'コメントなし'}</p>
          <dl>
            <div>
              <dt>Score</dt>
              <dd>{formatNumber(stats.totalScore)}</dd>
            </div>
            <div>
              <dt>Relative</dt>
              <dd>{formatNumber(stats.averageRelativeScore)}%</dd>
            </div>
            <div>
              <dt>AC</dt>
              <dd>
                {stats.acCount}/{stats.caseCount}
              </dd>
            </div>
          </dl>
          <button type="button" onClick={() => props.onOpen(stats.execution.id)}>
            ケース
          </button>
        </article>
      ))}
    </div>
  );
}

function SeedList(props: {
  seeds: TreeSeedStats[];
  openSeed: number | null;
  onOpen: (seed: number) => Promise<void>;
}) {
  return (
    <div className="rows">
      {props.seeds.map((seed) => (
        <article className={props.openSeed === seed.seed ? 'row selected' : 'row'} key={seed.seed}>
          <h3>Seed {seed.seed}</h3>
          <dl>
            <div>
              <dt>Best</dt>
              <dd>{formatNumber(seed.bestScore)}</dd>
            </div>
            <div>
              <dt>Average</dt>
              <dd>{formatNumber(seed.averageScore)}</dd>
            </div>
            <div>
              <dt>Relative</dt>
              <dd>{formatNumber(seed.averageRelativeScore)}%</dd>
            </div>
          </dl>
          <button type="button" onClick={() => props.onOpen(seed.seed)}>
            実行
          </button>
        </article>
      ))}
    </div>
  );
}

function ExecutionCasesView(props: {
  cases: Array<{ testCase: TreeTestCase; relativeScore: number }>;
}) {
  return (
    <div>
      <h2>ケース</h2>
      <table>
        <thead>
          <tr>
            <th>Seed</th>
            <th>Score</th>
            <th>Relative</th>
            <th>Time</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {props.cases.map(({ testCase, relativeScore }) => (
            <tr key={`${testCase.executionId}:${testCase.seed}`}>
              <td>{testCase.seed}</td>
              <td>{formatNumber(testCase.score)}</td>
              <td>{formatNumber(relativeScore)}%</td>
              <td>{formatNumber(testCase.executionTime)}s</td>
              <td>{testCase.score > 0 ? 'AC' : 'WA'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeedExecutionsView(props: { seed: number | null; executions: TreeSeedExecution[] }) {
  return (
    <div>
      <h2>{props.seed === null ? 'Seed' : `Seed ${props.seed}`}</h2>
      <table>
        <thead>
          <tr>
            <th>実行</th>
            <th>Score</th>
            <th>Relative</th>
            <th>Latest</th>
          </tr>
        </thead>
        <tbody>
          {props.executions.map((execution) => (
            <tr key={execution.execution.id}>
              <td>{execution.execution.titleWithHash}</td>
              <td>{formatNumber(execution.testCase.score)}</td>
              <td>{formatNumber(execution.relativeScore)}%</td>
              <td>{execution.isLatest ? 'yes' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComparisonView(props: { data: ComparisonData }) {
  const rows = props.data.results.map((result) => ({
    id: result.id,
    totalScore: result.cases.reduce((sum, testCase) => sum + testCase.score, 0),
    meanRelative:
      result.cases.reduce((sum, testCase) => sum + testCase.relativeScore, 0) /
      Math.max(result.cases.length, 1),
  }));
  const maxTotal = Math.max(...rows.map((row) => row.totalScore), 1);

  return (
    <div className="comparisonGrid">
      {rows.map((row) => (
        <div className="barRow" key={row.id}>
          <span>{row.id}</span>
          <div className="barTrack">
            <div className="bar" style={{ width: `${(row.totalScore / maxTotal) * 100}%` }} />
          </div>
          <strong>{formatNumber(row.totalScore)}</strong>
          <em>{formatNumber(row.meanRelative)}%</em>
        </div>
      ))}
    </div>
  );
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || response.statusText);
  }
  return data;
}

function showError(setError: (message: string) => void) {
  return (caught: unknown) => setError(caught instanceof Error ? caught.message : String(caught));
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

const styles = `
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f7faf8; color: #18201c; }
main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 24px 0 48px; }
.topbar, .sectionHeader { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.eyebrow { margin: 0 0 4px; color: #3f7b5a; font-weight: 700; }
h1 { margin: 0; font-size: 32px; line-height: 1.15; }
h2 { margin: 0 0 12px; font-size: 22px; }
h3 { margin: 0; font-size: 16px; }
button { min-height: 36px; border: 1px solid #245b42; border-radius: 6px; background: #245b42; color: #fff; padding: 0 14px; font-weight: 700; cursor: pointer; }
button:hover { background: #1b4633; }
.error { border-left: 4px solid #c43b34; background: #fff2f0; padding: 12px; color: #8f211d; }
.muted { color: #66736c; margin: 0; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
.metric { background: #ffffff; border: 1px solid #d8e2dc; border-radius: 8px; padding: 16px; }
.metric span { display: block; color: #66736c; font-size: 13px; }
.metric strong { display: block; margin-top: 8px; font-size: 24px; }
.tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.tabs button { background: #ffffff; color: #245b42; }
.tabs button.active { background: #245b42; color: #ffffff; }
.layout { display: grid; grid-template-columns: minmax(280px, 420px) minmax(0, 1fr); gap: 16px; align-items: start; }
.listPane, .detailPane, .comparison { background: #ffffff; border: 1px solid #d8e2dc; border-radius: 8px; padding: 16px; }
.rows { display: grid; gap: 10px; max-height: 640px; overflow: auto; }
.row { border: 1px solid #d8e2dc; border-radius: 8px; padding: 12px; }
.row.selected { border-color: #245b42; background: #f0f7f3; }
.row label { display: flex; gap: 8px; align-items: center; font-weight: 700; }
.row p { margin: 8px 0; color: #66736c; }
dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin: 12px 0; }
dt { color: #66736c; font-size: 12px; }
dd { margin: 2px 0 0; font-weight: 700; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; border-bottom: 1px solid #e6ede9; padding: 10px 8px; font-size: 14px; }
th { color: #4e5d55; }
.comparison { margin-top: 16px; }
.comparisonGrid { display: grid; gap: 10px; }
.barRow { display: grid; grid-template-columns: minmax(110px, 180px) minmax(120px, 1fr) 90px 80px; gap: 10px; align-items: center; }
.barTrack { height: 12px; background: #e6ede9; border-radius: 6px; overflow: hidden; }
.bar { height: 100%; background: #d04f3a; border-radius: 6px; }
.barRow em { color: #66736c; font-style: normal; }
@media (max-width: 760px) {
  main { width: min(100% - 20px, 1180px); padding-top: 16px; }
  .topbar, .sectionHeader { align-items: flex-start; flex-direction: column; }
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .layout { grid-template-columns: 1fr; }
  .barRow { grid-template-columns: 1fr; }
}
`;

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
