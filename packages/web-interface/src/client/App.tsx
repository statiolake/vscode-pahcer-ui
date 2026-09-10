import type { ComparisonData } from '@pahcer/core/application/dtos/comparisonData';
import type {
  TreeExecutionCases,
  TreeSeedExecution,
  TreeSeedStats,
} from '@pahcer/core/application/dtos/pahcerTreeData';
import {
  buildPahcerUIPath,
  type PahcerUIRoute,
  parsePahcerUIPath,
} from '@pahcer/core/application/dtos/pahcerUIRoute';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchJson } from './api';
import { Button } from './components/common/Button';
import { EmptyState } from './components/common/EmptyState';
import { Modal } from './components/common/Modal';
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
import { formatSeed, toErrorMessage } from './utils/format';
import { caseFileKindLabel, panelLabel } from './utils/labels';

type VisualizerRequest = {
  seed: number;
  executionId: string;
};

type UiActionOptions = {
  shouldReportError?: () => boolean;
  onError?: (message: string) => void;
  rethrow?: boolean;
};

type RequestState<T> = T & {
  requestId: number;
};

type LoadError<T> = T & {
  message: string;
};

type CaseFileTarget = {
  kind: CaseFileKind;
  executionId: string;
  seed: number;
};

type DiffTarget = {
  executionIds: string[];
};

type SourcePreparationTarget = {
  executionId: string;
};

type SourceFileTarget = {
  executionId: string;
  file: string;
};

const ALL_PANELS: Panel[] = ['comparison', 'case', 'source', 'diff', 'visualizer'];

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
  const [selectedCaseFileKind, setSelectedCaseFileKind] = useState<CaseFileKind>('input');
  const [comparison, setComparison] = useState<ComparisonData | null>(null);
  const [fileView, setFileView] = useState<FileView | null>(null);
  const [caseFilePending, setCaseFilePending] = useState<RequestState<CaseFileTarget> | null>(null);
  const [caseFileError, setCaseFileError] = useState<LoadError<CaseFileTarget> | null>(null);
  const [diffView, setDiffView] = useState<DiffView | null>(null);
  const [diffPending, setDiffPending] = useState<RequestState<DiffTarget> | null>(null);
  const [diffError, setDiffError] = useState<LoadError<DiffTarget> | null>(null);
  const [sourcePreparation, setSourcePreparation] = useState<SourcePreparation | null>(null);
  const [sourcePreparationPending, setSourcePreparationPending] =
    useState<RequestState<SourcePreparationTarget> | null>(null);
  const [sourcePreparationError, setSourcePreparationError] =
    useState<LoadError<SourcePreparationTarget> | null>(null);
  const [sourceView, setSourceView] = useState<FileView | null>(null);
  const [selectedSourceFile, setSelectedSourceFile] = useState<SourceFileTarget | null>(null);
  const [sourceFilePending, setSourceFilePending] = useState<RequestState<SourceFileTarget> | null>(
    null,
  );
  const [sourceFileError, setSourceFileError] = useState<LoadError<SourceFileTarget> | null>(null);
  const [visualizerSrc, setVisualizerSrc] = useState<string | null>(null);
  const [visualizerRequest, setVisualizerRequest] = useState<VisualizerRequest | null>(null);
  const [visualizerPending, setVisualizerPending] =
    useState<RequestState<VisualizerRequest> | null>(null);
  const [visualizerError, setVisualizerError] = useState<string | null>(null);
  const [visualizerModalOpen, setVisualizerModalOpen] = useState(false);
  const [visualizerDownloading, setVisualizerDownloading] = useState(false);
  const [pendingVisualizerRequest, setPendingVisualizerRequest] =
    useState<VisualizerRequest | null>(null);
  const [runOptionsModalOpen, setRunOptionsModalOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<Panel>('comparison');
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const toastIdRef = useRef(0);
  const comparisonRequestIdRef = useRef(0);
  const selectedExecutionIdsRef = useRef<string[]>(selectedExecutionIds);
  const openExecutionIdRef = useRef<string | null>(openExecutionId);
  const openSeedRef = useRef<number | null>(openSeed);
  const executionCasesRequestIdRef = useRef(0);
  const seedExecutionsRequestIdRef = useRef(0);
  const executionCasesAbortControllerRef = useRef<AbortController | null>(null);
  const seedExecutionsAbortControllerRef = useRef<AbortController | null>(null);
  const uiActionRequestIdRef = useRef(0);
  const caseFileRequestIdRef = useRef(0);
  const diffRequestIdRef = useRef(0);
  const sourcePreparationRequestIdRef = useRef(0);
  const sourceFileRequestIdRef = useRef(0);
  const lastSourceFileByExecutionIdRef = useRef(new Map<string, string>());
  const visualizerRequestIdRef = useRef(0);
  const visualizerFrameRef = useRef<HTMLIFrameElement>(null);
  const visualizerHtmlFileNameRef = useRef<string | null>(null);
  const deepLinkAppliedRef = useRef(false);

  const mode = preferences?.groupingMode ?? 'byExecution';

  useEffect(() => {
    selectedExecutionIdsRef.current = selectedExecutionIds;
  }, [selectedExecutionIds]);

  useEffect(() => {
    openExecutionIdRef.current = openExecutionId;
  }, [openExecutionId]);

  useEffect(() => {
    openSeedRef.current = openSeed;
  }, [openSeed]);

  useEffect(() => {
    return () => {
      executionCasesAbortControllerRef.current?.abort();
      seedExecutionsAbortControllerRef.current?.abort();
    };
  }, []);

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

      setToasts((current) =>
        // エラートーストは利用者が閉じるまで残るため、同じ内容が繰り返し報告されても
        // 積み上がらないようにする（3秒ごとの自動更新の失敗などで発生する）
        variant === 'error' &&
        current.some(
          (toast) => !toast.closing && toast.variant === 'error' && toast.message === message,
        )
          ? current
          : [...current, { id, variant, message, closing: false }],
      );
      if (variant !== 'error') {
        window.setTimeout(() => dismissToast(id), 5000);
      }
    },
    [dismissToast],
  );

  const reportError = useCallback(
    (caught: unknown, label?: string) => {
      const detail = toErrorMessage(caught);
      const message = label ? `${label}: ${detail}` : detail;
      setError(message);
      showToast('error', message);
      return message;
    },
    [showToast],
  );

  const runUiAction = useCallback(
    async <T,>(
      label: string,
      fn: () => Promise<T>,
      options: UiActionOptions = {},
    ): Promise<T | null> => {
      setError(null);
      try {
        return await fn();
      } catch (caught) {
        const shouldReport = options.shouldReportError?.() ?? true;
        if (shouldReport) {
          const message = reportError(caught, label);
          options.onError?.(message);
        }
        if (options.rethrow) {
          throw caught;
        }
        return null;
      }
    },
    [reportError],
  );

  const nextUiActionRequestId = useCallback(() => {
    const requestId = uiActionRequestIdRef.current + 1;
    uiActionRequestIdRef.current = requestId;
    return requestId;
  }, []);

  function invalidateExecutionCasesRequest() {
    const requestId = executionCasesRequestIdRef.current + 1;
    executionCasesRequestIdRef.current = requestId;
    executionCasesAbortControllerRef.current?.abort();
    executionCasesAbortControllerRef.current = null;
    return requestId;
  }

  function invalidateSeedExecutionsRequest() {
    const requestId = seedExecutionsRequestIdRef.current + 1;
    seedExecutionsRequestIdRef.current = requestId;
    seedExecutionsAbortControllerRef.current?.abort();
    seedExecutionsAbortControllerRef.current = null;
    return requestId;
  }

  const reload = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setLoading(true);
        // 表示中のエラーを消すのは利用者の操作によるリロードのときだけ。
        // 3秒ごとの自動更新がエラー表示を消してしまわないようにする
        setError(null);
      }
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
        // 自動更新の失敗も握りつぶさずに報告する（同一メッセージのトーストは
        // showToast 側で重複排除される）
        reportError(caught);
      } finally {
        if (!options.silent) {
          setLoading(false);
        }
      }
    },
    [reportError],
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void reload({ silent: true });
      }
    }, 3000);
    return () => window.clearInterval(interval);
  }, [reload]);

  useEffect(() => {
    const requestId = comparisonRequestIdRef.current + 1;
    comparisonRequestIdRef.current = requestId;

    if (!treeData || selectedExecutionIds.length === 0) {
      setComparison(null);
      return;
    }

    const controller = new AbortController();
    const executionIds = selectedExecutionIds.map(encodeURIComponent).join(',');

    void fetchJson<ComparisonData>(`/api/comparison?executionIds=${executionIds}`, {
      signal: controller.signal,
    })
      .then((nextComparison) => {
        if (comparisonRequestIdRef.current === requestId && !controller.signal.aborted) {
          setComparison(nextComparison);
        }
      })
      .catch((caught) => {
        if (comparisonRequestIdRef.current === requestId && !controller.signal.aborted) {
          reportError(caught);
        }
      });

    return () => controller.abort();
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
    const nextOpenExecutionId = openExecutionIdRef.current === executionId ? null : executionId;
    const requestId = invalidateExecutionCasesRequest();
    invalidateSeedExecutionsRequest();

    openExecutionIdRef.current = nextOpenExecutionId;
    openSeedRef.current = null;
    setOpenExecutionId(nextOpenExecutionId);
    setOpenSeed(null);
    setSelectedCase(null);
    setExecutionCases(null);
    setSeedExecutions([]);

    if (nextOpenExecutionId === null) {
      return;
    }

    const controller = new AbortController();
    executionCasesAbortControllerRef.current = controller;

    const isCurrentRequest = () =>
      executionCasesRequestIdRef.current === requestId &&
      openExecutionIdRef.current === executionId &&
      !controller.signal.aborted;

    try {
      const cases = await runUiAction(
        'ケース一覧の読み込み',
        () =>
          fetchJson<TreeExecutionCases>(
            `/api/executions/${encodeURIComponent(executionId)}/cases?sort=${
              preferences?.executionSortOrder ?? 'seedAsc'
            }`,
            { signal: controller.signal },
          ),
        { shouldReportError: isCurrentRequest },
      );

      if (!isCurrentRequest() || !cases || cases.executionStats.execution.id !== executionId) {
        return;
      }

      setExecutionCases(cases);
    } finally {
      if (executionCasesAbortControllerRef.current === controller) {
        executionCasesAbortControllerRef.current = null;
      }
    }
  }

  async function openSeedExecutions(seed: number) {
    const nextOpenSeed = openSeedRef.current === seed ? null : seed;
    const requestId = invalidateSeedExecutionsRequest();
    invalidateExecutionCasesRequest();

    openSeedRef.current = nextOpenSeed;
    openExecutionIdRef.current = null;
    setOpenSeed(nextOpenSeed);
    setOpenExecutionId(null);
    setSelectedCase(null);
    setSeedExecutions([]);
    setExecutionCases(null);

    if (nextOpenSeed === null) {
      return;
    }

    const controller = new AbortController();
    seedExecutionsAbortControllerRef.current = controller;

    const isCurrentRequest = () =>
      seedExecutionsRequestIdRef.current === requestId &&
      openSeedRef.current === seed &&
      !controller.signal.aborted;

    try {
      const executions = await runUiAction(
        'Seed 実行一覧の読み込み',
        () =>
          fetchJson<TreeSeedExecution[]>(
            `/api/seeds/${seed}/executions?sort=${preferences?.seedSortOrder ?? 'executionAsc'}`,
            { signal: controller.signal },
          ),
        { shouldReportError: isCurrentRequest },
      );

      if (
        !isCurrentRequest() ||
        !executions?.every((execution) => execution.testCase.seed === seed)
      ) {
        return;
      }

      setSeedExecutions(executions);
    } finally {
      if (seedExecutionsAbortControllerRef.current === controller) {
        seedExecutionsAbortControllerRef.current = null;
      }
    }
  }

  function toggleSelectedExecution(executionId: string) {
    setActivePanel('comparison');
    setSelectedExecutionIds((current) => {
      return current.includes(executionId)
        ? current.filter((id) => id !== executionId)
        : [...current, executionId];
    });
  }

  function showResultsNotFoundError(seed: number) {
    showToast(
      'error',
      `Seed ${formatSeed(seed)} の結果が見つからないため、ビジュアライザを開けません。`,
    );
  }

  async function runPahcer(options: RunOptions) {
    setLoading(true);
    setError(null);
    try {
      let runOptions = options;
      if (options.enableGitIntegration === undefined && preferences?.gitIntegration === null) {
        const enableGitIntegration = window.confirm(
          'Pahcer UIでGit統合を有効にしますか？\n\n有効にすると、テスト実行前にワークスペースの変更を自動的にコミットし、実行結果の差分を確認できます。',
        );
        await updatePreferences({ gitIntegration: enableGitIntegration });
        runOptions = { ...options, enableGitIntegration };
      }
      const result = await fetchJson<{ messages: string[] }>('/api/run', {
        method: 'POST',
        body: JSON.stringify(runOptions),
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
    const requestId = nextUiActionRequestId();
    caseFileRequestIdRef.current = requestId;
    setCaseFilePending({ requestId, kind, executionId, seed });
    setCaseFileError(null);
    setActivePanel('case');

    const query = new URLSearchParams({ kind, executionId, seed: String(seed) });
    try {
      const file = await runUiAction(
        'ケースファイルの読み込み',
        () => fetchJson<FileView>(`/api/case-file?${query}`),
        {
          shouldReportError: () => caseFileRequestIdRef.current === requestId,
          onError: (message) => setCaseFileError({ kind, executionId, seed, message }),
        },
      );
      if (caseFileRequestIdRef.current !== requestId || !file) {
        return;
      }
      setCaseFileError(null);
      setFileView({
        ...file,
        title: caseFileKindLabel(kind),
        kind,
        executionId,
        seed,
      });
    } finally {
      if (caseFileRequestIdRef.current === requestId) {
        setCaseFilePending(null);
      }
    }
  }

  const loadDiffForCurrentSelection = useCallback(
    async (requestedExecutionIds: string[] = selectedExecutionIds) => {
      const executionIds = requestedExecutionIds.slice();
      if (executionIds.length !== 2) {
        return;
      }

      const requestId = nextUiActionRequestId();
      diffRequestIdRef.current = requestId;
      setDiffPending({ requestId, executionIds });
      setDiffError(null);

      const isCurrentRequest = () =>
        diffRequestIdRef.current === requestId &&
        sameExecutionIds(selectedExecutionIdsRef.current, executionIds);

      try {
        const diff = await runUiAction(
          '差分の読み込み',
          () =>
            fetchJson<DiffView>(
              `/api/diff?executionIds=${executionIds.map(encodeURIComponent).join(',')}`,
            ),
          {
            shouldReportError: isCurrentRequest,
            onError: (message) => setDiffError({ executionIds, message }),
          },
        );
        if (!isCurrentRequest() || !diff) {
          return;
        }
        setDiffError(null);
        setDiffView({ ...diff, executionIds });
      } finally {
        if (diffRequestIdRef.current === requestId) {
          setDiffPending(null);
        }
      }
    },
    [nextUiActionRequestId, runUiAction, selectedExecutionIds],
  );

  async function prepareSource(executionId: string) {
    const requestId = nextUiActionRequestId();
    sourcePreparationRequestIdRef.current = requestId;
    setSourcePreparationPending({ requestId, executionId });
    setSourcePreparationError(null);

    try {
      const preparation = await runUiAction(
        'ソースファイルの準備',
        () =>
          fetchJson<SourcePreparation>(`/api/source/${encodeURIComponent(executionId)}/prepare`),
        {
          shouldReportError: () => sourcePreparationRequestIdRef.current === requestId,
          onError: (message) => setSourcePreparationError({ executionId, message }),
        },
      );
      if (sourcePreparationRequestIdRef.current !== requestId || !preparation) {
        return;
      }
      const preparedSource = { ...preparation, executionId };
      setSourcePreparationError(null);
      setSourcePreparation(preparedSource);
      setSourceView(null);
      setSourceFileError(null);
      if (preparedSource.status !== 'ready') {
        setSelectedSourceFile((current) => (current?.executionId === executionId ? null : current));
        return;
      }

      const initialFile = selectPreparedSourceFile(
        preparedSource.files,
        lastSourceFileByExecutionIdRef.current.get(executionId),
      );
      if (initialFile) {
        void loadSourceFile(executionId, initialFile);
      } else {
        setSelectedSourceFile((current) => (current?.executionId === executionId ? null : current));
      }
    } finally {
      if (sourcePreparationRequestIdRef.current === requestId) {
        setSourcePreparationPending(null);
      }
    }
  }

  async function loadSourceFile(executionId: string, file: string) {
    const requestId = nextUiActionRequestId();
    lastSourceFileByExecutionIdRef.current.set(executionId, file);
    sourceFileRequestIdRef.current = requestId;
    setSelectedSourceFile({ executionId, file });
    setSourceFilePending({ requestId, executionId, file });
    setSourceFileError(null);

    try {
      const source = await runUiAction(
        'ソースファイルの読み込み',
        () =>
          fetchJson<FileView>(
            `/api/source/${encodeURIComponent(executionId)}/content?file=${encodeURIComponent(
              file,
            )}`,
          ),
        {
          shouldReportError: () => sourceFileRequestIdRef.current === requestId,
          onError: (message) => setSourceFileError({ executionId, file, message }),
        },
      );
      if (sourceFileRequestIdRef.current !== requestId || !source) {
        return;
      }
      setSourceFileError(null);
      setSourceView({ ...source, title: file, executionId });
    } finally {
      if (sourceFileRequestIdRef.current === requestId) {
        setSourceFilePending(null);
      }
    }
  }

  function selectSourceFile(executionId: string, file: string) {
    if (!file) {
      setSelectedSourceFile((current) => (current?.executionId === executionId ? null : current));
      return;
    }
    void loadSourceFile(executionId, file);
  }

  const postVisualizerRequest = useCallback((request: VisualizerRequest) => {
    visualizerFrameRef.current?.contentWindow?.postMessage(
      {
        type: 'pahcer:updateTestCase',
        seed: request.seed,
        executionId: request.executionId,
      },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    if (!visualizerSrc || !visualizerRequest) {
      return;
    }
    postVisualizerRequest(visualizerRequest);
  }, [postVisualizerRequest, visualizerRequest, visualizerSrc]);

  function showVisualizerFrame(request: VisualizerRequest, htmlFileName: string) {
    if (!visualizerSrc || visualizerHtmlFileNameRef.current !== htmlFileName) {
      const query = new URLSearchParams({
        seed: String(request.seed),
        executionId: request.executionId,
        htmlFileName,
      });
      visualizerHtmlFileNameRef.current = htmlFileName;
      setVisualizerSrc(`/api/visualizer/frame?${query}`);
    }
    setVisualizerRequest(request);
    setVisualizerError(null);
    setActivePanel('visualizer');
  }

  const handleVisualizerFrameLoad = useCallback(() => {
    if (visualizerRequest) {
      postVisualizerRequest(visualizerRequest);
    }
  }, [postVisualizerRequest, visualizerRequest]);

  async function openVisualizer(seed: number, executionId: string) {
    const request = { seed, executionId };
    const requestId = nextUiActionRequestId();
    visualizerRequestIdRef.current = requestId;
    setVisualizerPending({ ...request, requestId });
    setVisualizerError(null);
    setPendingVisualizerRequest(null);
    setActivePanel('visualizer');

    try {
      const result = await runUiAction(
        'ビジュアライザの確認',
        () => fetchJson<{ htmlFileName?: string }>('/api/visualizer/status'),
        {
          shouldReportError: () => visualizerRequestIdRef.current === requestId,
          onError: setVisualizerError,
        },
      );
      if (visualizerRequestIdRef.current !== requestId || !result) {
        return;
      }
      if (!result.htmlFileName) {
        setPendingVisualizerRequest(request);
        setVisualizerModalOpen(true);
        return;
      }

      showVisualizerFrame(request, result.htmlFileName);
      setPendingVisualizerRequest(null);
    } finally {
      if (visualizerRequestIdRef.current === requestId) {
        setVisualizerPending(null);
      }
    }
  }

  async function downloadVisualizer(url: string) {
    const request = pendingVisualizerRequest ?? visualizerRequest ?? selectedCase;
    if (!request) {
      const caught = new Error('表示するケースを選択してください');
      reportError(caught);
      throw caught;
    }

    setVisualizerDownloading(true);
    setVisualizerError(null);
    try {
      const result = await runUiAction(
        'ビジュアライザのダウンロード',
        () =>
          fetchJson<{ htmlFileName: string }>('/api/visualizer/download', {
            method: 'POST',
            body: JSON.stringify({ url }),
          }),
        {
          onError: setVisualizerError,
          rethrow: true,
        },
      );
      if (!result) {
        return;
      }
      showVisualizerFrame(request, result.htmlFileName);
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

  const selectedCount = selectedExecutionIds.length;
  const selectedExecutions =
    treeData?.executionStatsList.filter((stats) =>
      selectedExecutionIds.includes(stats.execution.id),
    ) ?? [];
  const canShowDiff =
    selectedCount === 2 &&
    selectedExecutions.length === 2 &&
    selectedExecutions.every((stats) => Boolean(stats.execution.commitHash));
  const selectedExecution = treeData?.executionStatsList.find(
    (stats) => stats.execution.id === selectedExecutionIds[selectedExecutionIds.length - 1],
  )?.execution;
  const hasSelectedCase = selectedCase !== null;
  const hasSelectedExecution = selectedExecution !== undefined;
  const hasVisualizer =
    visualizerSrc !== null ||
    visualizerPending !== null ||
    visualizerError !== null ||
    visualizerModalOpen;
  const caseFilePendingKind =
    selectedCase !== null &&
    caseFilePending !== null &&
    caseFilePending?.executionId === selectedCase.executionId &&
    caseFilePending.seed === selectedCase.seed
      ? caseFilePending.kind
      : null;
  const caseFileLoadError =
    selectedCase !== null &&
    caseFileError !== null &&
    caseFileError?.executionId === selectedCase.executionId &&
    caseFileError.seed === selectedCase.seed
      ? { kind: caseFileError.kind, message: caseFileError.message }
      : null;
  const diffPendingForSelection =
    diffPending !== null && sameExecutionIds(diffPending.executionIds, selectedExecutionIds);
  const diffErrorForSelection =
    diffError !== null && sameExecutionIds(diffError.executionIds, selectedExecutionIds)
      ? diffError.message
      : null;
  const activeDiffView =
    diffView?.executionIds && sameExecutionIds(diffView.executionIds, selectedExecutionIds)
      ? diffView
      : null;
  const sourcePreparationPendingForExecution =
    selectedExecution !== undefined &&
    sourcePreparationPending?.executionId === selectedExecution.id;
  const sourcePreparationErrorForExecution =
    selectedExecution !== undefined && sourcePreparationError?.executionId === selectedExecution.id
      ? sourcePreparationError.message
      : null;
  const sourceFilePendingForExecution =
    selectedExecution !== undefined && sourceFilePending?.executionId === selectedExecution.id
      ? sourceFilePending.file
      : null;
  const sourceFileErrorForExecution =
    selectedExecution !== undefined && sourceFileError?.executionId === selectedExecution.id
      ? { file: sourceFileError.file, message: sourceFileError.message }
      : null;
  const selectedSourceFileForExecution =
    selectedExecution !== undefined && selectedSourceFile?.executionId === selectedExecution.id
      ? selectedSourceFile.file
      : '';

  // source パネル表示中、選択実行のソース準備が未ロードなら自動で読み込む
  const prepareSourceRef = useRef(prepareSource);
  prepareSourceRef.current = prepareSource;
  useEffect(() => {
    if (activePanel !== 'source' || !hasSelectedExecution || !selectedExecution) {
      return;
    }
    const executionId = selectedExecution.id;
    const alreadyPrepared =
      sourcePreparation?.executionId === executionId ||
      sourcePreparationPending?.executionId === executionId ||
      sourcePreparationError?.executionId === executionId;
    if (alreadyPrepared) {
      return;
    }
    void prepareSourceRef.current(executionId);
  }, [
    activePanel,
    hasSelectedExecution,
    selectedExecution,
    sourcePreparation,
    sourcePreparationError,
    sourcePreparationPending,
  ]);

  const getPanelDisabledReason = useCallback(
    (panel: Panel): string | undefined => {
      switch (panel) {
        case 'case':
          return hasSelectedCase ? undefined : 'ケースを選択してください';
        case 'source':
          return hasSelectedExecution ? undefined : '実行を選択してください';
        case 'diff':
          if (selectedCount !== 2) {
            return '実行を 2 件選択してください';
          }
          return canShowDiff ? undefined : '2 件の実行にコミットハッシュが必要です';
        case 'visualizer':
          return hasVisualizer
            ? undefined
            : 'ケースタブの「ビジュアライザを開く」から起動してください';
        case 'comparison':
        case 'initialize':
          return undefined;
      }
    },
    [canShowDiff, hasSelectedCase, hasSelectedExecution, hasVisualizer, selectedCount],
  );

  const activatePanelTab = useCallback(
    (panel: Panel) => {
      if (getPanelDisabledReason(panel) !== undefined) {
        return;
      }

      setActivePanel(panel);
      if (panel === 'diff') {
        void loadDiffForCurrentSelection();
      }
    },
    [getPanelDisabledReason, loadDiffForCurrentSelection],
  );

  function renderPanelTabsActions() {
    switch (activePanel) {
      case 'case':
        return selectedCase ? (
          <Button
            variant="primary"
            onClick={() => void openVisualizer(selectedCase.seed, selectedCase.executionId)}
          >
            ビジュアライザを開く
          </Button>
        ) : null;
      case 'source':
        return null;
      case 'comparison':
      case 'diff':
      case 'visualizer':
      case 'initialize':
        return null;
    }
  }

  useEffect(() => {
    if (getPanelDisabledReason(activePanel) !== undefined) {
      setActivePanel('comparison');
    }
  }, [activePanel, getPanelDisabledReason]);

  // Apply a CLI-generated browser link once after the initial tree is ready.
  // biome-ignore lint/correctness/useExhaustiveDependencies: deep links are intentionally applied once
  useEffect(() => {
    if (deepLinkAppliedRef.current || status?.status !== 'ready' || !treeData) {
      return;
    }

    deepLinkAppliedRef.current = true;
    const route = readPahcerUIRoute();
    if (route.kind === 'home') {
      return;
    }

    const executionExists = (executionId: string) =>
      treeData.executions.some((execution) => execution.id === executionId);

    if (route.kind === 'execution' && executionExists(route.executionId)) {
      void openExecution(route.executionId);
      return;
    }

    if (route.kind === 'source' && executionExists(route.executionId)) {
      selectedExecutionIdsRef.current = [route.executionId];
      setSelectedExecutionIds([route.executionId]);
      void openExecution(route.executionId);
      setActivePanel('source');
      return;
    }

    if (route.kind === 'case' || route.kind === 'visualizer') {
      if (!executionExists(route.executionId)) {
        return;
      }
      void openExecution(route.executionId);
      setSelectedCase({ executionId: route.executionId, seed: route.seed });
      setSelectedCaseFileKind(route.kind === 'case' ? (route.fileKind ?? 'input') : 'input');
      if (route.kind === 'visualizer') {
        void openVisualizer(route.seed, route.executionId);
      } else {
        setActivePanel('case');
      }
      return;
    }

    if (route.kind === 'comparison' || route.kind === 'diff') {
      const executionIds = route.executionIds.filter(executionExists);
      if (executionIds.length === 0) {
        return;
      }
      selectedExecutionIdsRef.current = executionIds;
      setSelectedExecutionIds(executionIds);
      setActivePanel(route.kind);
      if (route.kind === 'diff' && executionIds.length === 2) {
        void loadDiffForCurrentSelection(executionIds);
      }
    }
  }, [status?.status, treeData]);

  const routeSyncReadyRef = useRef(false);
  useEffect(() => {
    if (status?.status !== 'ready' || !treeData || !deepLinkAppliedRef.current) {
      return;
    }
    if (!routeSyncReadyRef.current) {
      routeSyncReadyRef.current = true;
      return;
    }

    const route = routeForUiState({
      activePanel,
      openExecutionId,
      selectedExecutionIds,
      selectedCase,
      selectedCaseFileKind,
      visualizerRequest,
    });
    const nextPath = buildPahcerUIPath(route);
    if (window.location.pathname !== nextPath || window.location.search) {
      window.history.replaceState(window.history.state, '', nextPath);
    }
  }, [
    activePanel,
    openExecutionId,
    selectedCase,
    selectedCaseFileKind,
    selectedExecutionIds,
    status?.status,
    treeData,
    visualizerRequest,
  ]);

  const visualizerExecutionTitle = visualizerRequest
    ? findExecutionShortTitle(treeData, visualizerRequest.executionId)
    : undefined;
  const visualizerTitle = visualizerRequest
    ? {
        seed: visualizerRequest.seed,
        ...(visualizerExecutionTitle ? { execution: visualizerExecutionTitle } : {}),
      }
    : undefined;
  const visualizerExternalSrc =
    visualizerSrc && visualizerRequest
      ? buildVisualizerCaseUrl(visualizerSrc, visualizerRequest)
      : visualizerSrc;

  return (
    <main data-last-error={error ? 'present' : undefined}>
      <style>{globalStyles}</style>
      <TopBar
        status={status?.status}
        workspaceRoot={status?.workspaceRoot ?? ''}
        onRun={() => void runPahcer({ freezeBestScores: false })}
        onOpenRunOptions={() => setRunOptionsModalOpen(true)}
        onReload={() => void reload()}
      />

      {loading && <div className="globalLoading" role="progressbar" aria-label="処理中" />}
      <ToastContainer toasts={toasts} onClose={dismissToast} />
      <VisualizerUrlModal
        open={visualizerModalOpen}
        onClose={closeVisualizerModal}
        onSubmit={(url) => downloadVisualizer(url)}
        downloading={visualizerDownloading}
      />
      <Modal
        open={runOptionsModalOpen}
        onClose={() => setRunOptionsModalOpen(false)}
        title="詳細実行オプション"
      >
        <RunOptionsPanel
          onRun={(options) => {
            setRunOptionsModalOpen(false);
            void runPahcer(options);
          }}
          onCancel={() => setRunOptionsModalOpen(false)}
        />
      </Modal>

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
                onMissingOutput={showResultsNotFoundError}
                onSelectCase={(executionId, seed) => {
                  setSelectedCase({ executionId, seed });
                  setSelectedCaseFileKind('input');
                  void openVisualizer(seed, executionId);
                }}
                onSaveComment={(executionId, comment) => void saveComment(executionId, comment)}
              />
            ) : (
              <SeedTree
                seeds={seeds}
                openSeed={openSeed}
                executions={seedExecutions}
                selectedExecutionIds={selectedExecutionIds}
                onOpenSeed={(seed) => void openSeedExecutions(seed)}
                onToggleExecution={toggleSelectedExecution}
                onMissingOutput={showResultsNotFoundError}
                onSelectCase={(executionId, seed) => {
                  setSelectedCase({ executionId, seed });
                  setSelectedCaseFileKind('input');
                  void openVisualizer(seed, executionId);
                }}
              />
            )}
          </SideBar>

          <section className="mainPanel">
            <nav className="panelTabs">
              <div className="panelTabsList">
                {ALL_PANELS.map((panel) => {
                  const disabledReason = getPanelDisabledReason(panel);
                  const disabled = disabledReason !== undefined;
                  const disabledReasonId = disabled
                    ? `panel-tab-${panel}-disabled-reason`
                    : undefined;

                  return (
                    <button
                      type="button"
                      className={activePanel === panel ? 'active' : ''}
                      title={disabledReason}
                      aria-disabled={disabled ? 'true' : undefined}
                      aria-describedby={disabledReasonId}
                      onClick={() => activatePanelTab(panel)}
                      key={panel}
                    >
                      {panelLabel(panel)}
                      {disabledReason && (
                        <span id={disabledReasonId} className="visuallyHidden">
                          {disabledReason}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="panelTabsActions">{renderPanelTabsActions()}</div>
            </nav>

            {activePanel === 'comparison' && (
              <ComparisonPanel
                data={comparison}
                selectedCount={selectedCount}
                onShowVisualizer={(resultId, seed) => void openVisualizer(seed, resultId)}
              />
            )}

            {activePanel === 'case' && selectedCase && (
              <CasePanel
                key={`${selectedCase.executionId}:${selectedCase.seed}`}
                selectedCase={selectedCase}
                initialKind={selectedCaseFileKind}
                fileView={fileView}
                pendingKind={caseFilePendingKind}
                loadError={caseFileLoadError}
                onOpenFile={(kind) => {
                  setSelectedCaseFileKind(kind);
                  void openCaseFile(kind, selectedCase.executionId, selectedCase.seed);
                }}
              />
            )}
            {activePanel === 'case' && !selectedCase && (
              <EmptyState text="ケースを選択してください" />
            )}

            {activePanel === 'diff' && (
              <DiffPanel
                diff={activeDiffView}
                selectedCount={selectedCount}
                pending={diffPendingForSelection}
                loadError={diffErrorForSelection}
              />
            )}

            {activePanel === 'source' && selectedExecution && (
              <SourcePanel
                preparation={sourcePreparation}
                preparationPending={sourcePreparationPendingForExecution}
                preparationError={sourcePreparationErrorForExecution}
                sourceView={sourceView}
                sourceFilePending={sourceFilePendingForExecution}
                sourceFileError={sourceFileErrorForExecution}
                selectedFile={selectedSourceFileForExecution}
                executionId={selectedExecution.id}
                executionLabel={
                  selectedExecution.shortTitle ?? shortExecutionId(selectedExecution.id)
                }
                onSelectFile={(file) => selectSourceFile(selectedExecution.id, file)}
              />
            )}
            {activePanel === 'source' && !selectedExecution && (
              <EmptyState text="実行を選択してください" />
            )}

            <div
              className={activePanel === 'visualizer' ? 'panelView' : 'panelViewHidden'}
              aria-hidden={activePanel === 'visualizer' ? undefined : true}
            >
              <VisualizerPanel
                src={visualizerSrc}
                externalSrc={visualizerExternalSrc}
                pending={visualizerPending !== null}
                loadError={visualizerError}
                title={visualizerTitle}
                frameRef={visualizerFrameRef}
                onFrameLoad={handleVisualizerFrameLoad}
                onResetVisualizer={resetVisualizer}
              />
            </div>
          </section>
        </section>
      )}
    </main>
  );
}

function readPahcerUIRoute(): PahcerUIRoute {
  const pathRoute = parsePahcerUIPath(window.location.pathname);
  if (pathRoute && pathRoute.kind !== 'home') {
    return pathRoute;
  }

  const legacyRoute = parseLegacyQueryRoute(new URLSearchParams(window.location.search));
  return legacyRoute ?? pathRoute ?? { kind: 'home' };
}

function parseLegacyQueryRoute(query: URLSearchParams): PahcerUIRoute | undefined {
  const view = query.get('view');
  const executionId = query.get('executionId') || '';
  if (view === 'execution' && executionId) {
    return { kind: 'execution', executionId };
  }
  if (view === 'source' && executionId) {
    return { kind: 'source', executionId };
  }
  if (view === 'case' || view === 'visualizer') {
    const seed = Number(query.get('seed'));
    if (!executionId || !Number.isInteger(seed) || seed < 0) {
      return undefined;
    }
    const fileKind = query.get('fileKind');
    if (view === 'visualizer') {
      return { kind: 'visualizer', executionId, seed };
    }
    return {
      kind: 'case',
      executionId,
      seed,
      ...(fileKind === 'input' || fileKind === 'output' || fileKind === 'error'
        ? { fileKind }
        : {}),
    };
  }
  if (view === 'comparison' || view === 'diff') {
    const executionIds = (query.get('executionIds') || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (executionIds.length > 0) {
      return { kind: view, executionIds };
    }
  }
  return undefined;
}

function routeForUiState(state: {
  activePanel: Panel;
  openExecutionId: string | null;
  selectedExecutionIds: string[];
  selectedCase: SelectedCase | null;
  selectedCaseFileKind: CaseFileKind;
  visualizerRequest: VisualizerRequest | null;
}): PahcerUIRoute {
  if (state.activePanel === 'visualizer') {
    const request = state.visualizerRequest ?? state.selectedCase;
    if (request) {
      return { kind: 'visualizer', executionId: request.executionId, seed: request.seed };
    }
  }

  if (state.activePanel === 'case' && state.selectedCase) {
    return {
      kind: 'case',
      executionId: state.selectedCase.executionId,
      seed: state.selectedCase.seed,
      fileKind: state.selectedCaseFileKind,
    };
  }

  const selectedExecutionId = state.selectedExecutionIds[state.selectedExecutionIds.length - 1];
  if (state.activePanel === 'source' && selectedExecutionId) {
    return { kind: 'source', executionId: selectedExecutionId };
  }

  if (state.activePanel === 'diff' && state.selectedExecutionIds.length > 0) {
    return { kind: 'diff', executionIds: state.selectedExecutionIds };
  }

  if (state.selectedExecutionIds.length > 0) {
    return { kind: 'comparison', executionIds: state.selectedExecutionIds };
  }

  if (state.openExecutionId) {
    return { kind: 'execution', executionId: state.openExecutionId };
  }

  return { kind: 'home' };
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

function buildVisualizerCaseUrl(src: string, request: VisualizerRequest): string {
  const url = new URL(src, window.location.href);
  url.searchParams.set('seed', String(request.seed));
  url.searchParams.set('executionId', request.executionId);
  return url.toString();
}

function selectPreparedSourceFile(
  files: string[],
  preferredFile: string | undefined,
): string | null {
  if (preferredFile && files.includes(preferredFile)) {
    return preferredFile;
  }
  return files[0] ?? null;
}

function sameExecutionIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}
