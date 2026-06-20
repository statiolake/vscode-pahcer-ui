import * as fs from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import * as path from 'node:path';
import { URL } from 'node:url';
import { CheckPahcerStatusUseCase } from '@pahcer/core/application/checkPahcerStatusUseCase';
import { CommitResultsUseCase } from '@pahcer/core/application/commitResultsUseCase';
import { CopySourceAtExecutionUseCase } from '@pahcer/core/application/copySourceAtExecutionUseCase';
import { ComparisonConfig } from '@pahcer/core/application/dtos/comparisonConfig';
import type {
  ExecutionSortOrder,
  SeedSortOrder,
} from '@pahcer/core/application/dtos/pahcerUIState';
import { InitializeUseCase } from '@pahcer/core/application/initializeUseCase';
import { LoadComparisonDataUseCase } from '@pahcer/core/application/loadComparisonDataUseCase';
import { LoadPahcerTreeDataUseCase } from '@pahcer/core/application/loadPahcerTreeDataUseCase';
import {
  type CaseFileKind,
  OpenCaseFileUseCase,
} from '@pahcer/core/application/openCaseFileUseCase';
import { RunPahcerUseCase } from '@pahcer/core/application/runPahcerUseCase';
import { ShowExecutionDiffUseCase } from '@pahcer/core/application/showExecutionDiffUseCase';
import { UpdateExecutionCommentUseCase } from '@pahcer/core/application/updateExecutionCommentUseCase';
import { VisualizerUseCase } from '@pahcer/core/application/visualizerUseCase';
import type { Execution } from '@pahcer/core/domain/models/execution';
import { PahcerRunOptions } from '@pahcer/core/domain/models/pahcerStatus';
import { ComparisonConfigRepository } from '@pahcer/node-adapters/infrastructure/comparisonConfigRepository';
import { ExecutionRepository } from '@pahcer/node-adapters/infrastructure/executionRepository';
import { FileAnalyzer } from '@pahcer/node-adapters/infrastructure/fileAnalyzer';
import { GitignoreAdapter } from '@pahcer/node-adapters/infrastructure/gitignoreAdapter';
import { InOutFilesAdapter } from '@pahcer/node-adapters/infrastructure/inOutFilesAdapter';
import { PahcerConfigRepository } from '@pahcer/node-adapters/infrastructure/pahcerConfigRepository';
import { TestCaseRepository } from '@pahcer/node-adapters/infrastructure/testCaseRepository';
import { TestCaseSummaryQueryService } from '@pahcer/node-adapters/infrastructure/testCaseSummaryQueryService';
import { TesterDownloader } from '@pahcer/node-adapters/infrastructure/testerDownloader';
import { VisualizerAdapter } from '@pahcer/node-adapters/infrastructure/visualizerAdapter';
import { WebAppConfig } from './infrastructure/webAppConfig';
import { WebGitAdapter } from './infrastructure/webGitAdapter';
import { WebPahcerAdapter } from './infrastructure/webPahcerAdapter';

const workspaceRoot = process.env.PAHCER_WORKSPACE || process.cwd();
const port = Number(process.env.PORT || 3000);
const workspaceName = path.basename(workspaceRoot);

function createUseCases() {
  const executionRepository = new ExecutionRepository(workspaceRoot);
  const inOutFilesAdapter = new InOutFilesAdapter(workspaceRoot);
  const testCaseRepository = new TestCaseRepository(inOutFilesAdapter, workspaceRoot);
  const testCaseSummaryQueryService = new TestCaseSummaryQueryService(workspaceRoot);
  const comparisonConfigRepository = new ComparisonConfigRepository(workspaceRoot);
  const pahcerConfigRepository = new PahcerConfigRepository(workspaceRoot);
  const appConfig = new WebAppConfig(workspaceRoot);
  const gitAdapter = new WebGitAdapter(workspaceRoot);
  const pahcerAdapter = new WebPahcerAdapter(pahcerConfigRepository, workspaceRoot);
  const commitResults = new CommitResultsUseCase(gitAdapter, appConfig);

  return {
    appConfig,
    executionRepository,
    gitAdapter,
    status: new CheckPahcerStatusUseCase(pahcerAdapter),
    initialize: new InitializeUseCase(
      new TesterDownloader(workspaceRoot),
      new GitignoreAdapter(workspaceRoot),
      pahcerAdapter,
      pahcerConfigRepository,
      workspaceName,
    ),
    run: new RunPahcerUseCase(
      pahcerAdapter,
      commitResults,
      inOutFilesAdapter,
      new FileAnalyzer(),
      executionRepository,
      testCaseRepository,
      pahcerConfigRepository,
    ),
    tree: new LoadPahcerTreeDataUseCase(
      executionRepository,
      testCaseRepository,
      testCaseSummaryQueryService,
      pahcerConfigRepository,
    ),
    comparison: new LoadComparisonDataUseCase(
      executionRepository,
      testCaseRepository,
      comparisonConfigRepository,
      pahcerConfigRepository,
    ),
    updateComment: new UpdateExecutionCommentUseCase(executionRepository),
    openCaseFile: new OpenCaseFileUseCase(inOutFilesAdapter),
    copySource: new CopySourceAtExecutionUseCase(executionRepository, gitAdapter),
    diff: new ShowExecutionDiffUseCase(executionRepository, gitAdapter),
    visualizer: new VisualizerUseCase(
      inOutFilesAdapter,
      executionRepository,
      new VisualizerAdapter(workspaceRoot),
    ),
  };
}

const useCases = createUseCases();

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

    if (request.method === 'GET' && requestUrl.pathname === '/') {
      sendHtml(response);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/app.js') {
      await sendClientScript(response);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/status') {
      sendJson(response, {
        status: await useCases.status.check(),
        defaultProjectName: await useCases.initialize.getDefaultProjectName(),
        preferences: await useCases.appConfig.preferences(),
        workspaceRoot,
      });
      return;
    }

    if (request.method === 'PATCH' && requestUrl.pathname === '/api/preferences') {
      sendJson(response, await useCases.appConfig.updatePreferences(await readObject(request)));
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/initialize') {
      const body = await readObject(request);
      await useCases.initialize.handle({
        problemName: stringOrDefault(body.problemName, workspaceName),
        objective: body.objective === 'min' ? 'min' : 'max',
        language: toLanguage(body.language),
        isInteractive: body.isInteractive === true,
        testerUrl: stringOrDefault(body.testerUrl, ''),
        confirmToUseDetected: async () => body.useDetectedInteractive === true,
      });
      sendJson(response, { ok: true });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/run') {
      const body = await readObject(request);
      const result = await useCases.run.handle({
        options: new PahcerRunOptions(
          optionalNumber(body.startSeed),
          optionalNumber(body.endSeed),
          body.freezeBestScores === true,
        ),
        confirmGitIntegration: async () => body.enableGitIntegration === true,
      });
      sendJson(response, result);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/tree') {
      const treeData = await useCases.tree.load();
      sendJson(response, {
        ...treeData,
        bestScores: Object.fromEntries(treeData.bestScores),
      });
      return;
    }

    const executionCasesMatch = requestUrl.pathname.match(/^\/api\/executions\/([^/]+)\/cases$/);
    if (request.method === 'GET' && executionCasesMatch) {
      const treeData = await useCases.tree.load();
      const sortOrder = toExecutionSortOrder(requestUrl.searchParams.get('sort'));
      sendJson(
        response,
        (await useCases.tree.loadCasesForExecution(
          treeData,
          decodeURIComponent(executionCasesMatch[1]),
          sortOrder,
        )) ?? null,
      );
      return;
    }

    const commentMatch = requestUrl.pathname.match(/^\/api\/executions\/([^/]+)\/comment$/);
    if (request.method === 'POST' && commentMatch) {
      const body = await readObject(request);
      const ok = await useCases.updateComment.update(
        decodeURIComponent(commentMatch[1]),
        stringOrDefault(body.comment, ''),
      );
      sendJson(response, { ok }, ok ? 200 : 404);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/seeds') {
      const treeData = await useCases.tree.load();
      sendJson(response, useCases.tree.loadSeeds(treeData));
      return;
    }

    const seedExecutionsMatch = requestUrl.pathname.match(/^\/api\/seeds\/(\d+)\/executions$/);
    if (request.method === 'GET' && seedExecutionsMatch) {
      const treeData = await useCases.tree.load();
      const sortOrder = toSeedSortOrder(requestUrl.searchParams.get('sort'));
      sendJson(
        response,
        await useCases.tree.loadExecutionsForSeed(
          treeData,
          Number(seedExecutionsMatch[1]),
          sortOrder,
        ),
      );
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/comparison') {
      sendJson(response, await useCases.comparison.load(readExecutionIds(requestUrl)));
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/comparison/config') {
      await useCases.comparison.saveConfig(toComparisonConfig(await readJson(request)));
      sendJson(response, { ok: true });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/case-file') {
      const resolvedPath = useCases.openCaseFile.resolvePath({
        kind: toCaseFileKind(requestUrl.searchParams.get('kind')),
        executionId: optionalString(requestUrl.searchParams.get('executionId')),
        seed: Number(requestUrl.searchParams.get('seed')),
      });
      if (!resolvedPath) {
        sendJson(response, { error: 'ファイルを特定できませんでした' }, 400);
        return;
      }
      sendJson(response, {
        path: resolvedPath,
        content: await readTextIfExists(resolvedPath),
      });
      return;
    }

    const sourcePrepareMatch = requestUrl.pathname.match(/^\/api\/source\/([^/]+)\/prepare$/);
    if (request.method === 'GET' && sourcePrepareMatch) {
      sendJson(
        response,
        await useCases.copySource.prepare(decodeURIComponent(sourcePrepareMatch[1])),
      );
      return;
    }

    const sourceContentMatch = requestUrl.pathname.match(/^\/api\/source\/([^/]+)\/content$/);
    if (request.method === 'GET' && sourceContentMatch) {
      const executionId = decodeURIComponent(sourceContentMatch[1]);
      const file = requestUrl.searchParams.get('file') || '';
      sendJson(response, {
        file,
        content: (await useCases.copySource.loadContent(executionId, file)) ?? '',
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/diff') {
      const executionIds = readExecutionIds(requestUrl);
      const result = await useCases.diff.showDiff(executionIds);
      if (result.status !== 'shown') {
        sendJson(response, result);
        return;
      }
      const executions = await Promise.all(
        executionIds.map((executionId) => useCases.executionRepository.findById(executionId)),
      );
      const sorted = executions
        .filter(hasCommitHash)
        .sort((a, b) => a.startTime.valueOf() - b.startTime.valueOf());
      const older = sorted[0];
      const newer = sorted[1];
      if (!older || !newer) {
        sendJson(response, { status: 'missingCommitHash' });
        return;
      }
      sendJson(response, {
        status: 'shown',
        files: await useCases.gitAdapter.getDiffFiles(older.commitHash, newer.commitHash),
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/visualizer/status') {
      sendJson(response, { htmlFileName: await useCases.visualizer.getCachedHtmlFileName() });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/visualizer/download') {
      const body = await readObject(request);
      sendJson(response, {
        htmlFileName: await useCases.visualizer.download(stringOrDefault(body.url, '')),
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/visualizer/frame') {
      const seed = Number(requestUrl.searchParams.get('seed'));
      const executionId = requestUrl.searchParams.get('executionId') || '';
      const htmlFileName =
        requestUrl.searchParams.get('htmlFileName') ||
        (await useCases.visualizer.getCachedHtmlFileName());
      if (!htmlFileName) {
        sendJson(response, { error: 'ビジュアライザ HTML がありません' }, 404);
        return;
      }
      const caseData = await useCases.visualizer.loadCaseData(seed, executionId);
      const preferences = await useCases.appConfig.preferences();
      const html = injectVisualizerData(
        await rewriteVisualizerResourcePaths(await useCases.visualizer.readHtml(htmlFileName)),
        seed,
        caseData.input,
        caseData.output,
        preferences.visualizerZoomLevel,
      );
      response.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      });
      response.end(html);
      return;
    }

    const visualizerResourceMatch = requestUrl.pathname.match(/^\/visualizer-resource\/([^/]+)$/);
    if (request.method === 'GET' && visualizerResourceMatch) {
      const fileName = decodeURIComponent(visualizerResourceMatch[1]);
      if (!(await useCases.visualizer.resourceExists(fileName))) {
        sendJson(response, { error: 'Not found' }, 404);
        return;
      }
      response.writeHead(200, { 'cache-control': 'no-store' });
      response.end(await fs.readFile(useCases.visualizer.getResourcePath(fileName)));
      return;
    }

    sendJson(response, { error: 'Not found' }, 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(response, { error: message }, 500);
  }
});

server.listen(port, () => {
  console.log(`Pahcer Web interface: http://localhost:${port}`);
  console.log(`Workspace: ${workspaceRoot}`);
});

function sendHtml(response: ServerResponse): void {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pahcer UI</title>
  </head>
  <body>
    <div id="root"></div>
    <script src="/app.js"></script>
  </body>
</html>`);
}

async function sendClientScript(response: ServerResponse): Promise<void> {
  response.writeHead(200, {
    'content-type': 'text/javascript; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(await fs.readFile(`${__dirname}/public/app.js`, 'utf-8'));
}

function sendJson(response: ServerResponse, data: unknown, status = 200): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(data));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf-8');
  return body ? JSON.parse(body) : {};
}

async function readObject(request: IncomingMessage): Promise<Record<string, unknown>> {
  const value = await readJson(request);
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

async function readTextIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function readExecutionIds(requestUrl: URL): string[] {
  return (requestUrl.searchParams.get('executionIds') || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function toComparisonConfig(value: unknown): ComparisonConfig {
  if (!value || typeof value !== 'object') {
    return new ComparisonConfig();
  }
  const input = value as Partial<Record<keyof ComparisonConfig, unknown>>;
  return new ComparisonConfig(
    stringOrDefault(input.featureString, 'N M K'),
    stringOrDefault(input.xAxis, 'seed'),
    stringOrDefault(input.yAxis, 'avg(absScore)'),
    input.chartType === 'scatter' ? 'scatter' : 'line',
    booleanOrDefault(input.skipFailed, true),
    stringOrDefault(input.filter, ''),
  );
}

function booleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toLanguage(value: unknown): 'rust' | 'cpp' | 'python' | 'go' {
  return value === 'cpp' || value === 'python' || value === 'go' ? value : 'rust';
}

function toCaseFileKind(value: unknown): CaseFileKind {
  return value === 'output' || value === 'error' ? value : 'input';
}

function toExecutionSortOrder(value: unknown): ExecutionSortOrder {
  return value === 'seedDesc' ||
    value === 'relativeScoreAsc' ||
    value === 'relativeScoreDesc' ||
    value === 'absoluteScoreAsc' ||
    value === 'absoluteScoreDesc'
    ? value
    : 'seedAsc';
}

function toSeedSortOrder(value: unknown): SeedSortOrder {
  return value === 'executionDesc' || value === 'absoluteScoreAsc' || value === 'absoluteScoreDesc'
    ? value
    : 'executionAsc';
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function hasCommitHash(execution: Execution | undefined): execution is Execution & {
  commitHash: string;
} {
  return typeof execution?.commitHash === 'string' && execution.commitHash.length > 0;
}

function rewriteVisualizerResourcePaths(html: string): string {
  return html
    .replace(/src=["']\.\/([^"']+)["']/g, (_match, fileName: string) => {
      return `src="/visualizer-resource/${encodeURIComponent(fileName)}"`;
    })
    .replace(/src=["']\/\/img\.atcoder\.jp\/[^"']*\/([^"'/]+)["']/g, (_match, fileName: string) => {
      return `src="/visualizer-resource/${encodeURIComponent(fileName)}"`;
    })
    .replace(/from\s+["']\.\/([^"']+\.js)["']/g, (_match, fileName: string) => {
      return `from "/visualizer-resource/${encodeURIComponent(fileName)}"`;
    });
}

function injectVisualizerData(
  html: string,
  seed: number,
  input: string,
  output: string,
  initialZoomLevel: number,
): string {
  const injection = `<script>
window.PAHCER_SEED = ${JSON.stringify(seed)};
window.PAHCER_INPUT = ${JSON.stringify(input)};
window.PAHCER_OUTPUT = ${JSON.stringify(output)};
window.addEventListener('DOMContentLoaded', () => {
  const seedInput = document.getElementById('seed');
  const inputTextarea = document.getElementById('input');
  const outputTextarea = document.getElementById('output');
  if (seedInput) {
    seedInput.value = String(window.PAHCER_SEED);
    seedInput.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (inputTextarea) {
    inputTextarea.value = window.PAHCER_INPUT || '';
    inputTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  if (outputTextarea) {
    outputTextarea.value = window.PAHCER_OUTPUT || '';
    outputTextarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  let zoomLevel = ${JSON.stringify(initialZoomLevel)};
  const controls = document.createElement('div');
  controls.style.cssText = 'position:fixed;top:10px;right:10px;z-index:10000;background:rgba(30,30,30,.85);color:white;padding:6px;border-radius:4px;font-family:sans-serif;display:flex;gap:4px;align-items:center';
  const display = document.createElement('span');
  display.style.cssText = 'min-width:44px;text-align:center;font-size:12px';
  const apply = () => {
    document.body.style.transformOrigin = 'top left';
    document.body.style.transform = 'scale(' + zoomLevel + ')';
    document.body.style.width = (100 / zoomLevel) + '%';
    display.textContent = Math.round(zoomLevel * 100) + '%';
    fetch('/api/preferences', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visualizerZoomLevel: zoomLevel })
    }).catch(() => {});
  };
  for (const item of [['-', -0.1], ['+', 0.1], ['100%', 0]]) {
    const button = document.createElement('button');
    button.textContent = item[0];
    button.style.cssText = 'height:24px;border:0;border-radius:3px;background:#4d4d4d;color:white;padding:2px 8px';
    button.onclick = () => {
      zoomLevel = item[1] === 0 ? 1 : Math.min(3, Math.max(0.5, zoomLevel + item[1]));
      apply();
    };
    controls.appendChild(button);
    if (item[0] === '-') controls.appendChild(display);
  }
  document.body.appendChild(controls);
  apply();
});
</script>`;
  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}</head>`);
  }
  if (html.includes('<body>')) {
    return html.replace('<body>', `<body>${injection}`);
  }
  return injection + html;
}
