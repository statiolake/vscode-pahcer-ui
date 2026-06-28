import { ComparisonViewReadModelService } from '@pahcer/core/application/services/comparisonViewReadModelService';
import { useEffect, useMemo, useState } from 'react';

import { fetchJson } from '../../../api';
import { EmptyState } from '../../common/EmptyState';
import { ComparisonChart } from './ComparisonChart';
import { ControlPanel } from './ControlPanel';
import { StatsTable } from './StatsTable';
import type {
  ComparisonData,
  ComparisonExpressionValidation,
  ComparisonViewOptions,
  ComparisonViewReadModelOptions,
} from './types';

type ComparisonPanelProps = {
  data: ComparisonData | null;
  selectedCount: number;
  onShowVisualizer: (resultId: string, seed: number) => void;
};

type ReadModelInput = {
  data: ComparisonData;
  options: ComparisonViewReadModelOptions;
};

export function ComparisonPanel(props: ComparisonPanelProps) {
  const [draftConfig, setDraftConfig] = useState<ComparisonViewOptions>(() =>
    props.data ? toComparisonViewOptions(props.data.config) : DEFAULT_COMPARISON_CONFIG,
  );
  const [lastValidConfig, setLastValidConfig] = useState<ComparisonViewOptions | null>(null);
  const [readModelInput, setReadModelInput] = useState<ReadModelInput | null>(() =>
    props.data
      ? {
          data: props.data,
          options: toComparisonViewReadModelOptions(toComparisonViewOptions(props.data.config)),
        }
      : null,
  );
  const readModelService = useMemo(() => new ComparisonViewReadModelService(), []);

  const draftValidation = useMemo(
    () =>
      readModelService.validateOptions({
        xAxis: draftConfig.xAxis,
        yAxis: draftConfig.yAxis,
        filter: draftConfig.filter,
      }),
    [draftConfig.filter, draftConfig.xAxis, draftConfig.yAxis, readModelService],
  );

  const draftConfigIsValid = isComparisonConfigValid(draftValidation);

  useEffect(() => {
    if (!props.data || !draftConfigIsValid) {
      return;
    }

    setLastValidConfig((current) =>
      current && comparisonViewOptionsEqual(current, draftConfig) ? current : draftConfig,
    );
  }, [draftConfig, draftConfigIsValid, props.data]);

  useEffect(() => {
    if (!props.data) {
      setLastValidConfig(null);
      setReadModelInput(null);
      return;
    }

    const nextConfig = toComparisonViewOptions(props.data.config);
    setDraftConfig(nextConfig);
    setLastValidConfig(nextConfig);
    setReadModelInput({
      data: props.data,
      options: toComparisonViewReadModelOptions(nextConfig),
    });
  }, [props.data]);

  const lastValidFeatureString = lastValidConfig?.featureString;
  const lastValidXAxis = lastValidConfig?.xAxis;
  const lastValidYAxis = lastValidConfig?.yAxis;
  const lastValidSkipFailed = lastValidConfig?.skipFailed;
  const lastValidFilter = lastValidConfig?.filter;

  const lastValidBestRankingInclude = lastValidConfig?.bestRankingInclude;
  const lastValidBestRankingExclude = lastValidConfig?.bestRankingExclude;

  useEffect(() => {
    const data = props.data;
    if (
      !data ||
      lastValidFeatureString === undefined ||
      lastValidXAxis === undefined ||
      lastValidYAxis === undefined ||
      lastValidSkipFailed === undefined ||
      lastValidFilter === undefined ||
      lastValidBestRankingInclude === undefined ||
      lastValidBestRankingExclude === undefined
    ) {
      return;
    }

    const nextOptions: ComparisonViewReadModelOptions = {
      featureString: lastValidFeatureString,
      xAxis: lastValidXAxis,
      yAxis: lastValidYAxis,
      skipFailed: lastValidSkipFailed,
      filter: lastValidFilter,
      bestRankingInclude: lastValidBestRankingInclude,
      bestRankingExclude: lastValidBestRankingExclude,
    };
    const timeout = window.setTimeout(() => {
      setReadModelInput((current) =>
        current?.data === data && comparisonViewReadModelOptionsEqual(current.options, nextOptions)
          ? current
          : {
              data,
              options: nextOptions,
            },
      );
    }, READ_MODEL_UPDATE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [
    lastValidFeatureString,
    lastValidBestRankingExclude,
    lastValidBestRankingInclude,
    lastValidFilter,
    lastValidSkipFailed,
    lastValidXAxis,
    lastValidYAxis,
    props.data,
  ]);

  const readModelData = readModelInput?.data ?? null;
  const readModelFeatureString = readModelInput?.options.featureString;
  const readModelXAxis = readModelInput?.options.xAxis;
  const readModelYAxis = readModelInput?.options.yAxis;
  const readModelSkipFailed = readModelInput?.options.skipFailed;
  const readModelFilter = readModelInput?.options.filter;

  const readModelBestRankingInclude = readModelInput?.options.bestRankingInclude;
  const readModelBestRankingExclude = readModelInput?.options.bestRankingExclude;

  const readModel = useMemo(() => {
    if (
      !readModelData ||
      readModelFeatureString === undefined ||
      readModelXAxis === undefined ||
      readModelYAxis === undefined ||
      readModelSkipFailed === undefined ||
      readModelFilter === undefined ||
      readModelBestRankingInclude === undefined ||
      readModelBestRankingExclude === undefined
    ) {
      return null;
    }

    return readModelService.build(readModelData, {
      featureString: readModelFeatureString,
      xAxis: readModelXAxis,
      yAxis: readModelYAxis,
      skipFailed: readModelSkipFailed,
      filter: readModelFilter,
      bestRankingInclude: readModelBestRankingInclude,
      bestRankingExclude: readModelBestRankingExclude,
    });
  }, [
    readModelData,
    readModelFeatureString,
    readModelFilter,
    readModelSkipFailed,
    readModelXAxis,
    readModelYAxis,
    readModelBestRankingInclude,
    readModelBestRankingExclude,
    readModelService,
  ]);

  const activeReadModel = readModelData === props.data ? readModel : null;
  const activeReadModelFilter = readModelData === props.data ? readModelFilter : undefined;

  useEffect(() => {
    if (
      !props.data ||
      !lastValidConfig ||
      !draftConfigIsValid ||
      !comparisonViewOptionsEqual(draftConfig, lastValidConfig)
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetchJson('/api/comparison/config', {
        method: 'POST',
        body: JSON.stringify(lastValidConfig),
      }).catch(console.error);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [draftConfig, draftConfigIsValid, lastValidConfig, props.data]);

  function updateDraftConfig(patch: Partial<ComparisonViewOptions>) {
    setDraftConfig((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="panelContent">
      {!props.data && props.selectedCount === 0 && (
        <EmptyState
          text="グラフを表示する実行を選択してください"
          hint="左の一覧から実行を選んでください。"
        />
      )}
      {props.data && activeReadModel && activeReadModelFilter !== undefined && (
        <>
          <ControlPanel
            featureString={draftConfig.featureString}
            xAxis={draftConfig.xAxis}
            yAxis={draftConfig.yAxis}
            chartType={draftConfig.chartType}
            skipFailed={draftConfig.skipFailed}
            filter={draftConfig.filter}
            validation={draftValidation}
            onFeatureStringChange={(featureString) => updateDraftConfig({ featureString })}
            onXAxisChange={(xAxis) => updateDraftConfig({ xAxis })}
            onYAxisChange={(yAxis) => updateDraftConfig({ yAxis })}
            onChartTypeChange={(chartType) => updateDraftConfig({ chartType })}
            onSkipFailedChange={(skipFailed) => updateDraftConfig({ skipFailed })}
            onFilterChange={(filter) => updateDraftConfig({ filter })}
          />

          <ComparisonChart
            chart={activeReadModel.chart}
            chartType={draftConfig.chartType}
            onShowVisualizer={props.onShowVisualizer}
          />

          <StatsTable
            stats={activeReadModel.stats}
            showsFilteredCount={activeReadModelFilter.trim() !== ''}
            bestRankingInclude={draftConfig.bestRankingInclude}
            bestRankingExclude={draftConfig.bestRankingExclude}
            onBestRankingIncludeChange={(bestRankingInclude) =>
              updateDraftConfig({ bestRankingInclude })
            }
            onBestRankingExcludeChange={(bestRankingExclude) =>
              updateDraftConfig({ bestRankingExclude })
            }
          />
        </>
      )}
    </div>
  );
}

const DEFAULT_COMPARISON_CONFIG: ComparisonViewOptions = {
  featureString: 'N M K',
  xAxis: 'seed',
  yAxis: 'avg(absScore)',
  chartType: 'line',
  skipFailed: true,
  filter: '',
  bestRankingInclude: '',
  bestRankingExclude: '',
};

const READ_MODEL_UPDATE_DELAY_MS = 120;

function toComparisonViewOptions(config: ComparisonData['config']): ComparisonViewOptions {
  return {
    featureString: config.featureString,
    xAxis: config.xAxis,
    yAxis: config.yAxis,
    chartType: config.chartType,
    skipFailed: config.skipFailed ?? true,
    filter: config.filter,
    bestRankingInclude: config.bestRankingInclude ?? '',
    bestRankingExclude: config.bestRankingExclude ?? '',
  };
}

function toComparisonViewReadModelOptions(
  options: ComparisonViewOptions,
): ComparisonViewReadModelOptions {
  return {
    featureString: options.featureString,
    xAxis: options.xAxis,
    yAxis: options.yAxis,
    skipFailed: options.skipFailed,
    filter: options.filter,
    bestRankingInclude: options.bestRankingInclude,
    bestRankingExclude: options.bestRankingExclude,
  };
}

function isComparisonConfigValid(validation: ComparisonExpressionValidation): boolean {
  return validation.xAxis && validation.yAxis && validation.filter;
}

function comparisonViewOptionsEqual(
  left: ComparisonViewOptions,
  right: ComparisonViewOptions,
): boolean {
  return (
    left.featureString === right.featureString &&
    left.xAxis === right.xAxis &&
    left.yAxis === right.yAxis &&
    left.chartType === right.chartType &&
    left.skipFailed === right.skipFailed &&
    left.filter === right.filter &&
    left.bestRankingInclude === right.bestRankingInclude &&
    left.bestRankingExclude === right.bestRankingExclude
  );
}

function comparisonViewReadModelOptionsEqual(
  left: ComparisonViewReadModelOptions,
  right: ComparisonViewReadModelOptions,
): boolean {
  return (
    left.featureString === right.featureString &&
    left.xAxis === right.xAxis &&
    left.yAxis === right.yAxis &&
    left.skipFailed === right.skipFailed &&
    left.filter === right.filter &&
    left.bestRankingInclude === right.bestRankingInclude &&
    left.bestRankingExclude === right.bestRankingExclude
  );
}
