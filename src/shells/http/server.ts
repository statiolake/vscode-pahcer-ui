import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import { CommitResultsUseCase } from '../../application/commitResultsUseCase';
import {
  ExecuteInitializeUseCase,
  GetDefaultProjectNameQuery,
  PrepareInitializeUseCase,
} from '../../application/initializeUseCase';
import { LoadPahcerTreeDataUseCase } from '../../application/loadPahcerTreeDataUseCase';
import { PrepareComparisonUseCase } from '../../application/prepareComparisonUseCase';
import {
  PrepareVisualizerSessionUseCase,
  RegisterVisualizerSourceUseCase,
} from '../../application/prepareVisualizerSessionUseCase';
import { ExecuteRunUseCase, PrepareRunUseCase } from '../../application/runPahcerUseCase';
import type { PahcerJobEvent } from '../../domain/interfaces/pahcerJob';
import { ExecutionRepository } from '../../infrastructure/executionRepository';
import { FileAnalyzer } from '../../infrastructure/fileAnalyzer';
import { GitAdapter } from '../../infrastructure/gitAdapter';
import { GitignoreAdapter } from '../../infrastructure/gitignoreAdapter';
import { InOutFilesAdapter } from '../../infrastructure/inOutFilesAdapter';
import { NodeProcessPahcerAdapter } from '../../infrastructure/node/adapters/nodeProcessPahcerAdapter';
import { FileGitIntegrationConfig } from '../../infrastructure/node/repositories/fileGitIntegrationConfig';
import { PahcerConfigRepository } from '../../infrastructure/pahcerConfigRepository';
import { TestCaseRepository } from '../../infrastructure/testCaseRepository';
import { TestCaseSummaryQueryService } from '../../infrastructure/testCaseSummaryQueryService';
import { TesterDownloader } from '../../infrastructure/testerDownloader';
import { UIConfigRepository } from '../../infrastructure/uiConfigRepository';
import { VisualizerAdapter } from '../../infrastructure/visualizerAdapter';

interface HttpShellApp {
  getDefaultProjectNameQuery: GetDefaultProjectNameQuery;
  prepareInitializeUseCase: PrepareInitializeUseCase;
  executeInitializeUseCase: ExecuteInitializeUseCase;
  prepareRunUseCase: PrepareRunUseCase;
  executeRunUseCase: ExecuteRunUseCase;
  loadPahcerTreeDataUseCase: LoadPahcerTreeDataUseCase;
  prepareComparisonUseCase: PrepareComparisonUseCase;
  prepareVisualizerSessionUseCase: PrepareVisualizerSessionUseCase;
  registerVisualizerSourceUseCase: RegisterVisualizerSourceUseCase;
  pahcerAdapter: NodeProcessPahcerAdapter;
}

interface RegisteredJob {
  subscribe: (listener: (event: PahcerJobEvent) => void) => { dispose(): void };
}

function createApp(workspaceRoot: string): HttpShellApp {
  const executionRepository = new ExecutionRepository(workspaceRoot);
  const fileAnalyzer = new FileAnalyzer();
  const inOutFilesAdapter = new InOutFilesAdapter(workspaceRoot);
  const pahcerConfigRepository = new PahcerConfigRepository(workspaceRoot);
  const gitignoreAdapter = new GitignoreAdapter(workspaceRoot);
  const gitAdapter = new GitAdapter(workspaceRoot);
  const testCaseRepository = new TestCaseRepository(inOutFilesAdapter, workspaceRoot);
  const testCaseSummaryQueryService = new TestCaseSummaryQueryService(workspaceRoot);
  const uiConfigRepository = new UIConfigRepository(workspaceRoot);
  const visualizerAdapter = new VisualizerAdapter(workspaceRoot);
  const testerDownloader = new TesterDownloader(workspaceRoot);
  const pahcerAdapter = new NodeProcessPahcerAdapter(pahcerConfigRepository, workspaceRoot);
  const gitIntegrationConfig = new FileGitIntegrationConfig(workspaceRoot);

  const commitResultsUseCase = new CommitResultsUseCase(gitAdapter, gitIntegrationConfig);

  return {
    getDefaultProjectNameQuery: new GetDefaultProjectNameQuery(
      pahcerConfigRepository,
      workspaceRoot,
    ),
    prepareInitializeUseCase: new PrepareInitializeUseCase(testerDownloader),
    executeInitializeUseCase: new ExecuteInitializeUseCase(gitignoreAdapter, pahcerAdapter),
    prepareRunUseCase: new PrepareRunUseCase(commitResultsUseCase),
    executeRunUseCase: new ExecuteRunUseCase(
      pahcerAdapter,
      commitResultsUseCase,
      inOutFilesAdapter,
      fileAnalyzer,
      executionRepository,
      testCaseRepository,
      pahcerConfigRepository,
    ),
    loadPahcerTreeDataUseCase: new LoadPahcerTreeDataUseCase(
      executionRepository,
      testCaseRepository,
      testCaseSummaryQueryService,
      pahcerConfigRepository,
    ),
    prepareComparisonUseCase: new PrepareComparisonUseCase(
      executionRepository,
      testCaseRepository,
      uiConfigRepository,
      pahcerConfigRepository,
    ),
    prepareVisualizerSessionUseCase: new PrepareVisualizerSessionUseCase(
      inOutFilesAdapter,
      executionRepository,
      visualizerAdapter,
    ),
    registerVisualizerSourceUseCase: new RegisterVisualizerSourceUseCase(visualizerAdapter),
    pahcerAdapter,
  };
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString('utf-8');
  return JSON.parse(body) as T;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function writeSse(res: ServerResponse, event: PahcerJobEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function startHttpShellServer(workspaceRoot: string, port = 3000) {
  const app = createApp(workspaceRoot);
  const jobs = new Map<string, RegisteredJob>();

  const server = createServer(async (req, res) => {
    if (!req.url || !req.method) {
      writeJson(res, 400, { error: 'Invalid request' });
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${port}`);

    try {
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Pahcer HTTP shell is running');
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/status') {
        writeJson(res, 200, { status: await app.pahcerAdapter.checkStatus() });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/initialization/defaults') {
        writeJson(res, 200, {
          defaultProjectName: await app.getDefaultProjectNameQuery.execute(),
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/initialize/prepare') {
        const body = await readJson<Parameters<PrepareInitializeUseCase['execute']>[0]>(req);
        writeJson(res, 200, await app.prepareInitializeUseCase.execute(body));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/initialize/execute') {
        const body = await readJson<Parameters<ExecuteInitializeUseCase['execute']>[0]>(req);
        const result = await app.executeInitializeUseCase.execute(body);
        jobs.set(result.job.id, result.job);
        result.job.wait().catch(() => {});
        writeJson(res, 200, { jobId: result.job.id });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/run/prepare') {
        writeJson(res, 200, await app.prepareRunUseCase.execute());
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/run/execute') {
        const body = await readJson<Parameters<ExecuteRunUseCase['execute']>[0]>(req);
        const result = await app.executeRunUseCase.execute(body);
        jobs.set(result.job.id, result.job);
        result.completion.catch(() => {});
        writeJson(res, 200, { jobId: result.job.id });
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/tree') {
        writeJson(res, 200, await app.loadPahcerTreeDataUseCase.load());
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/comparison') {
        const executionIds = url.searchParams.getAll('executionId');
        writeJson(res, 200, await app.prepareComparisonUseCase.execute(executionIds));
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/visualizer/prepare') {
        const seed = Number(url.searchParams.get('seed'));
        const executionId = url.searchParams.get('executionId') ?? undefined;
        writeJson(res, 200, await app.prepareVisualizerSessionUseCase.execute(seed, executionId));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/visualizer/source') {
        const body = await readJson<{ url: string }>(req);
        writeJson(res, 200, {
          htmlFileName: await app.registerVisualizerSourceUseCase.execute(body.url),
        });
        return;
      }

      if (req.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
        const jobId = url.pathname.replace('/api/jobs/', '').replace('/events', '');
        const job = jobs.get(jobId);
        if (!job || !url.pathname.endsWith('/events')) {
          writeJson(res, 404, { error: 'Job not found' });
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write('\n');

        const disposable = job.subscribe((event) => {
          writeSse(res, event);
        });

        req.on('close', () => {
          disposable.dispose();
          res.end();
        });
        return;
      }

      writeJson(res, 404, { error: 'Not found' });
    } catch (error) {
      writeJson(res, 500, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  server.listen(port, () => {
    console.log(`Pahcer HTTP shell listening on http://127.0.0.1:${port}`);
  });

  return server;
}

if (require.main === module) {
  const workspaceRoot = process.env.PAHCER_WORKSPACE_ROOT ?? process.cwd();
  const port = Number(process.env.PORT ?? '3000');
  startHttpShellServer(workspaceRoot, port);
}
