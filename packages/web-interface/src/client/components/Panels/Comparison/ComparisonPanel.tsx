import { ComparisonViewReadModelService } from '@pahcer/core/application/services/comparisonViewReadModelService';
import { useEffect, useMemo, useState } from 'react';

import { fetchJson } from '../../../api';
import { EmptyState } from '../../common/EmptyState';
import { ComparisonChart } from './ComparisonChart';
import { ControlPanel } from './ControlPanel';
import { StatsTable } from './StatsTable';
import type { ComparisonData, ComparisonViewOptions } from './types';

type ComparisonPanelProps = {
  data: ComparisonData | null;
  selectedCount: number;
  onShowVisualizer: (resultId: string, seed: number) => void;
};

export function ComparisonPanel(props: ComparisonPanelProps) {
  const [featureString, setFeatureString] = useState('N M K');
  const [xAxis, setXAxis] = useState('seed');
  const [yAxis, setYAxis] = useState('avg(absScore)');
  const [chartType, setChartType] = useState<'line' | 'scatter'>('line');
  const [filter, setFilter] = useState('');
  const [skipFailed, setSkipFailed] = useState(true);
  const readModelService = useMemo(() => new ComparisonViewReadModelService(), []);

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

  const viewOptions: ComparisonViewOptions = useMemo(
    () => ({
      featureString,
      xAxis,
      yAxis,
      chartType,
      skipFailed,
      filter,
    }),
    [chartType, featureString, filter, skipFailed, xAxis, yAxis],
  );

  const readModel = useMemo(
    () => (props.data ? readModelService.build(props.data, viewOptions) : null),
    [props.data, readModelService, viewOptions],
  );

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
            featureString={featureString}
            xAxis={xAxis}
            yAxis={yAxis}
            chartType={chartType}
            skipFailed={skipFailed}
            filter={filter}
            validation={readModel.validation}
            onFeatureStringChange={setFeatureString}
            onXAxisChange={setXAxis}
            onYAxisChange={setYAxis}
            onChartTypeChange={setChartType}
            onSkipFailedChange={setSkipFailed}
            onFilterChange={setFilter}
          />

          <ComparisonChart
            chart={readModel.chart}
            chartType={chartType}
            onShowVisualizer={props.onShowVisualizer}
          />

          <StatsTable stats={readModel.stats} showsFilteredCount={filter.trim() !== ''} />
        </>
      )}
    </div>
  );
}
