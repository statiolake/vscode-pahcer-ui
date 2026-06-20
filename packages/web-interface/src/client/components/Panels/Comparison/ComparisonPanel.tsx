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
} from './types';

type ComparisonPanelProps = {
  data: ComparisonData | null;
  selectedCount: number;
  onShowVisualizer: (resultId: string, seed: number) => void;
};

export function ComparisonPanel(props: ComparisonPanelProps) {
  const [draftConfig, setDraftConfig] = useState<ComparisonViewOptions>(DEFAULT_COMPARISON_CONFIG);
  const [lastValidConfig, setLastValidConfig] = useState<ComparisonViewOptions | null>(null);
  const readModelService = useMemo(() => new ComparisonViewReadModelService(), []);

  useEffect(() => {
    if (!props.data) {
      return;
    }

    setDraftConfig(toComparisonViewOptions(props.data.config));
    setLastValidConfig(null);
  }, [props.data]);

  const viewOptions = draftConfig;

  const readModel = useMemo(
    () => (props.data ? readModelService.build(props.data, viewOptions) : null),
    [props.data, readModelService, viewOptions],
  );

  const draftConfigIsValid = readModel ? isComparisonConfigValid(readModel.validation) : false;

  useEffect(() => {
    if (!props.data || !draftConfigIsValid) {
      return;
    }

    setLastValidConfig(viewOptions);
  }, [draftConfigIsValid, props.data, viewOptions]);

  useEffect(() => {
    if (
      !props.data ||
      !lastValidConfig ||
      !draftConfigIsValid ||
      !comparisonViewOptionsEqual(viewOptions, lastValidConfig)
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
  }, [draftConfigIsValid, lastValidConfig, props.data, viewOptions]);

  function updateDraftConfig(patch: Partial<ComparisonViewOptions>) {
    setDraftConfig((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="panelContent">
      {!props.data &&
        (props.selectedCount === 0 ? (
          <EmptyState
            text="比較する実行を選択してください"
            hint="左の一覧の実行行のチェックボックスを 2 件以上 ON にすると、ここに比較グラフが表示されます。"
          />
        ) : (
          <EmptyState
            text="あと 1 件以上選んでください"
            hint="2 件以上の実行を比較できます。差分タブも有効になります。"
          />
        ))}
      {props.data && readModel && (
        <>
          <ControlPanel
            featureString={draftConfig.featureString}
            xAxis={draftConfig.xAxis}
            yAxis={draftConfig.yAxis}
            chartType={draftConfig.chartType}
            skipFailed={draftConfig.skipFailed}
            filter={draftConfig.filter}
            validation={readModel.validation}
            onFeatureStringChange={(featureString) => updateDraftConfig({ featureString })}
            onXAxisChange={(xAxis) => updateDraftConfig({ xAxis })}
            onYAxisChange={(yAxis) => updateDraftConfig({ yAxis })}
            onChartTypeChange={(chartType) => updateDraftConfig({ chartType })}
            onSkipFailedChange={(skipFailed) => updateDraftConfig({ skipFailed })}
            onFilterChange={(filter) => updateDraftConfig({ filter })}
          />

          <ComparisonChart
            chart={readModel.chart}
            chartType={draftConfig.chartType}
            onShowVisualizer={props.onShowVisualizer}
          />

          <StatsTable
            stats={readModel.stats}
            showsFilteredCount={draftConfig.filter.trim() !== ''}
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
};

function toComparisonViewOptions(config: ComparisonData['config']): ComparisonViewOptions {
  return {
    featureString: config.featureString,
    xAxis: config.xAxis,
    yAxis: config.yAxis,
    chartType: config.chartType,
    skipFailed: config.skipFailed ?? true,
    filter: config.filter,
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
    left.filter === right.filter
  );
}
