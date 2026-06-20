import { ComparisonViewReadModelService } from '@pahcer/core/application/services/comparisonViewReadModelService';
import { useEffect, useMemo, useState } from 'react';

import { fetchJson } from '../../../api';
import { comparisonHint } from '../../../utils/labels';
import { EmptyState } from '../../common/EmptyState';
import { ComparisonChart } from './ComparisonChart';
import { ControlPanel } from './ControlPanel';
import { StatsTable } from './StatsTable';
import type { ComparisonData, ComparisonViewOptions } from './types';

type ComparisonPanelProps = {
  data: ComparisonData | null;
  selectedCount: number;
  onShowDiff: () => void;
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

      {!props.data && <EmptyState text={`比較対象: ${props.selectedCount} 件`} />}
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
