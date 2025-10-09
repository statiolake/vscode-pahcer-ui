import React, { useState } from 'react';

interface InitOptions {
	problemName: string;
	objective: 'max' | 'min';
	language: 'rust' | 'cpp' | 'python' | 'go';
	isInteractive: boolean;
	testerUrl: string;
}

export const InitializationView: React.FC = () => {
	// Get default project name from data attribute
	const defaultProjectName =
		document.getElementById('root')?.getAttribute('data-default-project-name') || '';

	const [problemName, setProblemName] = useState(defaultProjectName);
	const [objective, setObjective] = useState<'max' | 'min'>('max');
	const [language, setLanguage] = useState<'rust' | 'cpp' | 'python' | 'go'>('rust');
	const [isInteractive, setIsInteractive] = useState(false);
	const [testerUrl, setTesterUrl] = useState('');

	const handleInitialize = () => {
		if (!problemName.trim()) {
			alert('問題名を入力してください');
			return;
		}

		const options: InitOptions = {
			problemName: problemName.trim(),
			objective,
			language,
			isInteractive,
			testerUrl: testerUrl.trim(),
		};

		// @ts-expect-error - vscode API is injected
		const vscode = acquireVsCodeApi();
		vscode.postMessage({
			command: 'initialize',
			options,
		});
	};

	const containerStyle: React.CSSProperties = {
		padding: '20px',
		color: 'var(--vscode-foreground)',
		backgroundColor: 'var(--vscode-editor-background)',
		height: '100vh',
		display: 'flex',
		flexDirection: 'column',
	};

	const formStyle: React.CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		gap: '20px',
		maxWidth: '600px',
	};

	const fieldStyle: React.CSSProperties = {
		display: 'flex',
		flexDirection: 'column',
		gap: '8px',
	};

	const labelStyle: React.CSSProperties = {
		fontSize: '14px',
		fontWeight: 'bold',
	};

	const inputStyle: React.CSSProperties = {
		padding: '6px 8px',
		backgroundColor: 'var(--vscode-input-background)',
		color: 'var(--vscode-input-foreground)',
		border: '1px solid var(--vscode-input-border)',
		fontSize: '13px',
	};

	const checkboxContainerStyle: React.CSSProperties = {
		display: 'flex',
		alignItems: 'center',
		gap: '8px',
	};

	const buttonStyle: React.CSSProperties = {
		padding: '8px 16px',
		border: 'none',
		cursor: 'pointer',
		fontSize: '13px',
		backgroundColor: 'var(--vscode-button-background)',
		color: 'var(--vscode-button-foreground)',
	};

	const descriptionStyle: React.CSSProperties = {
		fontSize: '12px',
		color: 'var(--vscode-descriptionForeground)',
		marginTop: '4px',
	};

	return (
		<div style={containerStyle}>
			<h2 style={{ marginTop: 0 }}>Pahcer プロジェクトの初期化</h2>

			<div style={formStyle}>
				<div style={fieldStyle}>
					<label htmlFor="problemName" style={labelStyle}>
						問題名
					</label>
					<input
						id="problemName"
						type="text"
						value={problemName}
						onChange={(e) => setProblemName(e.target.value)}
						style={inputStyle}
						placeholder="例: ahc999"
					/>
					<div style={descriptionStyle}>AtCoderの問題名を入力してください。</div>
				</div>

				<div style={fieldStyle}>
					<label htmlFor="objective" style={labelStyle}>
						最適化の目的
					</label>
					<select
						id="objective"
						value={objective}
						onChange={(e) => setObjective(e.target.value as 'max' | 'min')}
						style={inputStyle}
					>
						<option value="max">スコアを最大化 (Max)</option>
						<option value="min">スコアを最小化 (Min)</option>
					</select>
					<div style={descriptionStyle}>問題のスコア最適化の方向を選択してください。</div>
				</div>

				<div style={fieldStyle}>
					<label htmlFor="language" style={labelStyle}>
						使用言語
					</label>
					<select
						id="language"
						value={language}
						onChange={(e) => setLanguage(e.target.value as 'rust' | 'cpp' | 'python' | 'go')}
						style={inputStyle}
					>
						<option value="rust">Rust</option>
						<option value="cpp">C++</option>
						<option value="python">Python</option>
						<option value="go">Go</option>
					</select>
					<div style={descriptionStyle}>
						プロジェクトで使用するプログラミング言語を選択してください。
					</div>
				</div>

				<div style={fieldStyle}>
					<div style={checkboxContainerStyle}>
						<input
							id="isInteractive"
							type="checkbox"
							checked={isInteractive}
							onChange={(e) => setIsInteractive(e.target.checked)}
						/>
						<label htmlFor="isInteractive" style={{ cursor: 'pointer' }}>
							インタラクティブ問題
						</label>
					</div>
					<div style={descriptionStyle}>インタラクティブ問題の場合はチェックを入れてください。</div>
				</div>

				<div style={fieldStyle}>
					<label htmlFor="testerUrl" style={labelStyle}>
						ローカルテスターURL（オプション）
					</label>
					<input
						id="testerUrl"
						type="text"
						value={testerUrl}
						onChange={(e) => setTesterUrl(e.target.value)}
						style={inputStyle}
						placeholder="例: https://img.atcoder.jp/ahc054/YDAxDRZr_v2.zip"
					/>
					<div style={descriptionStyle}>
						ローカルテスターのZIPファイルURLを入力すると、自動的にダウンロードして展開します。空欄の場合はスキップされます。
					</div>
				</div>

				<button type="button" onClick={handleInitialize} style={buttonStyle}>
					初期化
				</button>
			</div>
		</div>
	);
};
