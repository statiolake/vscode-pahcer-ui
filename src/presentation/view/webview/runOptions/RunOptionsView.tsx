import { type CSSProperties, useId, useState } from 'react';
import { postMessage } from '../shared/utils/vscode';

interface RunOptions {
	startSeed: number;
	endSeed: number;
	freezeBestScores: boolean;
}

export function RunOptionsView() {
	const startSeedId = useId();
	const endSeedId = useId();
	const freezeBestScoresId = useId();

	const [startSeed, setStartSeed] = useState(0);
	const [endSeed, setEndSeed] = useState(100);
	const [freezeBestScores, setFreezeBestScores] = useState(false);

	const handleRun = () => {
		const options: RunOptions = {
			startSeed,
			endSeed,
			freezeBestScores,
		};
		postMessage({ command: 'runWithOptions', options });
	};

	const handleCancel = () => {
		postMessage({ command: 'cancelRunOptions' });
	};

	const containerStyle: CSSProperties = {
		padding: '20px',
		color: 'var(--vscode-foreground)',
		backgroundColor: 'var(--vscode-editor-background)',
		height: '100vh',
		display: 'flex',
		flexDirection: 'column',
	};

	const formStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		gap: '20px',
		maxWidth: '600px',
	};

	const fieldStyle: CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		gap: '8px',
	};

	const labelStyle: CSSProperties = {
		fontSize: '14px',
		fontWeight: 'bold',
	};

	const inputStyle: CSSProperties = {
		padding: '6px 8px',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		border: '1px solid var(--vscode-input-border)',
		fontSize: '13px',
	};

	const checkboxContainerStyle: CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
	};

	const buttonContainerStyle: CSSProperties = {
		display: 'flex',
		gap: '10px',
		marginTop: '20px',
	};

	const buttonStyle: CSSProperties = {
		padding: '8px 16px',
		border: 'none',
		cursor: 'pointer',
		fontSize: '13px',
	};

	const primaryButtonStyle: CSSProperties = {
		...buttonStyle,
		backgroundColor: 'var(--vscode-button-background)',
		color: 'var(--vscode-button-foreground)',
	};

	const secondaryButtonStyle: CSSProperties = {
		...buttonStyle,
		backgroundColor: 'var(--vscode-button-secondaryBackground)',
		color: 'var(--vscode-button-secondaryForeground)',
	};

	const descriptionStyle: CSSProperties = {
		fontSize: '12px',
		color: 'var(--vscode-descriptionForeground)',
		marginTop: '4px',
	};

	return (
		<div style={containerStyle}>
			<h2 style={{ marginTop: 0 }}>詳細実行オプション</h2>

			<div style={formStyle}>
				<div style={fieldStyle}>
					<label htmlFor={startSeedId} style={labelStyle}>
						開始 Seed
					</label>
					<input
						id={startSeedId}
						type="number"
						value={startSeed}
						onChange={(e) => setStartSeed(Number(e.target.value))}
						style={inputStyle}
						min={0}
					/>
					<div style={descriptionStyle}>テストケースの開始seed値を指定します。</div>
				</div>

				<div style={fieldStyle}>
					<label htmlFor={endSeedId} style={labelStyle}>
						終了 Seed
					</label>
					<input
						id={endSeedId}
						type="number"
						value={endSeed}
						onChange={(e) => setEndSeed(Number(e.target.value))}
						style={inputStyle}
						min={startSeed + 1}
					/>
					<div style={descriptionStyle}>
						テストケースの終了seed値を指定します。[start_seed, end_seed)
						の半開区間が実行されるため、end_seedは区間に含まれません。
					</div>
				</div>

				<div style={fieldStyle}>
					<div style={checkboxContainerStyle}>
						<input
							id={freezeBestScoresId}
							type="checkbox"
							checked={freezeBestScores}
							onChange={(e) => setFreezeBestScores(e.target.checked)}
						/>
						<label htmlFor={freezeBestScoresId} style={{ cursor: 'pointer' }}>
							ベストスコアを更新しない (--freeze-best-scores)
						</label>
					</div>
					<div style={descriptionStyle}>
						チェックすると、ベストスコアの更新を行わずにテストを実行します。
					</div>
				</div>

				<div style={buttonContainerStyle}>
					<button type="button" onClick={handleRun} style={primaryButtonStyle}>
						実行
					</button>
					<button type="button" onClick={handleCancel} style={secondaryButtonStyle}>
						キャンセル
					</button>
				</div>
			</div>
		</div>
	);
}
