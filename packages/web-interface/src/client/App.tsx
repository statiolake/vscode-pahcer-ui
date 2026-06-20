import type { ComparisonData } from '@pahcer/core/application/dtos/comparisonData';
import type {
  TreeExecutionCases,
  TreeExecutionStats,
  TreeSeedExecution,
  TreeSeedStats,
} from '@pahcer/core/application/dtos/pahcerTreeData';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchJson } from './api';
import { EmptyState } from './components/common/EmptyState';
import {
  ToastContainer,
  type ToastItem,
  type ToastVariant,
} from './components/common/ToastContainer';
import { SideBar } from './components/Layout/SideBar';
import { TopBar } from './components/Layout/TopBar';
import { CasePanel } from './components/Panels/CasePanel';
import { ComparisonPanel } from './components/Panels/ComparisonPanel';
import { DiffPanel } from './components/Panels/DiffPanel';
import { InitializationPanel } from './components/Panels/InitializationPanel';
import { RunOptionsPanel } from './components/Panels/RunOptionsPanel';
import { SourcePanel } from './components/Panels/SourcePanel';
import { VisualizerPanel } from './components/Panels/Visualizer/VisualizerPanel';
import { VisualizerUrlModal } from './components/Panels/Visualizer/VisualizerUrlModal';
import { ExecutionTree } from './components/Tree/ExecutionTree';
import { SeedTree } from './components/Tree/SeedTree';
import { NotInitializedWelcome } from './components/Welcome/NotInitializedWelcome';
import { NotInstalledWelcome } from './components/Welcome/NotInstalledWelcome';
import { globalStyles } from './styles/global';
import type {
  CaseFileKind,
  DiffView,
  FileView,
  InitializeRequest,
  Panel,
  RunOptions,
  SelectedCase,
  SourcePreparation,
  StatusResponse,
  TreeData,
  WebPreferences,
} from './types';
import { toErrorMessage } from './utils/format';
import { caseFileKindLabel, panelLabel } from './utils/labels';

type VisualizerRequest = {
  seed: number;
  executionId: string;
};

export function App() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [preferences, setPreferences] = useState<WebPreferences | null>(null);
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [seeds, setSeeds] = useState<TreeSeedStats[]>([]);
  const [selectedExecutionIds, setSelectedExecutionIds] = useState<string[]>([]);
  const [openExecutionId, setOpenExecutionId] = useState<string | null>(null);
  const [executionCases, setExecutionCases] = useState<TreeExecutionCases | null>(null);
  const [openSeed, setOpenSeed] = useState<number | null>(null);
  const [seedExecutions, setSeedExecutions] = useState<TreeSeedExecution[]>([]);
  const [selectedCase, setSelectedCase] = useState<SelectedCase | null>(null);
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [fileView, setFileView] = useState<FileView | null>(null);
  const [diffView, setDiffView] = useState<DiffView | null>(null);
  const [sourcePreparation, setSourcePreparation] = useState<SourcePreparation | null>(null);
  const [sourceView, setSourceView] = useState<FileView | null>(null);
  const [visualizerSrc, setVisualizerSrc] = useState<string | null>(null);
  const [visualizerRequest, setVisualizerRequest] = useState<VisualizerRequest | null>(null);
  const [visualizerModalOpen, setVisualizerModalOpen] = useState(false);
  const [visualizerDownloading, setVisualizerDownloading] = useState(false);
  const [pendingVisualizerRequest, setPendingVisualizerRequest] =
    useState<VisualizerRequest | null>(null);
  const [activePanel, setActivePanel] = useState<Panel>('comparison');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toastIdRef = useRef(0);

  const mode = preferences?.groupingMode ?? 'byExecution';

  const dismissToast = useCallback((id: number) => {
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, closing: true } : toast)),
    );
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 160);
  }, []);

  const showToast = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = toastIdRef.current + 1;
      toastIdRef.current = id;

      setToasts((current) => [...current, { id, variant, message, closing: false }]);
      if (variant !== 'error') {
        window.setTimeout(() => dismissToast(id), 5000);
      }
    },
    [dismissToast],
  );

  const reportError = useCallback(
    (caught: unknown) => {
      const message = toErrorMessage(caught);
      setError(message);
      showToast('error', message);
    },
    [showToast],
  );

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
      reportError(caught);
    } finally {
      setLoading(false);
    }
  }, [reportError]);

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
      .catch(reportError);
  }, [reportError, selectedExecutionIds, treeData]);

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
          `/api/executions/${encodeURIComponent(executionId)}/cases?sort=${
            preferences?.executionSortOrder ?? 'seedAsc'
          }`,
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

  async function runPahcer(options: RunOptions) {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<{ messages: string[] }>('/api/run', {
        method: 'POST',
        body: JSON.stringify(options),
      });
      for (const message of result.messages) {
        showToast('info', message);
      }
      await reload();
    } catch (caught) {
      reportError(caught);
    } finally {
      setLoading(false);
    }
  }

  async function initialize(request: InitializeRequest) {
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
      reportError(caught);
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
    setFileView({
      ...file,
      title: caseFileKindLabel(kind),
      kind,
      executionId,
      seed,
    });
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
    setSourcePreparation({ ...preparation, executionId });
    setSourceView(null);
    setActivePanel('source');
  }

  async function loadSourceFile(executionId: string, file: string) {
    const source = await fetchJson<FileView>(
      `/api/source/${encodeURIComponent(executionId)}/content?file=${encodeURIComponent(file)}`,
    );
    setSourceView({ ...source, title: file, executionId });
  }

  function showVisualizerFrame(request: VisualizerRequest, htmlFileName: string) {
    const query = new URLSearchParams({
      seed: String(request.seed),
      executionId: request.executionId,
      htmlFileName,
    });
    setVisualizerRequest(request);
    setVisualizerSrc(`/api/visualizer/frame?${query}`);
    setActivePanel('visualizer');
  }

  async function openVisualizer(seed: number, executionId: string) {
    const request = { seed, executionId };
    setError(null);
    setPendingVisualizerRequest(request);

    try {
      const { htmlFileName } = await fetchJson<{ htmlFileName?: string }>('/api/visualizer/status');
      if (!htmlFileName) {
        setVisualizerModalOpen(true);
        return;
      }

      showVisualizerFrame(request, htmlFileName);
      setPendingVisualizerRequest(null);
    } catch (caught) {
      setPendingVisualizerRequest(null);
      reportError(caught);
    }
  }

  async function downloadVisualizer(url: string) {
    const request = pendingVisualizerRequest ?? visualizerRequest ?? selectedCase;
    if (!request) {
      throw new Error('表示するケースを選択してください');
    }

    setVisualizerDownloading(true);
    try {
      const { htmlFileName } = await fetchJson<{ htmlFileName: string }>(
        '/api/visualizer/download',
        {
          method: 'POST',
          body: JSON.stringify({ url }),
        },
      );
      showVisualizerFrame(request, htmlFileName);
      setPendingVisualizerRequest(null);
      setVisualizerModalOpen(false);
    } finally {
      setVisualizerDownloading(false);
    }
  }

  function closeVisualizerModal() {
    if (visualizerDownloading) {
      return;
    }
    setVisualizerModalOpen(false);
    setPendingVisualizerRequest(null);
  }

  function resetVisualizer() {
    const request = visualizerRequest ?? selectedCase ?? pendingVisualizerRequest;
    if (!request) {
      reportError('ケースを選択してビジュアライザを開いてください');
      return;
    }

    setPendingVisualizerRequest(request);
    setVisualizerModalOpen(true);
  }

  const selectedExecution = treeData?.executionStatsList.find(
    (stats) => stats.execution.id === selectedExecutionIds[selectedExecutionIds.length - 1],
  )?.execution;
  const visualizerExecutionTitle = visualizerRequest
    ? findExecutionShortTitle(treeData, visualizerRequest.executionId)
    : undefined;
  const visualizerTitle = visualizerRequest
    ? {
        seed: visualizerRequest.seed,
        ...(visualizerExecutionTitle ? { execution: visualizerExecutionTitle } : {}),
      }
    : undefined;

  return (
    <main data-last-error={error ? 'present' : undefined}>
      <style>{globalStyles}</style>
      <TopBar status={status?.status} workspaceRoot={status?.workspaceRoot ?? ''} />

      {loading && <div className="globalLoading" role="progressbar" aria-label="処理中" />}
      <ToastContainer toasts={toasts} onClose={dismissToast} />
      <VisualizerUrlModal
        open={visualizerModalOpen}
        onClose={closeVisualizerModal}
        onSubmit={(url) => downloadVisualizer(url)}
        downloading={visualizerDownloading}
      />

      {status?.status === 'notInstalled' && (
        <NotInstalledWelcome workspaceRoot={status.workspaceRoot} />
      )}

      {status?.status === 'notInitialized' && activePanel !== 'initialize' && (
        <NotInitializedWelcome
          workspaceRoot={status.workspaceRoot}
          onStartInitialization={() => setActivePanel('initialize')}
        />
      )}

      {status?.status === 'notInitialized' && activePanel === 'initialize' && (
        <section className="initializationShell">
          <section className="mainPanel initializationMainPanel">
            <InitializationPanel
              defaultProjectName={status.defaultProjectName}
              onInitialize={(request) => void initialize(request)}
            />
          </section>
        </section>
      )}

      {status?.status === 'ready' && treeData && preferences && (
        <section className="workbench">
          <SideBar
            mode={mode}
            preferences={preferences}
            selectedCount={selectedExecutionIds.length}
            onRun={() => void runPahcer({ freezeBestScores: false })}
            onOpenRunOptions={() => setActivePanel('run')}
            onReload={() => void reload()}
            onUpdatePreferences={(next) => void updatePreferences(next)}
          >
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
          </SideBar>

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
                onShowVisualizer={(resultId, seed) => void openVisualizer(seed, resultId)}
              />
            )}

            {activePanel === 'case' && selectedCase && (
              <CasePanel
                key={`${selectedCase.executionId}:${selectedCase.seed}`}
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
              <EmptyState text="ケースを選択してください" />
            )}

            {activePanel === 'diff' && (
              <DiffPanel diff={diffView} selectedCount={selectedExecutionIds.length} />
            )}

            {activePanel === 'source' && selectedExecution && (
              <SourcePanel
                preparation={sourcePreparation}
                sourceView={sourceView}
                executionId={selectedExecution.id}
                executionLabel={
                  selectedExecution.shortTitle ?? shortExecutionId(selectedExecution.id)
                }
                onPrepare={() => void prepareSource(selectedExecution.id)}
                onLoadFile={(file) => void loadSourceFile(selectedExecution.id, file)}
              />
            )}
            {activePanel === 'source' && !selectedExecution && (
              <EmptyState text="実行を選択してください" />
            )}

            {activePanel === 'visualizer' && (
              <VisualizerPanel
                src={visualizerSrc}
                title={visualizerTitle}
                onResetVisualizer={resetVisualizer}
              />
            )}

            {activePanel === 'run' && (
              <RunOptionsPanel
                onRun={(options) => void runPahcer(options)}
                onCancel={() => setActivePanel('comparison')}
              />
            )}
          </section>
        </section>
      )}
    </main>
  );
}

function visiblePanels(input: {
  activePanel: Panel;
  selectedCase: SelectedCase | null;
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

function findExecutionShortTitle(
  treeData: TreeData | null,
  executionId: string,
): string | undefined {
  return treeData?.executions.find((execution) => execution.id === executionId)?.shortTitle;
}

function shortExecutionId(executionId: string): string {
  return executionId.length > 8 ? executionId.slice(0, 8) : executionId;
}
