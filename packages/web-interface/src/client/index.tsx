import type {
  ComparisonData,
  ComparisonViewOptions,
} from '@pahcer/core/application/dtos/comparisonData';
import type {
  TreeExecutionCases,
  TreeExecutionStats,
  TreeSeedExecution,
  TreeSeedStats,
  TreeTestCase,
} from '@pahcer/core/application/dtos/pahcerTreeData';
import type {
  ExecutionSortOrder,
  GroupingMode,
  PahcerStatusView,
  SeedSortOrder,
} from '@pahcer/core/application/dtos/pahcerUIState';
import { ComparisonViewReadModelService } from '@pahcer/core/application/services/comparisonViewReadModelService';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

type TreeData = {
  executions: TreeExecutionStats['execution'][];
  testCases: Array<{ executionId: string; seed: number; score: number; executionTime: number }>;
  objective: 'max' | 'min';
  bestScores: Record<string, number>;
  executionStatsList: TreeExecutionStats[];
};

type WebPreferences = {
  gitIntegration: boolean | null;
  groupingMode: GroupingMode;
  executionSortOrder: ExecutionSortOrder;
  seedSortOrder: SeedSortOrder;
  visualizerZoomLevel: number;
};

type StatusResponse = {
  status: PahcerStatusView;
  defaultProjectName: string;
  preferences: WebPreferences;
  workspaceRoot: string;
};

type Panel = 'comparison' | 'case' | 'diff' | 'source' | 'visualizer' | 'run' | 'initialize';
type CaseFileKind = 'input' | 'output' | 'error';

type FileView = { title: string; path?: string; content: string };
type DiffView = { status: string; files?: Array<{ file: string; patch: string }> };
type SourcePreparation =
  | { status: 'notFound' }
  | { status: 'missingCommitHash' }
  | { status: 'noFiles' }
  | { status: 'ready'; files: string[] };

const executionSortOptions: Array<{ value: ExecutionSortOrder; label: string }> = [
  { value: 'seedAsc', label: 'シードの昇順' },
  { value: 'seedDesc', label: 'シードの降順' },
  { value: 'relativeScoreDesc', label: '相対スコアの降順' },
  { value: 'relativeScoreAsc', label: '相対スコアの昇順' },
  { value: 'absoluteScoreDesc', label: '絶対スコアの降順' },
  { value: 'absoluteScoreAsc', label: '絶対スコアの昇順' },
];

const seedSortOptions: Array<{ value: SeedSortOrder; label: string }> = [
  { value: 'executionAsc', label: '実行の昇順' },
  { value: 'executionDesc', label: '実行の降順' },
  { value: 'absoluteScoreDesc', label: '絶対スコアの降順' },
  { value: 'absoluteScoreAsc', label: '絶対スコアの昇順' },
];

function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [preferences, setPreferences] = useState<WebPreferences | null>(null);
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [seeds, setSeeds] = useState<TreeSeedStats[]>([]);
  const [selectedExecutionIds, setSelectedExecutionIds] = useState<string[]>([]);
  const [openExecutionId, setOpenExecutionId] = useState<string | null>(null);
  const [executionCases, setExecutionCases] = useState<TreeExecutionCases | null>(null);
  const [openSeed, setOpenSeed] = useState<number | null>(null);
  const [seedExecutions, setSeedExecutions] = useState<TreeSeedExecution[]>([]);
  const [selectedCase, setSelectedCase] = useState<{ executionId: string; seed: number } | null>(
    null,
  );
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [fileView, setFileView] = useState<FileView | null>(null);
  const [diffView, setDiffView] = useState<DiffView | null>(null);
  const [sourcePreparation, setSourcePreparation] = useState<SourcePreparation | null>(null);
  const [sourceView, setSourceView] = useState<FileView | null>(null);
  const [visualizerSrc, setVisualizerSrc] = useState<string | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>('comparison');
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const mode = preferences?.groupingMode ?? 'byExecution';

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextStatus = await fetchJson<StatusResponse>('/api/status');
      setStatus(nextStatus);
      setPreferences(nextStatus.preferences);

      if (nextStatus.status !== 'ready') {
        setTreeData(null);
        setSeeds([]);
        setComparison(null);
        return;
      }

      const data = await fetchJson<TreeData>('/api/tree');
      setTreeData(data);
      setSelectedExecutionIds((current) =>
        current.filter((id) => data.executions.some((execution) => execution.id === id)),
      );
      if (nextStatus.preferences.groupingMode === 'bySeed') {
        setSeeds(await fetchJson<TreeSeedStats[]>('/api/seeds'));
      }
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!treeData || selectedExecutionIds.length === 0) {
      setComparison(null);
      return;
    }
    void fetchJson<ComparisonData>(
      `/api/comparison?executionIds=${selectedExecutionIds.map(encodeURIComponent).join(',')}`,
    )
      .then(setComparison)
      .catch((caught) => setError(toErrorMessage(caught)));
  }, [selectedExecutionIds, treeData]);

  async function updatePreferences(next: Partial<WebPreferences>) {
    const updated = await fetchJson<WebPreferences>('/api/preferences', {
      method: 'PATCH',
      body: JSON.stringify(next),
    });
    setPreferences(updated);
    if (next.groupingMode === 'bySeed') {
      setSeeds(await fetchJson<TreeSeedStats[]>('/api/seeds'));
    }
  }

  async function openExecution(executionId: string) {
    setOpenExecutionId((current) => (current === executionId ? null : executionId));
    setOpenSeed(null);
    setSelectedCase(null);
    if (openExecutionId !== executionId) {
      setExecutionCases(
        await fetchJson<TreeExecutionCases>(
          `/api/executions/${encodeURIComponent(executionId)}/cases?sort=${preferences?.executionSortOrder ?? 'seedAsc'}`,
        ),
      );
    }
  }

  async function openSeedExecutions(seed: number) {
    setOpenSeed((current) => (current === seed ? null : seed));
    setOpenExecutionId(null);
    setSelectedCase(null);
    if (openSeed !== seed) {
      setSeedExecutions(
        await fetchJson<TreeSeedExecution[]>(
          `/api/seeds/${seed}/executions?sort=${preferences?.seedSortOrder ?? 'executionAsc'}`,
        ),
      );
    }
  }

  function toggleSelectedExecution(executionId: string) {
    setSelectedExecutionIds((current) =>
      current.includes(executionId)
        ? current.filter((id) => id !== executionId)
        : [...current, executionId],
    );
  }

  async function runPahcer(options: {
    startSeed?: number;
    endSeed?: number;
    freezeBestScores: boolean;
    enableGitIntegration?: boolean;
  }) {
    setLoading(true);
    setMessages([]);
    setError(null);
    try {
      const result = await fetchJson<{ messages: string[] }>('/api/run', {
        method: 'POST',
        body: JSON.stringify(options),
      });
      setMessages(result.messages);
      await reload();
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function initialize(request: {
    problemName: string;
    objective: 'max' | 'min';
    language: 'rust' | 'cpp' | 'python' | 'go';
    isInteractive: boolean;
    testerUrl: string;
    useDetectedInteractive: boolean;
  }) {
    setLoading(true);
    setError(null);
    try {
      await fetchJson<{ ok: boolean }>('/api/initialize', {
        method: 'POST',
        body: JSON.stringify(request),
      });
      await reload();
      setActivePanel('comparison');
    } catch (caught) {
      setError(toErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  async function saveComment(executionId: string, comment: string) {
    await fetchJson<{ ok: boolean }>(`/api/executions/${encodeURIComponent(executionId)}/comment`, {
      method: 'POST',
      body: JSON.stringify({ comment }),
    });
    await reload();
  }

  async function openCaseFile(kind: CaseFileKind, executionId: string, seed: number) {
    const query = new URLSearchParams({ kind, executionId, seed: String(seed) });
    const file = await fetchJson<FileView>(`/api/case-file?${query}`);
    setFileView({ ...file, title: `${caseFileKindLabel(kind)}: Seed ${formatSeed(seed)}` });
    setActivePanel('case');
  }

  async function showDiff() {
    const diff = await fetchJson<DiffView>(
      `/api/diff?executionIds=${selectedExecutionIds.map(encodeURIComponent).join(',')}`,
    );
    setDiffView(diff);
    setActivePanel('diff');
  }

  async function prepareSource(executionId: string) {
    const preparation = await fetchJson<SourcePreparation>(
      `/api/source/${encodeURIComponent(executionId)}/prepare`,
    );
    setSourcePreparation(preparation);
    setSourceView(null);
    setActivePanel('source');
  }

  async function loadSourceFile(executionId: string, file: string) {
    const source = await fetchJson<FileView>(
      `/api/source/${encodeURIComponent(executionId)}/content?file=${encodeURIComponent(file)}`,
    );
    setSourceView({ ...source, title: file });
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(source.content);
    }
  }

  async function openVisualizer(seed: number, executionId: string) {
    let htmlFileName = (await fetchJson<{ htmlFileName?: string }>('/api/visualizer/status'))
      .htmlFileName;
    if (!htmlFileName) {
      const url = window.prompt('AtCoder のビジュアライザ HTML URL');
      if (!url) {
        return;
      }
      htmlFileName = (
        await fetchJson<{ htmlFileName: string }>('/api/visualizer/download', {
          method: 'POST',
          body: JSON.stringify({ url }),
        })
      ).htmlFileName;
    }
    const query = new URLSearchParams({ seed: String(seed), executionId, htmlFileName });
    setVisualizerSrc(`/api/visualizer/frame?${query}`);
    setActivePanel('visualizer');
  }

  const selectedExecution = treeData?.executionStatsList.find(
    (stats) => stats.execution.id === selectedExecutionIds[selectedExecutionIds.length - 1],
  )?.execution;

  return (
    <main>
      <style>{styles}</style>
      <header className="commandBar">
        <div className="brand">
          <strong>Pahcer</strong>
          <span>{status?.workspaceRoot ?? ''}</span>
        </div>
        <span className="statusChip">{statusLabel(status?.status)}</span>
      </header>

      {error && <div className="notice error">{error}</div>}
      {loading && <div className="notice">処理中</div>}
      {messages.map((message) => (
        <div className="notice" key={message}>
          {message}
        </div>
      ))}

      {status?.status === 'notInstalled' && (
        <section className="welcome">
          <h1>pahcer が見つかりません</h1>
          <p>このワークスペースで pahcer コマンドを実行できる状態にしてください。</p>
          <a href="https://github.com/terry-u16/pahcer" target="_blank" rel="noreferrer">
            pahcer を開く
          </a>
        </section>
      )}

      {status?.status === 'notInitialized' && (
        <section className="welcome">
          <h1>初期化が必要です</h1>
          <p>問題名、目的、言語、テスターを指定してワークスペースを初期化します。</p>
          <InitializePanel
            defaultProjectName={status.defaultProjectName}
            onInitialize={(request) => void initialize(request)}
          />
        </section>
      )}

      {status?.status === 'ready' && treeData && preferences && (
        <section className="workbench">
          <aside className="sideBar">
            <div className="resultHeader">
              <div>
                <h2>Pahcer Results</h2>
                <p>{selectedExecutionIds.length} 件を選択中</p>
              </div>
              <div className="contextActions">
                <button
                  type="button"
                  className="primaryAction"
                  onClick={() => void runPahcer({ freezeBestScores: false })}
                >
                  実行
                </button>
                <button type="button" onClick={() => setActivePanel('run')}>
                  条件指定
                </button>
                <button type="button" onClick={() => void reload()}>
                  更新
                </button>
              </div>
            </div>
            <div className="treeToolbar">
              <button
                type="button"
                className={mode === 'byExecution' ? 'active' : ''}
                onClick={() => void updatePreferences({ groupingMode: 'byExecution' })}
              >
                実行
              </button>
              <button
                type="button"
                className={mode === 'bySeed' ? 'active' : ''}
                onClick={() => void updatePreferences({ groupingMode: 'bySeed' })}
              >
                Seed
              </button>
              <select
                value={
                  mode === 'byExecution'
                    ? preferences.executionSortOrder
                    : preferences.seedSortOrder
                }
                onChange={(event) =>
                  void updatePreferences(
                    mode === 'byExecution'
                      ? { executionSortOrder: event.target.value as ExecutionSortOrder }
                      : { seedSortOrder: event.target.value as SeedSortOrder },
                  )
                }
              >
                {(mode === 'byExecution' ? executionSortOptions : seedSortOptions).map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {mode === 'byExecution' ? (
              <ExecutionTree
                stats={treeData.executionStatsList}
                openExecutionId={openExecutionId}
                cases={executionCases}
                selectedExecutionIds={selectedExecutionIds}
                onToggleExecution={toggleSelectedExecution}
                onOpenExecution={(executionId) => void openExecution(executionId)}
                onSelectCase={(executionId, seed) => {
                  setSelectedCase({ executionId, seed });
                  setActivePanel('case');
                }}
                onSaveComment={(executionId, comment) => void saveComment(executionId, comment)}
                onPrepareSource={(executionId) => void prepareSource(executionId)}
              />
            ) : (
              <SeedTree
                seeds={seeds}
                openSeed={openSeed}
                executions={seedExecutions}
                selectedExecutionIds={selectedExecutionIds}
                onOpenSeed={(seed) => void openSeedExecutions(seed)}
                onToggleExecution={toggleSelectedExecution}
                onSelectCase={(executionId, seed) => {
                  setSelectedCase({ executionId, seed });
                  setActivePanel('case');
                }}
              />
            )}
          </aside>

          <section className="mainPanel">
            <nav className="panelTabs">
              {visiblePanels({
                activePanel,
                selectedCase,
                selectedExecution,
                diffView,
                sourcePreparation,
                sourceView,
                visualizerSrc,
              }).map((panel) => (
                <button
                  type="button"
                  className={activePanel === panel ? 'active' : ''}
                  onClick={() => setActivePanel(panel)}
                  key={panel}
                >
                  {panelLabel(panel)}
                </button>
              ))}
            </nav>

            {activePanel === 'comparison' && (
              <ComparisonPanel
                data={comparison}
                selectedCount={selectedExecutionIds.length}
                onShowDiff={() => void showDiff()}
              />
            )}

            {activePanel === 'case' && selectedCase && (
              <CasePanel
                selectedCase={selectedCase}
                fileView={fileView}
                onOpenFile={(kind) =>
                  void openCaseFile(kind, selectedCase.executionId, selectedCase.seed)
                }
                onVisualizer={() =>
                  void openVisualizer(selectedCase.seed, selectedCase.executionId)
                }
              />
            )}
            {activePanel === 'case' && !selectedCase && (
              <EmptyPanel text="ケースを選択してください" />
            )}

            {activePanel === 'diff' && (
              <DiffPanel diff={diffView} selectedCount={selectedExecutionIds.length} />
            )}

            {activePanel === 'source' && selectedExecution && (
              <SourcePanel
                executionId={selectedExecution.id}
                preparation={sourcePreparation}
                sourceView={sourceView}
                onPrepare={() => void prepareSource(selectedExecution.id)}
                onLoadFile={(file) => void loadSourceFile(selectedExecution.id, file)}
              />
            )}
            {activePanel === 'source' && !selectedExecution && (
              <EmptyPanel text="実行を選択してください" />
            )}

            {activePanel === 'visualizer' &&
              (visualizerSrc ? (
                <iframe className="visualizer" src={visualizerSrc} title="ビジュアライザ" />
              ) : (
                <EmptyPanel text="ケースを選択してビジュアライザを開いてください" />
              ))}

            {activePanel === 'run' && <RunPanel onRun={(options) => void runPahcer(options)} />}
          </section>
        </section>
      )}
    </main>
  );
}

function ExecutionTree(props: {
  stats: TreeExecutionStats[];
  openExecutionId: string | null;
  cases: TreeExecutionCases | null;
  selectedExecutionIds: string[];
  onToggleExecution: (executionId: string) => void;
  onOpenExecution: (executionId: string) => void;
  onSelectCase: (executionId: string, seed: number) => void;
  onSaveComment: (executionId: string, comment: string) => void;
  onPrepareSource: (executionId: string) => void;
}) {
  if (props.stats.length === 0) {
    return <EmptyPanel text="実行結果がありません" />;
  }

  return (
    <div className="tree">
      {props.stats.map((stats) => (
        <div className="treeGroup" key={stats.execution.id}>
          <div className="treeRow executionRow">
            <button
              type="button"
              className="disclosure"
              onClick={() => props.onOpenExecution(stats.execution.id)}
            >
              {props.openExecutionId === stats.execution.id ? 'v' : '>'}
            </button>
            <input
              type="checkbox"
              checked={props.selectedExecutionIds.includes(stats.execution.id)}
              onChange={() => props.onToggleExecution(stats.execution.id)}
            />
            <button
              type="button"
              className="treeLabel"
              onClick={() => props.onOpenExecution(stats.execution.id)}
            >
              {executionTreeLabel(stats)}
            </button>
            <span className="score">{executionDescription(stats.execution)}</span>
          </div>
          <div className="commentLine">
            <input
              defaultValue={stats.execution.comment}
              placeholder="コメント"
              onBlur={(event) => {
                if (event.target.value !== stats.execution.comment) {
                  props.onSaveComment(stats.execution.id, event.target.value);
                }
              }}
            />
            <button type="button" onClick={() => props.onPrepareSource(stats.execution.id)}>
              ソース
            </button>
          </div>
          {props.openExecutionId === stats.execution.id && props.cases && (
            <div className="children">
              <SummaryRow stats={props.cases.executionStats} />
              {props.cases.cases.map(({ testCase, relativeScore }) => (
                <CaseRow
                  key={`${testCase.executionId}:${testCase.seed}`}
                  testCase={testCase}
                  relativeScore={relativeScore}
                  onSelect={() => props.onSelectCase(testCase.executionId, testCase.seed)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SeedTree(props: {
  seeds: TreeSeedStats[];
  openSeed: number | null;
  executions: TreeSeedExecution[];
  selectedExecutionIds: string[];
  onOpenSeed: (seed: number) => void;
  onToggleExecution: (executionId: string) => void;
  onSelectCase: (executionId: string, seed: number) => void;
}) {
  if (props.seeds.length === 0) {
    return <EmptyPanel text="シードがありません" />;
  }

  return (
    <div className="tree">
      {props.seeds.map((seed) => (
        <div className="treeGroup" key={seed.seed}>
          <div className="treeRow">
            <button
              type="button"
              className="disclosure"
              onClick={() => props.onOpenSeed(seed.seed)}
            >
              {props.openSeed === seed.seed ? 'v' : '>'}
            </button>
            <button type="button" className="treeLabel" onClick={() => props.onOpenSeed(seed.seed)}>
              {formatSeed(seed.seed)}
            </button>
            <span className="score">
              {seed.count} runs - Avg: {seed.averageScore.toFixed(2)}
            </span>
          </div>
          {props.openSeed === seed.seed && (
            <div className="children">
              {props.executions.map((execution) => (
                <div className="treeRow caseRow" key={execution.execution.id}>
                  <input
                    type="checkbox"
                    checked={props.selectedExecutionIds.includes(execution.execution.id)}
                    onChange={() => props.onToggleExecution(execution.execution.id)}
                  />
                  <button
                    type="button"
                    className="treeLabel"
                    onClick={() => props.onSelectCase(execution.execution.id, seed.seed)}
                  >
                    {seedExecutionLabel(execution)}
                  </button>
                  <span>{formatExecutionTime(execution.testCase.executionTime)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryRow(props: { stats: TreeExecutionStats }) {
  return (
    <div className="summaryRow">
      <span>
        AC: {props.stats.acCount}/{props.stats.caseCount}
      </span>
      <span>Total Score: {props.stats.totalScore.toLocaleString()}</span>
      <span>Max Time: {(props.stats.maxExecutionTime * 1000).toFixed(0)}ms</span>
    </div>
  );
}

function CaseRow(props: { testCase: TreeTestCase; relativeScore: number; onSelect: () => void }) {
  const failed = props.testCase.errorMessage || !props.testCase.foundOutput;
  return (
    <button
      type="button"
      className={failed ? 'treeRow caseRow failed' : 'treeRow caseRow'}
      onClick={props.onSelect}
    >
      <span>
        {formatSeed(props.testCase.seed)}: {formatNumber(props.testCase.score)} (
        {props.relativeScore.toFixed(3)}%)
      </span>
      <span>{formatExecutionTime(props.testCase.executionTime)}</span>
    </button>
  );
}

function ComparisonPanel(props: {
  data: ComparisonData | null;
  selectedCount: number;
  onShowDiff: () => void;
}) {
  const [featureString, setFeatureString] = useState('N M K');
  const [xAxis, setXAxis] = useState('seed');
  const [yAxis, setYAxis] = useState('avg(absScore)');
  const [chartType, setChartType] = useState<'line' | 'scatter'>('line');
  const [filter, setFilter] = useState('');
  const [skipFailed, setSkipFailed] = useState(true);
  const service = useMemo(() => new ComparisonViewReadModelService(), []);

  useEffect(() => {
    if (!props.data) {
      return;
    }
    setFeatureString(props.data.config.featureString);
    setXAxis(props.data.config.xAxis);
    setYAxis(props.data.config.yAxis);
    setChartType(props.data.config.chartType);
    setFilter(props.data.config.filter);
  }, [props.data]);

  useEffect(() => {
    if (!props.data) {
      return;
    }
    const timeout = window.setTimeout(() => {
      void fetchJson('/api/comparison/config', {
        method: 'POST',
        body: JSON.stringify({
          featureString,
          xAxis,
          yAxis,
          chartType,
          filter,
        }),
      }).catch(console.error);
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [chartType, featureString, filter, props.data, xAxis, yAxis]);

  const options: ComparisonViewOptions = {
    featureString,
    xAxis,
    yAxis,
    chartType,
    filter,
    skipFailed,
  };
  const readModel = props.data ? service.build(props.data, options) : null;

  return (
    <div className="panelContent">
      <div className="panelHeader">
        <div>
          <h2>比較</h2>
          <p>{comparisonHint(props.selectedCount)}</p>
        </div>
        {props.selectedCount === 2 && (
          <button type="button" onClick={props.onShowDiff}>
            差分を表示
          </button>
        )}
      </div>
      {!props.data && <EmptyPanel text={`比較対象: ${props.selectedCount} 件`} />}
      {props.data && (
        <>
          <div className="formGrid comparisonControls">
            <label>
              Features:
              <input
                value={featureString}
                onChange={(event) => setFeatureString(event.target.value)}
              />
            </label>
            <label>
              X軸:
              <input value={xAxis} onChange={(event) => setXAxis(event.target.value)} />
            </label>
            <label>
              Y軸:
              <input value={yAxis} onChange={(event) => setYAxis(event.target.value)} />
            </label>
            <label>
              グラフ
              <select
                value={chartType}
                onChange={(event) => setChartType(event.target.value as 'line' | 'scatter')}
              >
                <option value="line">折れ線</option>
                <option value="scatter">散布図</option>
              </select>
            </label>
            <label>
              Filter:
              <input value={filter} onChange={(event) => setFilter(event.target.value)} />
            </label>
            <label className="checkLabel">
              <input
                type="checkbox"
                checked={skipFailed}
                onChange={(event) => setSkipFailed(event.target.checked)}
              />
              WA を無視
            </label>
          </div>
          {readModel && (
            <>
              <div className="chartArea">
                {readModel.chart.datasets.map((dataset) => (
                  <div className="dataset" key={dataset.resultId}>
                    <strong>{dataset.label}</strong>
                    <div className="spark">
                      {dataset.data.slice(0, 80).map((point) => (
                        <i
                          key={`${point.resultId}:${point.seed}:${point.x}`}
                          style={{ height: `${Math.max(4, Math.min(100, point.y))}%` }}
                          title={`Seed ${formatSeed(point.seed)}: ${formatNumber(point.y)}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>実行</th>
                    <th>スコア合計</th>
                    <th>Mean ± SD</th>
                    <th>#Best</th>
                    <th>#Unique</th>
                    <th>#Fail</th>
                    <th>フィルタ後件数</th>
                  </tr>
                </thead>
                <tbody>
                  {readModel.stats.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{formatNumber(row.totalScore)}</td>
                      <td>
                        {formatNumber(row.mean)} ± {formatNumber(row.sd)}
                      </td>
                      <td>{row.bestCount}</td>
                      <td>{row.uniqueBestCount}</td>
                      <td>{row.failCount}</td>
                      <td>{row.filteredCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CasePanel(props: {
  selectedCase: { executionId: string; seed: number };
  fileView: FileView | null;
  onOpenFile: (kind: CaseFileKind) => void;
  onVisualizer: () => void;
}) {
  return (
    <div className="panelContent">
      <div className="panelHeader">
        <h2>Seed {formatSeed(props.selectedCase.seed)}</h2>
        <div className="commands caseCommands">
          <button type="button" onClick={() => props.onOpenFile('input')}>
            入力
          </button>
          <button type="button" onClick={() => props.onOpenFile('output')}>
            出力
          </button>
          <button type="button" onClick={() => props.onOpenFile('error')}>
            エラー
          </button>
          <button type="button" onClick={props.onVisualizer}>
            ビジュアライザ
          </button>
        </div>
      </div>
      {props.fileView ? (
        <FileBlock file={props.fileView} />
      ) : (
        <EmptyPanel text="ファイルを選択してください" />
      )}
    </div>
  );
}

function DiffPanel(props: { diff: DiffView | null; selectedCount: number }) {
  if (!props.diff) {
    return <EmptyPanel text={`差分対象: ${props.selectedCount}/2 件`} />;
  }
  if (props.diff.status !== 'shown') {
    return <EmptyPanel text={diffStatusLabel(props.diff.status)} />;
  }
  if (!props.diff.files || props.diff.files.length === 0) {
    return <EmptyPanel text="表示対象の変更ファイルはありません" />;
  }
  return (
    <div className="panelContent">
      {props.diff.files.map((file) => (
        <FileBlock key={file.file} file={{ title: file.file, content: file.patch }} />
      ))}
    </div>
  );
}

function SourcePanel(props: {
  executionId: string;
  preparation: SourcePreparation | null;
  sourceView: FileView | null;
  onPrepare: () => void;
  onLoadFile: (file: string) => void;
}) {
  return (
    <div className="panelContent">
      <div className="panelHeader">
        <h2>ソース</h2>
        <button type="button" onClick={props.onPrepare}>
          ファイルを読み込む
        </button>
      </div>
      {props.preparation?.status === 'ready' && (
        <div className="fileList">
          {props.preparation.files.map((file) => (
            <button type="button" key={file} onClick={() => props.onLoadFile(file)}>
              {file}
            </button>
          ))}
        </div>
      )}
      {props.preparation && props.preparation.status !== 'ready' && (
        <EmptyPanel text={sourcePreparationStatusLabel(props.preparation.status)} />
      )}
      {props.sourceView && <FileBlock file={props.sourceView} />}
    </div>
  );
}

function RunPanel(props: {
  onRun: (options: {
    startSeed?: number;
    endSeed?: number;
    freezeBestScores: boolean;
    enableGitIntegration?: boolean;
  }) => void;
}) {
  const [startSeed, setStartSeed] = useState('');
  const [endSeed, setEndSeed] = useState('');
  const [freezeBestScores, setFreezeBestScores] = useState(false);
  const [enableGitIntegration, setEnableGitIntegration] = useState(false);
  return (
    <div className="panelContent narrow">
      <h2>詳細実行オプション</h2>
      <div className="formGrid">
        <label>
          開始 Seed
          <input value={startSeed} onChange={(event) => setStartSeed(event.target.value)} />
          <span className="fieldHelp">テストケースの開始seed値を指定します。</span>
        </label>
        <label>
          終了 Seed
          <input value={endSeed} onChange={(event) => setEndSeed(event.target.value)} />
          <span className="fieldHelp">
            テストケースの終了seed値を指定します。[start_seed, end_seed)
            の半開区間が実行されるため、end_seedは区間に含まれません。
          </span>
        </label>
        <label className="checkLabel">
          <input
            type="checkbox"
            checked={freezeBestScores}
            onChange={(event) => setFreezeBestScores(event.target.checked)}
          />
          <span>
            ベストスコアを更新しない (--freeze-best-scores)
            <small>チェックすると、ベストスコアの更新を行わずにテストを実行します。</small>
          </span>
        </label>
        <label className="checkLabel">
          <input
            type="checkbox"
            checked={enableGitIntegration}
            onChange={(event) => setEnableGitIntegration(event.target.checked)}
          />
          <span>Git 連携を使う</span>
        </label>
      </div>
      <button
        type="button"
        onClick={() =>
          props.onRun({
            startSeed: numberFromText(startSeed),
            endSeed: numberFromText(endSeed),
            freezeBestScores,
            enableGitIntegration,
          })
        }
      >
        実行
      </button>
    </div>
  );
}

function InitializePanel(props: {
  defaultProjectName: string;
  onInitialize: (request: {
    problemName: string;
    objective: 'max' | 'min';
    language: 'rust' | 'cpp' | 'python' | 'go';
    isInteractive: boolean;
    testerUrl: string;
    useDetectedInteractive: boolean;
  }) => void;
}) {
  const [problemName, setProblemName] = useState(props.defaultProjectName);
  const [objective, setObjective] = useState<'max' | 'min'>('max');
  const [language, setLanguage] = useState<'rust' | 'cpp' | 'python' | 'go'>('rust');
  const [isInteractive, setIsInteractive] = useState(false);
  const [testerUrl, setTesterUrl] = useState('');
  const [useDetectedInteractive, setUseDetectedInteractive] = useState(true);
  return (
    <div className="panelContent narrow">
      <h2>Pahcer プロジェクトの初期化</h2>
      <div className="formGrid">
        <label>
          問題名
          <input value={problemName} onChange={(event) => setProblemName(event.target.value)} />
          <span className="fieldHelp">AtCoderの問題名を入力してください。</span>
        </label>
        <label>
          最適化の目的
          <select
            value={objective}
            onChange={(event) => setObjective(event.target.value as 'max' | 'min')}
          >
            <option value="max">スコアを最大化 (Max)</option>
            <option value="min">スコアを最小化 (Min)</option>
          </select>
          <span className="fieldHelp">問題のスコア最適化の方向を選択してください。</span>
        </label>
        <label>
          使用言語
          <select
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as 'rust' | 'cpp' | 'python' | 'go')
            }
          >
            <option value="rust">Rust</option>
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="go">Go</option>
          </select>
          <span className="fieldHelp">
            プロジェクトで使用するプログラミング言語を選択してください。
          </span>
        </label>
        <label>
          ローカルテスターURL（オプション）
          <input value={testerUrl} onChange={(event) => setTesterUrl(event.target.value)} />
          <span className="fieldHelp">
            ローカルテスターのZIPファイルURLを入力すると、自動的にダウンロードして展開します。空欄の場合はスキップされます。
          </span>
        </label>
        <label className="checkLabel">
          <input
            type="checkbox"
            checked={isInteractive}
            onChange={(event) => setIsInteractive(event.target.checked)}
          />
          <span>
            インタラクティブ問題
            <small>インタラクティブ問題の場合はチェックを入れてください。</small>
          </span>
        </label>
        <label className="checkLabel">
          <input
            type="checkbox"
            checked={useDetectedInteractive}
            onChange={(event) => setUseDetectedInteractive(event.target.checked)}
          />
          <span>検出したテスター種別を使う</span>
        </label>
      </div>
      <button
        type="button"
        onClick={() =>
          props.onInitialize({
            problemName,
            objective,
            language,
            isInteractive,
            testerUrl,
            useDetectedInteractive,
          })
        }
      >
        初期化
      </button>
    </div>
  );
}

function FileBlock(props: { file: FileView }) {
  return (
    <section className="fileBlock">
      <h3>{props.file.title}</h3>
      {props.file.path && <p>{props.file.path}</p>}
      <pre>{props.file.content || '(空)'}</pre>
    </section>
  );
}

function EmptyPanel(props: { text: string }) {
  return <div className="empty">{props.text}</div>;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || response.statusText);
  }
  return data;
}

function panelLabel(panel: Panel): string {
  switch (panel) {
    case 'comparison':
      return '比較';
    case 'case':
      return 'ケース';
    case 'diff':
      return '差分';
    case 'source':
      return 'ソース';
    case 'visualizer':
      return 'ビジュアライザ';
    case 'run':
      return '実行';
    case 'initialize':
      return '初期化';
  }
}

function statusLabel(status: PahcerStatusView | undefined): string {
  switch (status) {
    case 'ready':
      return '準備完了';
    case 'notInitialized':
      return '未初期化';
    case 'notInstalled':
      return '未インストール';
    case 'unknown':
      return '状態不明';
    default:
      return '読み込み中';
  }
}

function caseFileKindLabel(kind: CaseFileKind): string {
  switch (kind) {
    case 'input':
      return '入力';
    case 'output':
      return '出力';
    case 'error':
      return 'エラー';
  }
}

function sourcePreparationStatusLabel(status: SourcePreparation['status']): string {
  switch (status) {
    case 'notFound':
      return '実行結果が見つかりません';
    case 'missingCommitHash':
      return 'コミット情報がありません';
    case 'noFiles':
      return '表示できるソースファイルがありません';
    case 'ready':
      return '読み込み可能です';
  }
}

function diffStatusLabel(status: string): string {
  switch (status) {
    case 'invalidSelection':
      return '比較する実行を 2 件選択してください';
    case 'missingCommitHash':
      return 'コミット情報がないため差分を表示できません';
    case 'shown':
      return '表示済み';
    default:
      return status;
  }
}

function comparisonHint(selectedCount: number): string {
  if (selectedCount === 0) {
    return '比較する実行を左の一覧から選択してください';
  }
  if (selectedCount === 1) {
    return 'もう 1 件以上選ぶと比較できます';
  }
  if (selectedCount === 2) {
    return '2 件選択中。差分も確認できます';
  }
  return `${selectedCount} 件選択中`;
}

function visiblePanels(input: {
  activePanel: Panel;
  selectedCase: { executionId: string; seed: number } | null;
  selectedExecution: TreeExecutionStats['execution'] | undefined;
  diffView: DiffView | null;
  sourcePreparation: SourcePreparation | null;
  sourceView: FileView | null;
  visualizerSrc: string | null;
}): Panel[] {
  const panels: Panel[] = ['comparison'];
  if (input.selectedCase) {
    panels.push('case');
  }
  if (input.diffView || input.activePanel === 'diff') {
    panels.push('diff');
  }
  if (input.selectedExecution || input.sourcePreparation || input.sourceView) {
    panels.push('source');
  }
  if (input.visualizerSrc) {
    panels.push('visualizer');
  }
  if (input.activePanel === 'run') {
    panels.push('run');
  }
  return panels;
}

function numberFromText(value: string): number | undefined {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatSeed(seed: number): string {
  return String(seed).padStart(4, '0');
}

function formatExecutionTime(seconds: number): string {
  return `${(seconds * 1000).toFixed(2)}ms`;
}

function executionTreeLabel(stats: TreeExecutionStats): string {
  return `${stats.execution.shortTitle} - Avg: ${stats.averageScore.toFixed(1)} (${stats.averageRelativeScore.toFixed(2)}%)`;
}

function seedExecutionLabel(execution: TreeSeedExecution): string {
  return `${execution.execution.shortTitle}: ${execution.testCase.score.toLocaleString()} (${execution.relativeScore.toFixed(3)}%)`;
}

function executionDescription(execution: TreeExecutionStats['execution']): string {
  return execution.comment || execution.tagName?.replace(/^pahcer\//, '') || '';
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const styles = `
:root {
  --bg: #f6f7f6;
  --surface: #ffffff;
  --surface-muted: #f0f3f1;
  --line: #d7ddd9;
  --line-strong: #b8c2bd;
  --text: #18211c;
  --muted: #637068;
  --soft: #7d8a82;
  --accent: #237a57;
  --accent-soft: #e3f2eb;
  --accent-line: #9cccb8;
  --danger: #b44035;
  --danger-soft: #f7e8e6;
  --shadow: 0 14px 36px rgba(31, 45, 38, 0.08);
}

* { box-sizing: border-box; }
html, body, #root { min-height: 100%; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  line-height: 1.45;
}
button, input, select { font: inherit; letter-spacing: 0; }
button {
  min-height: 32px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  padding: 5px 12px;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
}
button:hover { background: var(--surface-muted); border-color: var(--line-strong); }
button:focus-visible, input:focus-visible, select:focus-visible {
  outline: 2px solid var(--accent-line);
  outline-offset: 1px;
}
button:disabled { color: var(--soft); background: #f3f5f4; cursor: not-allowed; }
.primaryAction {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
  font-weight: 650;
}
.primaryAction:hover { background: #1d6548; border-color: #1d6548; }
input, select {
  min-height: 32px;
  width: 100%;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  padding: 5px 9px;
}
input::placeholder { color: #9aa39e; }
main { min-height: 100vh; display: flex; flex-direction: column; }
.commandBar {
  min-height: 52px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.94);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 9px 16px;
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(10px);
}
.brand { display: grid; min-width: 0; gap: 1px; }
.brand strong { font-size: 15px; line-height: 1.2; }
.brand span {
  color: var(--muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 52vw;
}
.statusChip {
  min-height: 28px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface-muted);
  color: var(--muted);
  font-size: 12px;
  font-weight: 650;
  padding: 3px 9px;
}
.commands { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.notice {
  margin: 10px 16px 0;
  border: 1px solid var(--accent-line);
  border-left: 4px solid var(--accent);
  border-radius: 6px;
  background: var(--surface);
  padding: 9px 12px;
  color: #244b39;
}
.notice.error { border-color: #e0aaa4; border-left-color: var(--danger); color: #8d2d25; background: var(--danger-soft); }
.welcome {
  width: min(760px, calc(100% - 32px));
  margin: 40px auto;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 24px;
  box-shadow: var(--shadow);
}
.welcome h1 { margin: 0 0 8px; font-size: 24px; line-height: 1.2; }
.welcome p { margin: 0 0 18px; color: var(--muted); }
.welcome a {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  border: 1px solid var(--accent-line);
  border-radius: 6px;
  background: var(--accent-soft);
  color: #18553b;
  font-weight: 650;
  padding: 5px 12px;
  text-decoration: none;
}
.welcome a:hover { border-color: var(--accent); }
.workbench {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 400px) minmax(0, 1fr);
  padding: 12px;
  gap: 12px;
}
.sideBar, .mainPanel {
  min-height: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(31, 45, 38, 0.04);
  overflow: hidden;
}
.sideBar { display: flex; flex-direction: column; }
.resultHeader {
  display: grid;
  gap: 10px;
  padding: 14px 14px 12px;
  border-bottom: 1px solid var(--line);
  background: #fbfcfb;
}
.resultHeader h2 { font-size: 16px; }
.resultHeader p, .panelHeader p {
  margin: 3px 0 0;
  color: var(--muted);
  font-size: 12px;
}
.contextActions {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
}
.treeToolbar {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--line);
  background: #fbfcfb;
}
.treeToolbar button, .panelTabs button {
  min-height: 30px;
  border-color: transparent;
  background: transparent;
  color: var(--muted);
}
.treeToolbar button.active, .panelTabs button.active {
  border-color: var(--accent-line);
  background: var(--accent-soft);
  color: #18553b;
  font-weight: 650;
}
.tree { overflow: auto; padding: 8px; }
.treeGroup {
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 3px;
}
.treeGroup + .treeGroup { margin-top: 4px; }
.treeGroup:focus-within, .treeGroup:hover { background: #f8faf9; border-color: #edf0ee; }
.treeRow {
  min-height: 34px;
  width: 100%;
  display: grid;
  grid-template-columns: 24px min-content minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 4px 7px;
  border-radius: 6px;
}
.treeRow:hover { background: var(--surface-muted); }
.caseRow { grid-template-columns: minmax(120px, 1fr) auto; color: var(--muted); }
.caseRow.failed { color: var(--danger); background: transparent; }
.executionRow .score, .score { color: var(--accent); font-weight: 700; }
.disclosure {
  min-height: 24px;
  width: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--soft);
}
.treeLabel {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  border: 0;
  background: transparent;
  padding: 0;
  min-height: 24px;
}
.commentLine {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 0 7px 6px 62px;
}
.commentLine input { min-height: 30px; background: #fbfcfb; }
.children {
  margin-left: 28px;
  border-left: 1px solid var(--line);
  padding: 4px 0 5px 10px;
}
.summaryRow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin: 3px 0 5px;
  padding: 7px 9px;
  border-radius: 6px;
  background: #f7faf8;
  color: var(--muted);
  font-size: 12px;
}
.mainPanel { min-width: 0; display: flex; flex-direction: column; }
.panelTabs {
  min-height: 44px;
  display: flex;
  gap: 4px;
  align-items: center;
  border-bottom: 1px solid var(--line);
  padding: 7px 10px;
  overflow: auto;
  background: #fbfcfb;
}
.panelContent { min-height: 0; overflow: auto; padding: 18px; }
.panelContent.narrow { max-width: 760px; }
.panelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}
.panelHeader > div { min-width: 0; }
h2, h3 { margin: 0; letter-spacing: 0; }
h2 { font-size: 18px; line-height: 1.25; }
h3 { font-size: 14px; line-height: 1.35; }
.formGrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}
.comparisonControls { grid-template-columns: repeat(3, minmax(0, 1fr)); }
label {
  display: grid;
  gap: 5px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}
.checkLabel {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  min-height: 32px;
  color: var(--text);
  font-weight: 500;
}
.checkLabel input { width: auto; }
.checkLabel span { display: grid; gap: 4px; }
.fieldHelp, .checkLabel small {
  color: var(--muted);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.45;
}
.chartArea { display: grid; gap: 12px; margin: 16px 0; }
.dataset {
  display: grid;
  grid-template-columns: minmax(150px, 220px) minmax(0, 1fr);
  gap: 14px;
  align-items: center;
}
.dataset strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.spark {
  height: 92px;
  border: 1px solid var(--line);
  border-radius: 8px;
  display: flex;
  align-items: end;
  gap: 2px;
  padding: 8px;
  overflow: hidden;
  background: #f8faf9;
}
.spark i { width: 5px; min-width: 5px; border-radius: 2px 2px 0 0; background: var(--accent); display: block; }
table { width: 100%; border-collapse: collapse; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
th, td { text-align: left; border-bottom: 1px solid #e6ebe8; padding: 9px 10px; font-size: 13px; }
th { color: var(--muted); background: #f8faf9; font-weight: 650; }
tr:last-child td { border-bottom: 0; }
.fileList { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.fileBlock {
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-bottom: 14px;
  overflow: hidden;
  background: var(--surface);
}
.fileBlock h3 { padding: 10px 12px; background: #f8faf9; border-bottom: 1px solid var(--line); }
.fileBlock p {
  margin: 0;
  padding: 7px 12px;
  color: var(--muted);
  border-bottom: 1px solid #e6ebe8;
  font-size: 12px;
  overflow-wrap: anywhere;
}
pre {
  margin: 0;
  padding: 12px;
  overflow: auto;
  background: #fbfcfb;
  color: #17201b;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
}
.empty {
  min-height: 160px;
  display: grid;
  place-items: center;
  padding: 28px;
  color: var(--muted);
  text-align: center;
}
.visualizer { width: 100%; height: calc(100vh - 116px); border: 0; background: var(--surface); }
@media (max-width: 820px) {
  .commandBar { align-items: stretch; flex-direction: column; }
  .brand span { max-width: 100%; }
  .workbench { grid-template-columns: 1fr; padding: 8px; }
  .sideBar { max-height: 48vh; }
  .formGrid, .comparisonControls { grid-template-columns: 1fr; }
  .dataset { grid-template-columns: 1fr; }
  .panelHeader { align-items: flex-start; flex-direction: column; }
}
`;

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
