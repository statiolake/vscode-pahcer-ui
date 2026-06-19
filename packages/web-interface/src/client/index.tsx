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
  { value: 'seedAsc', label: 'Seed 昇順' },
  { value: 'seedDesc', label: 'Seed 降順' },
  { value: 'relativeScoreDesc', label: '相対スコア 降順' },
  { value: 'relativeScoreAsc', label: '相対スコア 昇順' },
  { value: 'absoluteScoreDesc', label: '絶対スコア 降順' },
  { value: 'absoluteScoreAsc', label: '絶対スコア 昇順' },
];

const seedSortOptions: Array<{ value: SeedSortOrder; label: string }> = [
  { value: 'executionAsc', label: '実行 昇順' },
  { value: 'executionDesc', label: '実行 降順' },
  { value: 'absoluteScoreDesc', label: '絶対スコア 降順' },
  { value: 'absoluteScoreAsc', label: '絶対スコア 昇順' },
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
    setFileView({ ...file, title: `${kind}: seed ${seed}` });
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
          <strong>Pahcer UI</strong>
          <span>{status?.workspaceRoot ?? ''}</span>
        </div>
        <div className="commands">
          <button type="button" onClick={() => void runPahcer({ freezeBestScores: false })}>
            Run
          </button>
          <button type="button" onClick={() => setActivePanel('run')}>
            Run with options
          </button>
          <button type="button" onClick={() => setActivePanel('initialize')}>
            Initialize
          </button>
          <button type="button" onClick={() => void reload()}>
            Refresh
          </button>
          <button
            type="button"
            disabled={selectedExecutionIds.length !== 2}
            onClick={() => void showDiff()}
          >
            Diff
          </button>
        </div>
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
          <p>この workspace で pahcer コマンドを実行できる状態にしてください。</p>
        </section>
      )}

      {status?.status === 'notInitialized' && (
        <section className="welcome">
          <h1>初期化が必要です</h1>
          <p>問題名、目的、言語、テスターを指定して workspace を初期化します。</p>
          <InitializePanel
            defaultProjectName={status.defaultProjectName}
            onInitialize={(request) => void initialize(request)}
          />
        </section>
      )}

      {status?.status === 'ready' && treeData && preferences && (
        <section className="workbench">
          <aside className="sideBar">
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
              {(
                [
                  'comparison',
                  'case',
                  'diff',
                  'source',
                  'visualizer',
                  'run',
                  'initialize',
                ] as Panel[]
              ).map((panel) => (
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
              <ComparisonPanel data={comparison} selectedCount={selectedExecutionIds.length} />
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
                <iframe className="visualizer" src={visualizerSrc} title="visualizer" />
              ) : (
                <EmptyPanel text="ケースから Visualizer を開いてください" />
              ))}

            {activePanel === 'run' && <RunPanel onRun={(options) => void runPahcer(options)} />}

            {activePanel === 'initialize' && (
              <InitializePanel
                defaultProjectName={status.defaultProjectName}
                onInitialize={(request) => void initialize(request)}
              />
            )}
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
              {stats.execution.titleWithHash}
            </button>
            <span className="score">{formatNumber(stats.totalScore)}</span>
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
              Source
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
    return <EmptyPanel text="Seed がありません" />;
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
              Seed {seed.seed}
            </button>
            <span className="score">{formatNumber(seed.bestScore)}</span>
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
                    {execution.execution.titleWithHash}
                  </button>
                  <span>{formatNumber(execution.testCase.score)}</span>
                  <span>{formatNumber(execution.relativeScore)}%</span>
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
      <span>cases {props.stats.caseCount}</span>
      <span>AC {props.stats.acCount}</span>
      <span>avg {formatNumber(props.stats.averageScore)}</span>
      <span>relative {formatNumber(props.stats.averageRelativeScore)}%</span>
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
      <span>Seed {props.testCase.seed}</span>
      <span>{formatNumber(props.testCase.score)}</span>
      <span>{formatNumber(props.relativeScore)}%</span>
      <span>{formatNumber(props.testCase.executionTime)}s</span>
    </button>
  );
}

function ComparisonPanel(props: { data: ComparisonData | null; selectedCount: number }) {
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

  const options: ComparisonViewOptions = {
    featureString,
    xAxis,
    yAxis,
    chartType,
    filter,
    skipFailed,
  };
  const readModel = props.data ? service.build(props.data, options) : null;

  if (!props.data) {
    return <EmptyPanel text={`比較対象: ${props.selectedCount} 件`} />;
  }

  return (
    <div className="panelContent">
      <div className="formGrid comparisonControls">
        <label>
          feature
          <input value={featureString} onChange={(event) => setFeatureString(event.target.value)} />
        </label>
        <label>
          x
          <input value={xAxis} onChange={(event) => setXAxis(event.target.value)} />
        </label>
        <label>
          y
          <input value={yAxis} onChange={(event) => setYAxis(event.target.value)} />
        </label>
        <label>
          chart
          <select
            value={chartType}
            onChange={(event) => setChartType(event.target.value as 'line' | 'scatter')}
          >
            <option value="line">line</option>
            <option value="scatter">scatter</option>
          </select>
        </label>
        <label>
          filter
          <input value={filter} onChange={(event) => setFilter(event.target.value)} />
        </label>
        <label className="checkLabel">
          <input
            type="checkbox"
            checked={skipFailed}
            onChange={(event) => setSkipFailed(event.target.checked)}
          />
          failed を除外
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
                      title={`seed ${point.seed}: ${formatNumber(point.y)}`}
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
                <th>Total</th>
                <th>Mean</th>
                <th>SD</th>
                <th>Best</th>
                <th>Fail</th>
              </tr>
            </thead>
            <tbody>
              {readModel.stats.map((row) => (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>{formatNumber(row.totalScore)}</td>
                  <td>{formatNumber(row.mean)}</td>
                  <td>{formatNumber(row.sd)}</td>
                  <td>{row.bestCount}</td>
                  <td>{row.failCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <h2>Seed {props.selectedCase.seed}</h2>
        <div className="commands">
          <button type="button" onClick={() => props.onOpenFile('input')}>
            Input
          </button>
          <button type="button" onClick={() => props.onOpenFile('output')}>
            Output
          </button>
          <button type="button" onClick={() => props.onOpenFile('error')}>
            Error
          </button>
          <button type="button" onClick={props.onVisualizer}>
            Visualizer
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
    return <EmptyPanel text={`差分を表示できません: ${props.diff.status}`} />;
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
        <h2>Source</h2>
        <button type="button" onClick={props.onPrepare}>
          Load files
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
        <EmptyPanel text={`ソースを取得できません: ${props.preparation.status}`} />
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
      <h2>Run options</h2>
      <div className="formGrid">
        <label>
          start seed
          <input value={startSeed} onChange={(event) => setStartSeed(event.target.value)} />
        </label>
        <label>
          end seed
          <input value={endSeed} onChange={(event) => setEndSeed(event.target.value)} />
        </label>
        <label className="checkLabel">
          <input
            type="checkbox"
            checked={freezeBestScores}
            onChange={(event) => setFreezeBestScores(event.target.checked)}
          />
          freeze best scores
        </label>
        <label className="checkLabel">
          <input
            type="checkbox"
            checked={enableGitIntegration}
            onChange={(event) => setEnableGitIntegration(event.target.checked)}
          />
          git integration
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
        Run
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
      <h2>Initialize</h2>
      <div className="formGrid">
        <label>
          problem
          <input value={problemName} onChange={(event) => setProblemName(event.target.value)} />
        </label>
        <label>
          objective
          <select
            value={objective}
            onChange={(event) => setObjective(event.target.value as 'max' | 'min')}
          >
            <option value="max">max</option>
            <option value="min">min</option>
          </select>
        </label>
        <label>
          language
          <select
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value as 'rust' | 'cpp' | 'python' | 'go')
            }
          >
            <option value="rust">rust</option>
            <option value="cpp">cpp</option>
            <option value="python">python</option>
            <option value="go">go</option>
          </select>
        </label>
        <label>
          tester URL
          <input value={testerUrl} onChange={(event) => setTesterUrl(event.target.value)} />
        </label>
        <label className="checkLabel">
          <input
            type="checkbox"
            checked={isInteractive}
            onChange={(event) => setIsInteractive(event.target.checked)}
          />
          interactive
        </label>
        <label className="checkLabel">
          <input
            type="checkbox"
            checked={useDetectedInteractive}
            onChange={(event) => setUseDetectedInteractive(event.target.checked)}
          />
          detected tester type を優先
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
        Initialize
      </button>
    </div>
  );
}

function FileBlock(props: { file: FileView }) {
  return (
    <section className="fileBlock">
      <h3>{props.file.title}</h3>
      {props.file.path && <p>{props.file.path}</p>}
      <pre>{props.file.content || '(empty)'}</pre>
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
      return 'Visualizer';
    case 'run':
      return 'Run';
    case 'initialize':
      return 'Init';
  }
}

function numberFromText(value: string): number | undefined {
  const parsed = Number(value);
  return value.trim() && Number.isFinite(parsed) ? parsed : undefined;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const styles = `
* { box-sizing: border-box; }
html, body, #root { min-height: 100%; }
body { margin: 0; background: #f4f6f4; color: #1e2521; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button, input, select { font: inherit; letter-spacing: 0; }
button { min-height: 28px; border: 1px solid #9aa39d; border-radius: 4px; background: #ffffff; color: #1e2521; padding: 4px 10px; cursor: pointer; }
button:hover { background: #edf1ee; }
button:disabled { color: #9aa39d; cursor: not-allowed; }
input, select { min-height: 28px; border: 1px solid #a8b1ab; border-radius: 4px; background: #ffffff; color: #1e2521; padding: 4px 8px; width: 100%; }
main { min-height: 100vh; display: flex; flex-direction: column; }
.commandBar { min-height: 42px; border-bottom: 1px solid #cfd6d1; background: #ffffff; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 6px 12px; }
.brand { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.brand span { color: #65706a; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.commands { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.commands button:first-child { border-color: #2f7d57; background: #2f7d57; color: #ffffff; }
.commands button:first-child:hover { background: #266748; }
.notice { margin: 8px 12px 0; border-left: 4px solid #2f7d57; background: #ffffff; padding: 8px 10px; color: #2b4034; }
.notice.error { border-left-color: #c94b3c; color: #92291f; }
.welcome { width: min(720px, calc(100% - 24px)); margin: 32px auto; background: #ffffff; border: 1px solid #cfd6d1; border-radius: 8px; padding: 20px; }
.welcome h1 { margin: 0 0 8px; font-size: 24px; }
.welcome p { margin: 0 0 16px; color: #65706a; }
.workbench { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(300px, 420px) minmax(0, 1fr); }
.sideBar { border-right: 1px solid #cfd6d1; background: #fbfcfb; min-height: 0; display: flex; flex-direction: column; }
.treeToolbar { display: grid; grid-template-columns: auto auto minmax(0, 1fr); gap: 6px; padding: 8px; border-bottom: 1px solid #dce2de; }
.treeToolbar button.active, .panelTabs button.active { border-color: #2f7d57; background: #e8f3ed; color: #20543b; }
.tree { overflow: auto; padding: 6px; }
.treeGroup { border-bottom: 1px solid #e0e5e1; padding: 4px 0; }
.treeRow { min-height: 30px; width: 100%; display: grid; grid-template-columns: 22px min-content minmax(0, 1fr) auto; align-items: center; gap: 6px; text-align: left; border: 0; background: transparent; padding: 3px 4px; border-radius: 4px; }
.treeRow:hover { background: #edf1ee; }
.caseRow { grid-template-columns: minmax(84px, 1fr) 82px 64px 64px; }
.caseRow.failed { color: #9b3027; }
.executionRow .score { color: #2f7d57; font-weight: 700; }
.disclosure { min-height: 22px; width: 22px; padding: 0; border: 0; background: transparent; color: #65706a; }
.treeLabel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left; border: 0; background: transparent; padding: 0; }
.commentLine { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; padding: 0 4px 4px 54px; }
.children { margin-left: 22px; border-left: 1px solid #dce2de; padding-left: 8px; }
.summaryRow { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 6px 4px; color: #4e5a54; font-size: 12px; }
.mainPanel { min-width: 0; min-height: 0; display: flex; flex-direction: column; background: #ffffff; }
.panelTabs { min-height: 38px; display: flex; gap: 4px; align-items: center; border-bottom: 1px solid #cfd6d1; padding: 5px 8px; overflow: auto; }
.panelContent { min-height: 0; overflow: auto; padding: 14px; }
.panelContent.narrow { max-width: 720px; }
.panelHeader { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
h2, h3 { margin: 0; }
.formGrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.comparisonControls { grid-template-columns: repeat(3, minmax(0, 1fr)); }
label { display: grid; gap: 4px; color: #46504a; font-size: 12px; }
.checkLabel { display: flex; align-items: center; gap: 8px; min-height: 28px; }
.checkLabel input { width: auto; }
.chartArea { display: grid; gap: 10px; margin: 14px 0; }
.dataset { display: grid; grid-template-columns: minmax(140px, 220px) minmax(0, 1fr); gap: 12px; align-items: center; }
.spark { height: 90px; border: 1px solid #dce2de; display: flex; align-items: end; gap: 2px; padding: 4px; overflow: hidden; }
.spark i { width: 5px; min-width: 5px; background: #2f7d57; display: block; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; border-bottom: 1px solid #e0e5e1; padding: 8px; font-size: 13px; }
th { color: #4e5a54; }
.fileList { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
.fileBlock { border: 1px solid #d4dbd7; border-radius: 6px; margin-bottom: 12px; overflow: hidden; }
.fileBlock h3 { padding: 8px 10px; background: #f4f6f4; border-bottom: 1px solid #d4dbd7; font-size: 14px; }
.fileBlock p { margin: 0; padding: 6px 10px; color: #65706a; border-bottom: 1px solid #e0e5e1; font-size: 12px; overflow-wrap: anywhere; }
pre { margin: 0; padding: 10px; overflow: auto; background: #fbfcfb; color: #17201b; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.5; }
.empty { padding: 24px; color: #65706a; }
.visualizer { width: 100%; height: calc(100vh - 92px); border: 0; background: #ffffff; }
@media (max-width: 820px) {
  .commandBar { align-items: flex-start; flex-direction: column; }
  .workbench { grid-template-columns: 1fr; }
  .sideBar { border-right: 0; border-bottom: 1px solid #cfd6d1; max-height: 48vh; }
  .formGrid, .comparisonControls { grid-template-columns: 1fr; }
  .dataset { grid-template-columns: 1fr; }
}
`;

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
