import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { ComparisonConfig } from '@pahcer/core/application/dtos/comparisonConfig';
import { LoadComparisonDataUseCase } from '@pahcer/core/application/loadComparisonDataUseCase';
import { LoadPahcerTreeDataUseCase } from '@pahcer/core/application/loadPahcerTreeDataUseCase';
import { ComparisonConfigRepository } from '@pahcer/node-adapters/infrastructure/comparisonConfigRepository';
import { ExecutionRepository } from '@pahcer/node-adapters/infrastructure/executionRepository';
import { InOutFilesAdapter } from '@pahcer/node-adapters/infrastructure/inOutFilesAdapter';
import { PahcerConfigRepository } from '@pahcer/node-adapters/infrastructure/pahcerConfigRepository';
import { TestCaseRepository } from '@pahcer/node-adapters/infrastructure/testCaseRepository';
import { TestCaseSummaryQueryService } from '@pahcer/node-adapters/infrastructure/testCaseSummaryQueryService';

const workspaceRoot = process.env.PAHCER_WORKSPACE || process.cwd();
const port = Number(process.env.PORT || 3000);

function createUseCases() {
  const executionRepository = new ExecutionRepository(workspaceRoot);
  const inOutFilesAdapter = new InOutFilesAdapter(workspaceRoot);
  const testCaseRepository = new TestCaseRepository(inOutFilesAdapter, workspaceRoot);
  const testCaseSummaryQueryService = new TestCaseSummaryQueryService(workspaceRoot);
  const comparisonConfigRepository = new ComparisonConfigRepository(workspaceRoot);
  const pahcerConfigRepository = new PahcerConfigRepository(workspaceRoot);

  return {
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
      sendClientScript(response);
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
      const sortOrder = requestUrl.searchParams.get('sort') || 'relativeScoreDesc';
      const cases = await useCases.tree.loadCasesForExecution(
        treeData,
        decodeURIComponent(executionCasesMatch[1]),
        sortOrder as Parameters<typeof useCases.tree.loadCasesForExecution>[2],
      );
      sendJson(response, cases ?? null);
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
      const sortOrder = requestUrl.searchParams.get('sort') || 'absoluteScoreDesc';
      const executions = await useCases.tree.loadExecutionsForSeed(
        treeData,
        Number(seedExecutionsMatch[1]),
        sortOrder as Parameters<typeof useCases.tree.loadExecutionsForSeed>[2],
      );
      sendJson(response, executions);
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname === '/api/comparison') {
      const executionIds = (requestUrl.searchParams.get('executionIds') || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
      sendJson(response, await useCases.comparison.load(executionIds));
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/api/comparison/config') {
      await useCases.comparison.saveConfig(toComparisonConfig(await readJson(request)));
      sendJson(response, { ok: true });
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

function sendClientScript(response: ServerResponse): void {
  response.writeHead(200, {
    'content-type': 'text/javascript; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(require('node:fs').readFileSync(`${__dirname}/public/app.js`, 'utf-8'));
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
    stringOrDefault(input.filter, ''),
  );
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}
