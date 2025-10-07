// VSCode API wrapper for webview
declare function acquireVsCodeApi(): {
	postMessage(message: unknown): void;
	getState(): unknown;
	setState(state: unknown): void;
};

export const vscode = acquireVsCodeApi();

export function postMessage(message: unknown): void {
	vscode.postMessage(message);
}
