import React from 'react';

interface Props {
	features: string;
	xAxis: string;
	yAxis: 'absolute' | 'relative';
	chartType: 'line' | 'scatter';
	skipFailed: boolean;
	onFeaturesChange: (value: string) => void;
	onXAxisChange: (value: string) => void;
	onYAxisChange: (value: 'absolute' | 'relative') => void;
	onChartTypeChange: (value: 'line' | 'scatter') => void;
	onSkipFailedChange: (value: boolean) => void;
}

export function ControlPanel({
	features,
	xAxis,
	yAxis,
	chartType,
	skipFailed,
	onFeaturesChange,
	onXAxisChange,
	onYAxisChange,
	onChartTypeChange,
	onSkipFailedChange,
}: Props) {
	const sectionStyle = {
		marginBottom: '20px',
		padding: '10px',
		border: '1px solid var(--vscode-panel-border)',
	};

	const controlsStyle = {
		display: 'flex',
		gap: '10px',
		flexWrap: 'wrap' as const,
	};

	const labelStyle = {
		marginRight: '10px',
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
	};

	const inputStyle = {
		padding: '4px 8px',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		border: '1px solid var(--vscode-input-border)',
	};

	return (
		<>
			<div style={sectionStyle}>
				<label style={labelStyle}>
					Features:
					<input
						type="text"
						value={features}
						onChange={(e) => onFeaturesChange(e.target.value)}
						placeholder="例: N M K"
						style={{ ...inputStyle, width: '300px' }}
					/>
				</label>
				<p style={{ fontSize: '0.9em', color: 'var(--vscode-descriptionForeground)', marginTop: '5px' }}>
					入力ファイルの先頭行を空白区切りで解釈します (例: N M K)。変更すると自動保存されます。
				</p>
			</div>

			<div style={sectionStyle}>
				<h3>グラフ設定</h3>
				<div style={controlsStyle}>
					<label style={labelStyle}>
						Type:
						<select style={inputStyle} value={chartType} onChange={(e) => onChartTypeChange(e.target.value as 'line' | 'scatter')}>
							<option value="line">Line</option>
							<option value="scatter">Scatter</option>
						</select>
					</label>
					<label style={labelStyle}>
						X軸:
						<input
							type="text"
							value={xAxis}
							onChange={(e) => onXAxisChange(e.target.value)}
							placeholder="例: seed, N, log(N)"
							style={{ ...inputStyle, width: '200px' }}
						/>
					</label>
					<label style={labelStyle}>
						Y軸:
						<select style={inputStyle} value={yAxis} onChange={(e) => onYAxisChange(e.target.value as 'absolute' | 'relative')}>
							<option value="absolute">絶対スコア</option>
							<option value="relative">相対スコア</option>
						</select>
					</label>
					<label style={labelStyle}>
						<input type="checkbox" checked={skipFailed} onChange={(e) => onSkipFailedChange(e.target.checked)} />
						Skip Failed
					</label>
				</div>
				<p style={{ fontSize: '0.9em', color: 'var(--vscode-descriptionForeground)', marginTop: '5px' }}>
					X軸には式を使用できます (例: seed, N, log(N), N^2, 2*N)
				</p>
			</div>
		</>
	);
}
