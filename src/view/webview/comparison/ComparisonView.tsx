import React, { useState, useEffect } from 'react';
import type { ComparisonData } from './types';
import { StatsTable } from './components/StatsTable';
import { ComparisonChart } from './components/ComparisonChart';
import { ControlPanel } from './components/ControlPanel';
import { postMessage } from '../shared/utils/vscode';

interface Props {
	initialData: ComparisonData;
}

export function ComparisonView({ initialData }: Props) {
	const [featureString, setFeatureString] = useState(initialData.config.featureString);
	const [xAxis, setXAxis] = useState(initialData.config.xAxis);
	const [yAxis, setYAxis] = useState(initialData.config.yAxis);
	const [chartType, setChartType] = useState<'line' | 'scatter'>(initialData.config.chartType);
	const [skipFailed, setSkipFailed] = useState(true);

	// Auto-save comparison config
	useEffect(() => {
		postMessage({
			command: 'saveComparisonConfig',
			config: {
				featureString,
				xAxis,
				yAxis,
				chartType,
			},
		});
	}, [featureString, xAxis, yAxis, chartType]);

	return (
		<div style={{ padding: '20px' }}>
			<h1>実行結果の比較</h1>

			<ControlPanel
				featureString={featureString}
				xAxis={xAxis}
				yAxis={yAxis}
				chartType={chartType}
				skipFailed={skipFailed}
				onFeatureStringChange={setFeatureString}
				onXAxisChange={setXAxis}
				onYAxisChange={setYAxis}
				onChartTypeChange={setChartType}
				onSkipFailedChange={setSkipFailed}
			/>

			<StatsTable data={initialData} featureString={featureString} />

			<ComparisonChart
				data={initialData}
				featureString={featureString}
				xAxis={xAxis}
				yAxis={yAxis}
				chartType={chartType}
				skipFailed={skipFailed}
			/>
		</div>
	);
}
