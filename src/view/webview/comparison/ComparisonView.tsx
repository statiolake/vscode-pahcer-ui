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
	const [featureString, setFeatureString] = useState(initialData.config.features || '');
	const [xAxis, setXAxis] = useState(initialData.config.xAxis || 'seed');
	const [yAxis, setYAxis] = useState(initialData.config.yAxis || 'absScore');
	const [chartType, setChartType] = useState<'line' | 'scatter'>('line');
	const [skipFailed, setSkipFailed] = useState(true);

	// Auto-save features
	useEffect(() => {
		postMessage({ command: 'saveFeatures', features: featureString });
	}, [featureString]);

	// Auto-save xAxis
	useEffect(() => {
		postMessage({ command: 'saveXAxis', xAxis });
	}, [xAxis]);

	// Auto-save yAxis
	useEffect(() => {
		postMessage({ command: 'saveYAxis', yAxis });
	}, [yAxis]);

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
