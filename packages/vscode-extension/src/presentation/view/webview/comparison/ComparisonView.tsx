import { ComparisonViewReadModelService } from '@pahcer/core/application/services/comparisonViewReadModelService';
import { useEffect, useMemo, useState } from 'react';
import { postMessage } from '../shared/utils/vscode';
import { ComparisonChart } from './components/ComparisonChart';
import { ControlPanel } from './components/ControlPanel';
import { StatsTable } from './components/StatsTable';
import type { ComparisonData, ComparisonViewReadModelOptions } from './types';

interface Props {
  initialData: ComparisonData;
}

export function ComparisonView({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [featureString, setFeatureString] = useState(initialData.config.featureString);
  const [xAxis, setXAxis] = useState(initialData.config.xAxis);
  const [yAxis, setYAxis] = useState(initialData.config.yAxis);
  const [chartType, setChartType] = useState<'line' | 'scatter'>(initialData.config.chartType);
  const [filter, setFilter] = useState(initialData.config.filter);
  const [skipFailed, setSkipFailed] = useState(initialData.config.skipFailed ?? true);
  const readModelService = useMemo(() => new ComparisonViewReadModelService(), []);
  const readModelOptions: ComparisonViewReadModelOptions = useMemo(
    () => ({
      featureString,
      xAxis,
      yAxis,
      skipFailed,
      filter,
    }),
    [featureString, xAxis, yAxis, skipFailed, filter],
  );
  const readModel = useMemo(
    () => readModelService.build(data, readModelOptions),
    [data, readModelOptions, readModelService],
  );

  // Listen for data updates from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === 'updateData') {
        setData(message.data);
        // Update config from new data
        setFeatureString(message.data.config.featureString);
        setXAxis(message.data.config.xAxis);
        setYAxis(message.data.config.yAxis);
        setChartType(message.data.config.chartType);
        setSkipFailed(message.data.config.skipFailed ?? true);
        setFilter(message.data.config.filter);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Auto-save comparison config
  useEffect(() => {
    postMessage({
      command: 'saveComparisonConfig',
      config: {
        featureString,
        xAxis,
        yAxis,
        chartType,
        skipFailed,
        filter,
      },
    });
  }, [featureString, xAxis, yAxis, chartType, skipFailed, filter]);

  return (
    <div style={{ padding: '20px' }}>
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

      <ComparisonChart chart={readModel.chart} chartType={chartType} />

      <StatsTable stats={readModel.stats} showsFilteredCount={filter.trim() !== ''} />
    </div>
  );
}
