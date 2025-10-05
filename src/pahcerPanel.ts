import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface PahcerResult {
    start_time: string;
    case_count: number;
    total_score: number;
    total_score_log10: number;
    total_relative_score: number;
    max_execution_time: number;
    comment: string;
    tag_name: string | null;
    wa_seeds: number[];
    cases: Array<{
        seed: number;
        score: number;
        relative_score: number;
        execution_time: number;
        error_message: string;
    }>;
}

export class PahcerPanel {
    public static currentPanel: PahcerPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (PahcerPanel.currentPanel) {
            PahcerPanel.currentPanel._panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'pahcerResults',
            'Pahcer Results',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [extensionUri],
                retainContextWhenHidden: true
            }
        );

        PahcerPanel.currentPanel = new PahcerPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'runPahcer':
                        this.runPahcer();
                        return;
                    case 'refresh':
                        this._update();
                        return;
                    case 'showCaseDetails':
                        this.showCaseDetails(message.result);
                        return;
                }
            },
            null,
            this._disposables
        );
    }

    private async runPahcer() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('ワークスペースが開かれていません');
            return;
        }

        const terminal = vscode.window.createTerminal({
            name: 'Pahcer Run',
            cwd: workspaceFolder.uri.fsPath
        });

        terminal.show();
        terminal.sendText('pahcer run');

        // ターミナルが閉じられたらパネルを更新
        vscode.window.onDidCloseTerminal(t => {
            if (t === terminal) {
                setTimeout(() => this._update(), 1000);
            }
        });
    }

    private showCaseDetails(result: PahcerResult) {
        const cases = result.cases.map((c, idx) =>
            `**Case ${idx}** (Seed: ${c.seed})\n` +
            `- Score: ${c.score}\n` +
            `- Relative Score: ${c.relative_score.toFixed(3)}\n` +
            `- Execution Time: ${(c.execution_time * 1000).toFixed(2)}ms\n` +
            (c.error_message ? `- Error: ${c.error_message}\n` : '')
        ).join('\n');

        const markdown = new vscode.MarkdownString(cases);
        markdown.supportHtml = true;

        const panel = vscode.window.createWebviewPanel(
            'pahcerCaseDetails',
            `Details: ${new Date(result.start_time).toLocaleString()}`,
            vscode.ViewColumn.Beside,
            {}
        );

        panel.webview.html = this.getCaseDetailsHtml(result);
    }

    private getCaseDetailsHtml(result: PahcerResult): string {
        const casesHtml = result.cases.map(c => `
            <tr class="${c.score === 0 ? 'error-case' : ''}">
                <td>${c.seed}</td>
                <td>${c.score.toLocaleString()}</td>
                <td>${c.relative_score.toFixed(3)}</td>
                <td>${(c.execution_time * 1000).toFixed(2)} ms</td>
                <td>${c.error_message || '-'}</td>
            </tr>
        `).join('');

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 20px;
                    }
                    th, td {
                        padding: 8px;
                        text-align: left;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    th {
                        background-color: var(--vscode-editor-background);
                        font-weight: bold;
                    }
                    .error-case {
                        background-color: rgba(255, 0, 0, 0.1);
                    }
                    h1 {
                        color: var(--vscode-foreground);
                    }
                    .summary {
                        margin-bottom: 20px;
                        padding: 15px;
                        background-color: var(--vscode-editor-background);
                        border-radius: 4px;
                    }
                </style>
            </head>
            <body>
                <h1>Test Case Details</h1>
                <div class="summary">
                    <p><strong>Time:</strong> ${new Date(result.start_time).toLocaleString()}</p>
                    <p><strong>Total Cases:</strong> ${result.case_count}</p>
                    <p><strong>AC:</strong> ${result.case_count - result.wa_seeds.length}/${result.case_count}</p>
                    <p><strong>Average Score:</strong> ${(result.total_score / result.case_count).toFixed(2)}</p>
                    <p><strong>Comment:</strong> ${result.comment || '-'}</p>
                    ${result.tag_name ? `<p><strong>Tag:</strong> ${result.tag_name}</p>` : ''}
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Seed</th>
                            <th>Score</th>
                            <th>Relative Score</th>
                            <th>Execution Time</th>
                            <th>Error</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${casesHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;
    }

    public dispose() {
        PahcerPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    private async _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);

        // Load results
        const results = await this.loadResults();
        webview.postMessage({ command: 'updateResults', results });
    }

    private async loadResults(): Promise<PahcerResult[]> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return [];
        }

        const jsonDir = path.join(workspaceFolder.uri.fsPath, 'pahcer', 'json');

        if (!fs.existsSync(jsonDir)) {
            return [];
        }

        const files = fs.readdirSync(jsonDir)
            .filter(f => f.startsWith('result_') && f.endsWith('.json'))
            .sort()
            .reverse()
            .slice(0, 10);

        const results: PahcerResult[] = [];
        for (const file of files) {
            try {
                const content = fs.readFileSync(path.join(jsonDir, file), 'utf-8');
                results.push(JSON.parse(content));
            } catch (e) {
                console.error(`Failed to load ${file}:`, e);
            }
        }

        return results;
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pahcer Results</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 20px;
                        color: var(--vscode-foreground);
                    }
                    .toolbar {
                        margin-bottom: 20px;
                        display: flex;
                        gap: 10px;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 16px;
                        cursor: pointer;
                        border-radius: 2px;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-top: 10px;
                    }
                    th, td {
                        padding: 8px;
                        text-align: left;
                        border: 1px solid var(--vscode-panel-border);
                    }
                    th {
                        background-color: var(--vscode-editor-background);
                        font-weight: bold;
                    }
                    tr:hover {
                        background-color: var(--vscode-list-hoverBackground);
                        cursor: pointer;
                    }
                    .ac-all {
                        color: var(--vscode-terminal-ansiGreen);
                    }
                    .ac-partial {
                        color: var(--vscode-terminal-ansiYellow);
                    }
                    .best-score {
                        color: var(--vscode-terminal-ansiGreen);
                        font-weight: bold;
                    }
                    .loading {
                        text-align: center;
                        padding: 20px;
                        color: var(--vscode-descriptionForeground);
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <button onclick="runPahcer()">Run Pahcer</button>
                    <button onclick="refresh()">Refresh</button>
                </div>
                <div id="results">
                    <div class="loading">Loading results...</div>
                </div>
                <script>
                    const vscode = acquireVsCodeApi();

                    function runPahcer() {
                        vscode.postMessage({ command: 'runPahcer' });
                    }

                    function refresh() {
                        vscode.postMessage({ command: 'refresh' });
                    }

                    function showDetails(result) {
                        vscode.postMessage({ command: 'showCaseDetails', result });
                    }

                    window.addEventListener('message', event => {
                        const message = event.data;
                        if (message.command === 'updateResults') {
                            displayResults(message.results);
                        }
                    });

                    function displayResults(results) {
                        if (!results || results.length === 0) {
                            document.getElementById('results').innerHTML =
                                '<div class="loading">No results found. Run "pahcer run" first.</div>';
                            return;
                        }

                        // Find best scores
                        const bestAvgScore = Math.max(...results.map(r =>
                            r.case_count > 0 ? r.total_score / r.case_count : 0
                        ));

                        const tableRows = results.map(result => {
                            const time = new Date(result.start_time).toLocaleString();
                            const acCount = result.case_count - result.wa_seeds.length;
                            const acClass = result.wa_seeds.length === 0 ? 'ac-all' : 'ac-partial';
                            const avgScore = result.case_count > 0 ?
                                (result.total_score / result.case_count).toFixed(2) : '0.00';
                            const isBest = parseFloat(avgScore) === bestAvgScore;
                            const avgRel = result.case_count > 0 ?
                                (result.total_relative_score / result.case_count).toFixed(3) : '0.000';
                            const maxTime = (result.max_execution_time * 1000).toFixed(0);
                            const tag = result.tag_name ? result.tag_name.replace('pahcer/', '') : '-';

                            return \`
                                <tr onclick='showDetails(\${JSON.stringify(result).replace(/'/g, "&apos;")})'>
                                    <td>\${time}</td>
                                    <td class="\${acClass}">\${acCount}/\${result.case_count}</td>
                                    <td class="\${isBest ? 'best-score' : ''}">\${avgScore}</td>
                                    <td>\${avgRel}</td>
                                    <td>\${maxTime} ms</td>
                                    <td>\${tag}</td>
                                    <td>\${result.comment || ''}</td>
                                </tr>
                            \`;
                        }).join('');

                        document.getElementById('results').innerHTML = \`
                            <table>
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>AC/All</th>
                                        <th>Avg Score</th>
                                        <th>Avg Rel.</th>
                                        <th>Max Time</th>
                                        <th>Tag</th>
                                        <th>Comment</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    \${tableRows}
                                </tbody>
                            </table>
                        \`;
                    }
                </script>
            </body>
            </html>
        `;
    }
}
