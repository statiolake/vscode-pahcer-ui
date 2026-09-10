import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import type { TreeExecutionCases } from '@pahcer/core/application/dtos/pahcerTreeData';
import { buildPahcerUIPath, type PahcerUIRoute } from '@pahcer/core/application/dtos/pahcerUIRoute';
import type {
  ExecutionSortOrder,
  GroupingMode,
  SeedSortOrder,
} from '@pahcer/core/application/dtos/pahcerUIState';
import type { CaseFileKind } from '@pahcer/core/application/openCaseFileUseCase';
import { PahcerRunOptions } from '@pahcer/core/domain/models/pahcerStatus';
import {
  createPahcerRuntime,
  type PahcerRuntime,
} from '@pahcer/node-adapters/infrastructure/pahcerRuntime';

type Objective = 'max' | 'min';
type Language = 'rust' | 'cpp' | 'python' | 'go';
type OutputFormat = 'text' | 'json';

interface ServerState {
  pid: number;
  port: number;
  host: string;
  url: string;
  workspaceRoot: string;
  startedAt: string;
}

interface CliOptions {
  workspacePath?: string;
  problem?: string;
  objective?: Objective;
  language?: Language;
  testerUrl?: string;
  interactive?: boolean;
  host?: string;
  port?: number;
  noOpen?: boolean;
  format: OutputFormat;
  startSeed?: number;
  endSeed?: number;
  freezeBestScores?: boolean;
  gitIntegration?: boolean;
  groupingMode?: GroupingMode;
  sortOrder?: ExecutionSortOrder | SeedSortOrder;
  kind?: CaseFileKind;
  file?: string;
  zoom?: number;
}

interface ParsedCommand {
  command: string;
  positionals: string[];
  options: CliOptions;
}

class CliError extends Error {}

const COMMANDS = new Set([
  'help',
  'init',
  'open',
  'view',
  'start',
  'server',
  'status',
  'url',
  'stop',
  'restart',
  'run',
  'results',
  'tree',
  'cases',
  'case',
  'comment',
  'source',
  'diff',
  'visualizer',
  'preferences',
  'group',
  'sort',
]);

const SERVER_STATE_FILE = path.join('.pahcer-ui', 'server.json');
const SERVER_LOCK_FILE = path.join('.pahcer-ui', 'server.lock');
/**
 * Server stdout/stderr log.
 *
 * Unlike the state and lock files, this one deliberately survives `stop`: it is
 * the only record of why a server crashed or failed to start, and deleting it
 * would throw that evidence away.
 */
const SERVER_LOG_FILE = path.join('.pahcer-ui', 'server.log');

async function main(): Promise<void> {
  const parsed = parseCommand(process.argv.slice(2));

  if (parsed.command === 'help' || parsed.command === '--help' || parsed.command === '-h') {
    printHelp();
    return;
  }

  const workspaceRoot = await resolveWorkspaceRoot(parsed.command, parsed.options.workspacePath);

  if (parsed.command === 'init') {
    await initializeWorkspace(workspaceRoot, parsed.options);
    return;
  }

  switch (parsed.command) {
    case 'open':
      await openBrowserView(workspaceRoot, parsed.options, { kind: 'home' });
      return;
    case 'view':
      await viewCommand(workspaceRoot, parsed.positionals, parsed.options);
      return;
    case 'start':
    case 'server': {
      const state = await ensureServer(workspaceRoot, parsed.options);
      printServerState(state, parsed.options.format);
      return;
    }
    case 'status':
      await showStatus(workspaceRoot, parsed.options.format);
      return;
    case 'url': {
      const state = await readHealthyState(workspaceRoot);
      if (!state) {
        throw new CliError('The Pahcer UI server is not running. Run `pahcer-ui start` first.');
      }
      console.log(state.url);
      return;
    }
    case 'stop':
      await stopServer(workspaceRoot);
      return;
    case 'restart':
      await stopServer(workspaceRoot, true);
      await openBrowserView(workspaceRoot, parsed.options, { kind: 'home' });
      return;
    case 'run':
      await runCommand(workspaceRoot, parsed.options);
      return;
    case 'results':
    case 'tree':
      await printResults(workspaceRoot, parsed.options);
      return;
    case 'cases':
      await printCases(workspaceRoot, parsed.positionals, parsed.options);
      return;
    case 'case':
      await printCaseFile(workspaceRoot, parsed.positionals, parsed.options);
      return;
    case 'comment':
      await updateComment(workspaceRoot, parsed.positionals);
      return;
    case 'source':
      await printSource(workspaceRoot, parsed.positionals, parsed.options);
      return;
    case 'diff':
      await printDiff(workspaceRoot, parsed.positionals, parsed.options);
      return;
    case 'visualizer':
      await visualizerCommand(workspaceRoot, parsed.positionals, parsed.options);
      return;
    case 'preferences':
      await updatePreferences(workspaceRoot, parsed.options, parsed.positionals);
      return;
    case 'group':
      await updateGrouping(workspaceRoot, parsed.positionals);
      return;
    case 'sort':
      await updateSortOrder(workspaceRoot, parsed.positionals);
      return;
    default:
      throw new CliError(`Unknown subcommand: ${parsed.command}\n\n${helpText()}`);
  }
}

function parseCommand(args: string[]): ParsedCommand {
  let command = 'help';
  let commandSpecified = false;
  let parsingOptions = true;
  const positionals: string[] = [];
  const options: CliOptions = { format: 'text' };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument) {
      continue;
    }

    if (argument === '--') {
      parsingOptions = false;
      continue;
    }

    if (parsingOptions && (argument === '--help' || argument === '-h')) {
      command = 'help';
      commandSpecified = true;
      continue;
    }

    if (!commandSpecified && parsingOptions && !argument.startsWith('-')) {
      command = argument;
      commandSpecified = true;
      continue;
    }

    if (parsingOptions && (argument === '--workspace' || argument === '-C')) {
      options.workspacePath = requireOptionValue(args, ++index, argument);
      continue;
    }

    if (parsingOptions && argument.startsWith('--workspace=')) {
      options.workspacePath = optionInlineValue(argument, '--workspace');
      continue;
    }

    if (!parsingOptions || !argument.startsWith('-')) {
      positionals.push(argument);
      continue;
    }

    const [name, inlineValue] = argument.split('=', 2);
    if (name === '--no-open') {
      options.noOpen = true;
      continue;
    }
    if (name === '--interactive') {
      options.interactive = true;
      continue;
    }
    if (name === '--non-interactive') {
      options.interactive = false;
      continue;
    }
    if (name === '--freeze-best-scores') {
      options.freezeBestScores = true;
      continue;
    }
    if (name === '--git') {
      options.gitIntegration = true;
      continue;
    }
    if (name === '--no-git') {
      options.gitIntegration = false;
      continue;
    }
    if (name === '--json') {
      options.format = 'json';
      continue;
    }

    const value = inlineValue ?? requireOptionValue(args, ++index, name);
    switch (name) {
      case '--problem':
        options.problem = value;
        break;
      case '--objective':
        options.objective = parseObjective(value);
        break;
      case '--lang':
      case '--language':
        options.language = parseLanguage(value);
        break;
      case '--tester-url':
        options.testerUrl = value;
        break;
      case '--host':
        options.host = value;
        break;
      case '--port':
        options.port = parsePort(value);
        break;
      case '--format':
        options.format = parseFormat(value);
        break;
      case '--start-seed':
        options.startSeed = parseSeed(value, name);
        break;
      case '--end-seed':
        options.endSeed = parseSeed(value, name);
        break;
      case '--grouping':
        options.groupingMode = parseGroupingMode(value);
        break;
      case '--sort':
      case '--execution-sort':
      case '--seed-sort':
        options.sortOrder = parseSortOrder(value);
        break;
      case '--kind':
        options.kind = parseCaseFileKind(value);
        break;
      case '--file':
        options.file = value;
        break;
      case '--zoom':
        options.zoom = parseZoom(value);
        break;
      default:
        throw new CliError(`Unknown option: ${name}`);
    }
  }

  if (!COMMANDS.has(command)) {
    throw new CliError(`Unknown subcommand: ${command}\n\n${helpText()}`);
  }

  return { command, positionals, options };
}

async function resolveWorkspaceRoot(command: string, workspacePath?: string): Promise<string> {
  const startDirectory = path.resolve(workspacePath ?? process.cwd());
  const stats = await fs.stat(startDirectory).catch(() => undefined);
  if (!stats?.isDirectory()) {
    throw new CliError(`Workspace directory does not exist: ${startDirectory}`);
  }

  if (workspacePath) {
    if (command === 'init') {
      return startDirectory;
    }
    if (await fileExists(path.join(startDirectory, 'pahcer_config.toml'))) {
      return startDirectory;
    }
    throw new CliError(
      `pahcer_config.toml was not found in ${startDirectory}. Run pahcer-ui init --workspace ${startDirectory} first.`,
    );
  }

  if (command === 'init') {
    return (await findWorkspaceRoot(startDirectory)) ?? startDirectory;
  }

  const workspaceRoot = await findWorkspaceRoot(startDirectory);
  if (!workspaceRoot) {
    throw new CliError(
      'pahcer_config.toml was not found. Run `pahcer-ui init` or pass `--workspace <path>`.',
    );
  }
  return workspaceRoot;
}

async function initializeWorkspace(workspaceRoot: string, options: CliOptions): Promise<void> {
  if (await fileExists(path.join(workspaceRoot, 'pahcer_config.toml'))) {
    throw new CliError(`This workspace is already initialized: ${workspaceRoot}`);
  }

  const reader = input.isTTY && output.isTTY ? createInterface({ input, output }) : undefined;

  try {
    const problem =
      options.problem ??
      (reader
        ? await ask(reader, 'Problem name', path.basename(workspaceRoot))
        : path.basename(workspaceRoot));
    const objective: Objective =
      options.objective ??
      (reader
        ? await askChoice(reader, 'Optimization objective (max/min)', 'max', ['max', 'min'])
        : 'max');
    const language: Language =
      options.language ??
      (reader
        ? await askChoice(reader, 'Language (rust/cpp/python/go)', 'rust', [
            'rust',
            'cpp',
            'python',
            'go',
          ])
        : 'rust');
    const interactive =
      options.interactive ??
      (reader
        ? (await ask(reader, 'Interactive problem? (y/N)', 'N')).toLowerCase() === 'y'
        : false);
    const testerUrl =
      options.testerUrl ?? (reader ? await ask(reader, 'Tester URL (optional)', '') : '');

    const runtime = createPahcerRuntime(workspaceRoot, { streamPahcerOutput: true });
    await runtime.initialize.handle({
      problemName: problem,
      objective,
      language,
      isInteractive: interactive,
      testerUrl,
      confirmToUseDetected: async (_selected, detected) => {
        if (!reader) {
          return false;
        }
        const answer = await ask(
          reader,
          `The tester appears to be ${detected ? 'interactive' : 'non-interactive'}; use the detected setting? (y/N)`,
          'N',
        );
        return answer.toLowerCase() === 'y';
      },
    });
    console.log(`Initialized workspace: ${workspaceRoot}`);
    console.log('Run `pahcer-ui open` to open the Web UI.');
  } finally {
    reader?.close();
  }
}

async function runCommand(workspaceRoot: string, options: CliOptions): Promise<void> {
  const runtime = createPahcerRuntime(workspaceRoot, { streamPahcerOutput: true });
  const status = await runtime.status.check();
  if (status !== 'ready') {
    throw new CliError(`Pahcer is not ready in this workspace (${status}).`);
  }

  const gitIntegration = await resolveGitIntegration(runtime, options);
  console.error('Running pahcer...');
  const result = await runtime.run.handle({
    options: new PahcerRunOptions(
      options.startSeed,
      options.endSeed,
      options.freezeBestScores === true,
    ),
    confirmGitIntegration: async () => gitIntegration,
  });

  if (options.format === 'json') {
    printJson(result);
    return;
  }

  for (const message of result.messages) {
    console.log(message);
  }
  console.log('Run completed.');
}

async function resolveGitIntegration(
  runtime: PahcerRuntime,
  options: CliOptions,
): Promise<boolean> {
  if (options.gitIntegration !== undefined) {
    await runtime.appConfig.setGitIntegration(options.gitIntegration);
    return options.gitIntegration;
  }

  const current = await runtime.appConfig.gitIntegration();
  if (current !== null) {
    return current;
  }

  if (!input.isTTY || !output.isTTY) {
    await runtime.appConfig.setGitIntegration(false);
    return false;
  }

  const reader = createInterface({ input, output });
  try {
    const answer = await ask(reader, 'Enable Git integration? (y/N)', 'N');
    const enabled = answer.toLowerCase() === 'y';
    await runtime.appConfig.setGitIntegration(enabled);
    return enabled;
  } finally {
    reader.close();
  }
}

async function printResults(workspaceRoot: string, options: CliOptions): Promise<void> {
  const runtime = createPahcerRuntime(workspaceRoot);
  const tree = await runtime.tree.load();
  const result = {
    objective: tree.objective,
    executions: tree.executions,
    testCases: tree.testCases,
    executionStatsList: tree.executionStatsList,
    bestScores: Object.fromEntries(tree.bestScores),
  };

  if (options.format === 'json') {
    printJson(result);
    return;
  }

  if (tree.executionStatsList.length === 0) {
    console.log('No execution results.');
    return;
  }

  console.log('ID\tAverage\tRelative\tCases\tFailed\tComment');
  for (const stats of tree.executionStatsList) {
    console.log(
      [
        stats.execution.id,
        stats.averageScore.toFixed(2),
        `${stats.averageRelativeScore.toFixed(2)}%`,
        stats.caseCount,
        stats.waSeeds.length,
        stats.execution.comment,
      ].join('\t'),
    );
  }
}

async function printCases(
  workspaceRoot: string,
  positionals: string[],
  options: CliOptions,
): Promise<void> {
  const executionId = requirePositional(positionals, 0, 'execution id');
  const runtime = createPahcerRuntime(workspaceRoot);
  const preferences = await runtime.appConfig.preferences();
  const tree = await runtime.tree.load();
  const cases = await runtime.tree.loadCasesForExecution(
    tree,
    executionId,
    isExecutionSortOrder(options.sortOrder) ? options.sortOrder : preferences.executionSortOrder,
  );
  if (!cases) {
    throw new CliError(`Execution not found: ${executionId}`);
  }

  if (options.format === 'json') {
    printJson(cases);
    return;
  }

  printCaseList(cases);
}

async function printCaseFile(
  workspaceRoot: string,
  positionals: string[],
  options: CliOptions,
): Promise<void> {
  const executionId = requirePositional(positionals, 0, 'execution id');
  const seed = parseSeed(requirePositional(positionals, 1, 'seed'), 'seed');
  const kind = options.kind ?? 'input';
  const runtime = createPahcerRuntime(workspaceRoot);
  const filePath = runtime.openCaseFile.resolvePath({ kind, executionId, seed });
  if (!filePath) {
    throw new CliError(`The ${kind} file could not be resolved.`);
  }

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if (!isErrnoCode(error, 'ENOENT')) {
      throw error;
    }
    throw new CliError(`The ${kind} file does not exist: ${filePath}`);
  }

  if (options.format === 'json') {
    printJson({ executionId, seed, kind, path: filePath, content });
    return;
  }
  process.stdout.write(content);
  if (!content.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

async function updateComment(workspaceRoot: string, positionals: string[]): Promise<void> {
  const executionId = requirePositional(positionals, 0, 'execution id');
  const comment = positionals.slice(1).join(' ');
  if (!comment && !input.isTTY) {
    throw new CliError('Provide a comment after the execution id.');
  }

  let finalComment = comment;
  if (!finalComment) {
    const reader = createInterface({ input, output });
    try {
      finalComment = await ask(reader, 'Comment', '');
    } finally {
      reader.close();
    }
  }
  const updated = await createPahcerRuntime(workspaceRoot).updateComment.update(
    executionId,
    finalComment,
  );
  if (!updated) {
    throw new CliError(`Execution not found: ${executionId}`);
  }
  console.log('Comment saved.');
}

async function printSource(
  workspaceRoot: string,
  positionals: string[],
  options: CliOptions,
): Promise<void> {
  const executionId = requirePositional(positionals, 0, 'execution id');
  const runtime = createPahcerRuntime(workspaceRoot);
  const preparation = await runtime.copySource.prepare(executionId);
  if (preparation.status !== 'ready') {
    throw new CliError(sourcePreparationMessage(preparation.status));
  }

  const file = options.file ?? positionals[1];
  if (!file) {
    if (options.format === 'json') {
      printJson({ executionId, files: preparation.files });
    } else {
      console.log(preparation.files.join('\n'));
    }
    return;
  }

  const content = await runtime.copySource.loadContent(executionId, file);
  if (content === undefined) {
    throw new CliError(`Source file not found at execution ${executionId}: ${file}`);
  }
  if (options.format === 'json') {
    printJson({ executionId, file, content });
    return;
  }
  process.stdout.write(content);
  if (!content.endsWith('\n')) {
    process.stdout.write('\n');
  }
}

async function printDiff(
  workspaceRoot: string,
  positionals: string[],
  options: CliOptions,
): Promise<void> {
  const executionIds = positionals.slice(0, 2);
  if (executionIds.length !== 2) {
    throw new CliError('Usage: pahcer-ui diff <older-execution-id> <newer-execution-id>');
  }

  const runtime = createPahcerRuntime(workspaceRoot);
  const result = await runtime.diff.loadDiffFiles(executionIds);
  if (result.status === 'invalidSelection') {
    throw new CliError('Exactly two execution ids are required.');
  }
  if (result.status === 'missingCommitHash') {
    throw new CliError('Both executions must have Git commit hashes.');
  }

  const files = result.files;
  if (options.format === 'json') {
    printJson({ older: result.older.id, newer: result.newer.id, files });
    return;
  }
  if (files.length === 0) {
    console.log('No changed source files.');
    return;
  }
  for (const file of files) {
    console.log(`--- ${file.file}`);
    process.stdout.write(file.patch);
    if (!file.patch.endsWith('\n')) {
      process.stdout.write('\n');
    }
  }
}

async function visualizerCommand(
  workspaceRoot: string,
  positionals: string[],
  options: CliOptions,
): Promise<void> {
  const runtime = createPahcerRuntime(workspaceRoot);
  const action = positionals[0] ?? 'status';
  if (action === 'status') {
    const htmlFileName = await runtime.visualizer.getCachedHtmlFileName();
    printValue({ htmlFileName: htmlFileName ?? null }, options.format, htmlFileName ?? 'none');
    return;
  }
  if (action === 'download') {
    const url = positionals[1];
    if (!url) {
      throw new CliError('Usage: pahcer-ui visualizer download <url>');
    }
    const htmlFileName = await runtime.visualizer.download(url);
    printValue({ htmlFileName }, options.format, `Downloaded ${htmlFileName}`);
    return;
  }
  throw new CliError(`Unknown visualizer action: ${action}`);
}

async function updatePreferences(
  workspaceRoot: string,
  options: CliOptions,
  positionals: string[],
): Promise<void> {
  const runtime = createPahcerRuntime(workspaceRoot);
  if (
    positionals.length === 0 &&
    options.groupingMode === undefined &&
    options.sortOrder === undefined &&
    options.zoom === undefined
  ) {
    printValue(
      await runtime.appConfig.preferences(),
      options.format,
      JSON.stringify(await runtime.appConfig.preferences(), null, 2),
    );
    return;
  }

  const current = await runtime.appConfig.preferences();
  const next = {
    ...(options.groupingMode ? { groupingMode: options.groupingMode } : {}),
    ...(options.sortOrder
      ? options.groupingMode === 'bySeed' || current.groupingMode === 'bySeed'
        ? { seedSortOrder: options.sortOrder as SeedSortOrder }
        : { executionSortOrder: options.sortOrder as ExecutionSortOrder }
      : {}),
    ...(options.zoom !== undefined ? { visualizerZoomLevel: options.zoom } : {}),
  };
  const updated = await runtime.appConfig.updatePreferences(next);
  printValue(updated, options.format, 'Preferences saved.');
}

async function updateGrouping(workspaceRoot: string, positionals: string[]): Promise<void> {
  const value = requirePositional(positionals, 0, 'grouping mode');
  const mode =
    value === 'seed' || value === 'bySeed'
      ? 'bySeed'
      : value === 'execution' || value === 'byExecution'
        ? 'byExecution'
        : undefined;
  if (!mode) {
    throw new CliError('Grouping mode must be execution or seed.');
  }
  await createPahcerRuntime(workspaceRoot).appConfig.updatePreferences({ groupingMode: mode });
  console.log(`Grouping mode: ${mode}`);
}

async function updateSortOrder(workspaceRoot: string, positionals: string[]): Promise<void> {
  const value = requirePositional(positionals, 0, 'sort order');
  const sortOrder = parseSortOrder(value);
  const runtime = createPahcerRuntime(workspaceRoot);
  const preferences = await runtime.appConfig.preferences();
  const updated =
    preferences.groupingMode === 'bySeed'
      ? await runtime.appConfig.updatePreferences({ seedSortOrder: sortOrder as SeedSortOrder })
      : await runtime.appConfig.updatePreferences({
          executionSortOrder: sortOrder as ExecutionSortOrder,
        });
  printValue(updated, 'text', `Sort order: ${sortOrder}`);
}

async function viewCommand(
  workspaceRoot: string,
  positionals: string[],
  options: CliOptions,
): Promise<void> {
  const target = positionals[0] ?? 'home';
  const view = parseBrowserView(target, positionals.slice(1));
  await openBrowserView(workspaceRoot, options, view);
}

function parseBrowserView(target: string, args: string[]): PahcerUIRoute {
  switch (target) {
    case 'home':
      return { kind: 'home' };
    case 'execution':
      return { kind: 'execution', executionId: requirePositional(args, 0, 'execution id') };
    case 'case':
      return {
        kind: 'case',
        executionId: requirePositional(args, 0, 'execution id'),
        seed: parseSeed(requirePositional(args, 1, 'seed'), 'seed'),
      };
    case 'input':
    case 'output':
    case 'error':
      return {
        kind: 'case',
        executionId: requirePositional(args, 0, 'execution id'),
        seed: parseSeed(requirePositional(args, 1, 'seed'), 'seed'),
        fileKind: target,
      };
    case 'visualizer':
      return {
        kind: 'visualizer',
        executionId: requirePositional(args, 0, 'execution id'),
        seed: parseSeed(requirePositional(args, 1, 'seed'), 'seed'),
      };
    case 'comparison':
      return { kind: 'comparison', executionIds: requireExecutionIds(args) };
    case 'diff':
      return { kind: 'diff', executionIds: requireExecutionIds(args, 2) };
    case 'source':
      return { kind: 'source', executionId: requirePositional(args, 0, 'execution id') };
    default:
      throw new CliError(`Unknown view target: ${target}`);
  }
}

async function openBrowserView(
  workspaceRoot: string,
  options: CliOptions,
  view: PahcerUIRoute,
): Promise<void> {
  const state = await ensureServer(workspaceRoot, options);
  const url = buildBrowserUrl(state.url, view);
  if (options.format === 'json') {
    printJson({ url, workspaceRoot, pid: state.pid });
  } else {
    console.log(url);
  }
  if (!options.noOpen) {
    await openBrowser(url);
  }
}

function buildBrowserUrl(baseUrl: string, view: PahcerUIRoute): string {
  const url = new URL(baseUrl);
  url.pathname = buildPahcerUIPath(view);
  url.search = '';
  return url.toString();
}

async function showStatus(workspaceRoot: string, format: OutputFormat): Promise<void> {
  const runtime = createPahcerRuntime(workspaceRoot);
  const state = await readState(workspaceRoot);
  const running = state ? await isHealthy(state) : false;
  if (state && !running) {
    await removeServerState(workspaceRoot);
  }

  const result = {
    workspaceRoot,
    pahcer: await runtime.status.check(),
    server: running && state ? { ...state, status: 'running' } : { status: 'stopped' },
  };
  printValue(result, format, `Pahcer: ${result.pahcer}\nServer: ${result.server.status}`);
}

async function ensureServer(workspaceRoot: string, options: CliOptions): Promise<ServerState> {
  const current = await readHealthyState(workspaceRoot);
  if (current) {
    return current;
  }

  await fs.mkdir(path.join(workspaceRoot, '.pahcer-ui'), { recursive: true });
  const lockFile = await acquireStartupLock(workspaceRoot);
  if (!lockFile) {
    const state = await waitForHealthyState(workspaceRoot);
    if (state) {
      return state;
    }
    throw new CliError('Timed out waiting for another Pahcer UI server to start.');
  }

  try {
    const lockedCurrent = await readHealthyState(workspaceRoot);
    if (lockedCurrent) {
      return lockedCurrent;
    }

    await removeServerState(workspaceRoot);
    const serverEntry = path.join(__dirname, 'web', 'server.js');
    if (!(await fileExists(serverEntry))) {
      throw new CliError(
        `Web server build not found: ${serverEntry}\nRun npm run build or npm run web:build first.`,
      );
    }

    const logPath = path.join(workspaceRoot, SERVER_LOG_FILE);
    const logFile = await fs.open(logPath, 'a');
    const host = options.host ?? process.env.PAHCER_UI_HOST ?? '127.0.0.1';
    const port = options.port ?? 0;
    const statePath = path.join(workspaceRoot, SERVER_STATE_FILE);
    const child = spawn(process.execPath, [serverEntry], {
      cwd: workspaceRoot,
      detached: true,
      stdio: ['ignore', logFile.fd, logFile.fd],
      env: {
        ...process.env,
        PAHCER_WORKSPACE: workspaceRoot,
        PAHCER_UI_HOST: host,
        PAHCER_UI_SERVER_STATE: statePath,
        PORT: String(port),
      },
    });
    child.unref();
    await logFile.close();

    const state = await waitForServer(workspaceRoot, logPath);
    if (state.pid !== child.pid) {
      throw new CliError('The started Pahcer UI server PID could not be verified.');
    }
    return state;
  } finally {
    await lockFile.close();
    await removeFileIfExists(path.join(workspaceRoot, SERVER_LOCK_FILE));
  }
}

async function waitForServer(workspaceRoot: string, logPath: string): Promise<ServerState> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = await readState(workspaceRoot);
    if (state && (await isHealthy(state))) {
      return state;
    }
    await sleep(100);
  }

  const log = await fs.readFile(logPath, 'utf-8').catch(() => '');
  const detail = log.trim().slice(-2000);
  throw new CliError(`Failed to start the Pahcer UI server.${detail ? `\n\n${detail}` : ''}`);
}

async function waitForHealthyState(workspaceRoot: string): Promise<ServerState | undefined> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const state = await readHealthyState(workspaceRoot);
    if (state) {
      return state;
    }
    await sleep(100);
  }
  return undefined;
}

async function acquireStartupLock(workspaceRoot: string) {
  const lockPath = path.join(workspaceRoot, SERVER_LOCK_FILE);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const lockFile = await fs.open(lockPath, 'wx');
      await lockFile.writeFile(`${process.pid}\n`, 'utf-8');
      return lockFile;
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'EEXIST') {
        throw error;
      }

      const content = await fs.readFile(lockPath, 'utf-8').catch(() => '');
      const lockPid = Number(content.trim());
      if (!Number.isInteger(lockPid) || !processAlive(lockPid)) {
        await removeFileIfExists(lockPath);
        continue;
      }
      return undefined;
    }
  }
  return undefined;
}

async function stopServer(workspaceRoot: string, silent = false): Promise<void> {
  const state = await readState(workspaceRoot);
  if (!state) {
    if (!silent) {
      console.log('The Pahcer UI server is not running.');
    }
    return;
  }

  if (!(await isHealthy(state))) {
    await removeServerState(workspaceRoot);
    if (!silent) {
      console.log('The Pahcer UI server is not running (removed stale state).');
    }
    return;
  }

  if (processAlive(state.pid)) {
    try {
      process.kill(state.pid, 'SIGTERM');
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') {
        throw error;
      }
    }
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (!processAlive(state.pid) || !(await isHealthy(state))) {
      await removeServerState(workspaceRoot);
      if (!silent) {
        console.log('Stopped the Pahcer UI server.');
      }
      return;
    }
    await sleep(100);
  }

  if (processAlive(state.pid)) {
    process.kill(state.pid, 'SIGKILL');
  }
  await removeServerState(workspaceRoot);
  if (!silent) {
    console.log('Force-stopped the Pahcer UI server.');
  }
}

async function readHealthyState(workspaceRoot: string): Promise<ServerState | undefined> {
  const state = await readState(workspaceRoot);
  return state && (await isHealthy(state)) ? state : undefined;
}

async function readState(workspaceRoot: string): Promise<ServerState | undefined> {
  // The state file is a disposable cache: "absent" and "written by an older,
  // incompatible version" both mean "no server known here". Any other read
  // failure is a real problem and is left to propagate.
  let content: string;
  try {
    content = await fs.readFile(path.join(workspaceRoot, SERVER_STATE_FILE), 'utf-8');
  } catch (error) {
    if (!isErrnoCode(error, 'ENOENT')) {
      throw error;
    }
    return undefined;
  }

  try {
    const value = JSON.parse(content) as Partial<ServerState>;
    if (
      typeof value.pid !== 'number' ||
      typeof value.port !== 'number' ||
      typeof value.host !== 'string' ||
      typeof value.url !== 'string' ||
      typeof value.workspaceRoot !== 'string' ||
      typeof value.startedAt !== 'string'
    ) {
      return undefined;
    }
    return value as ServerState;
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error;
    }
    return undefined;
  }
}

async function removeServerState(workspaceRoot: string): Promise<void> {
  await removeFileIfExists(path.join(workspaceRoot, SERVER_STATE_FILE));
}

/**
 * Delete a file, tolerating only "it was already gone".
 */
async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (!isErrnoCode(error, 'ENOENT')) {
      throw error;
    }
  }
}

function isErrnoCode(error: unknown, code: string): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === code;
}

function isHealthy(state: ServerState): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get(
      {
        hostname: connectHost(state.host),
        port: state.port,
        path: '/api/health',
        timeout: 500,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          if (response.statusCode !== 200) {
            resolve(false);
            return;
          }
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as {
              ok?: unknown;
              pid?: unknown;
              workspaceRoot?: unknown;
            };
            resolve(
              body.ok === true &&
                body.pid === state.pid &&
                body.workspaceRoot === state.workspaceRoot,
            );
          } catch (error) {
            // A body that is not our health JSON means something else is
            // listening on this port, which is a legitimate "not healthy".
            if (!(error instanceof SyntaxError)) {
              throw error;
            }
            resolve(false);
          }
        });
      },
    );
    request.once('error', () => resolve(false));
    request.once('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH: no such process. EPERM: the process exists but belongs to another
    // user, so it is still alive. Anything else is unexpected.
    if (isErrnoCode(error, 'ESRCH')) {
      return false;
    }
    if (isErrnoCode(error, 'EPERM')) {
      return true;
    }
    throw error;
  }
}

function connectHost(host: string): string {
  return host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
}

async function openBrowser(url: string): Promise<void> {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'start', '', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.unref();
  await new Promise<void>((resolve) => {
    child.once('spawn', resolve);
    child.once('error', (error: Error) => {
      // The URL has already been printed, so the browser failing to launch is
      // recoverable - but the user must be told why nothing opened.
      console.error(`Could not open a browser (${error.message}). Open the URL above manually.`);
      resolve();
    });
  });
}

function printServerState(state: ServerState, format: OutputFormat): void {
  printValue(
    state,
    format,
    `Pahcer UI server: ${state.url}\nWorkspace: ${state.workspaceRoot}\nPID: ${state.pid}`,
  );
}

function printCaseList(cases: TreeExecutionCases): void {
  console.log('Seed\tScore\tRelative\tTime\tStatus');
  for (const item of cases.cases) {
    const status = item.testCase.errorMessage
      ? 'error'
      : item.testCase.foundOutput
        ? 'ok'
        : 'missing';
    console.log(
      [
        item.testCase.seed,
        item.testCase.score,
        `${item.relativeScore.toFixed(3)}%`,
        `${(item.testCase.executionTime * 1000).toFixed(2)}ms`,
        status,
      ].join('\t'),
    );
  }
}

function sourcePreparationMessage(status: 'notFound' | 'missingCommitHash' | 'noFiles'): string {
  switch (status) {
    case 'notFound':
      return 'Execution not found.';
    case 'missingCommitHash':
      return 'This execution does not have a Git commit hash.';
    case 'noFiles':
      return 'No source files are available at this execution.';
  }
}

function printValue(value: unknown, format: OutputFormat, text: string): void {
  if (format === 'json') {
    printJson(value);
    return;
  }
  console.log(text);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function requirePositional(positionals: string[], index: number, name: string): string {
  const value = positionals[index];
  if (!value) {
    throw new CliError(`Missing ${name}.`);
  }
  return value;
}

function requireExecutionIds(positionals: string[], requiredCount?: number): string[] {
  const ids = requiredCount === undefined ? positionals : positionals.slice(0, requiredCount);
  if ((requiredCount !== undefined && ids.length !== requiredCount) || ids.length === 0) {
    throw new CliError(
      requiredCount === 2
        ? 'Exactly two execution ids are required.'
        : 'At least one execution id is required.',
    );
  }
  return ids;
}

function requireOptionValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith('-')) {
    throw new CliError(`${option} requires a value.`);
  }
  return value;
}

function optionInlineValue(argument: string, name: string): string {
  const value = argument.slice(name.length + 1);
  if (!value) {
    throw new CliError(`${name} requires a value.`);
  }
  return value;
}

function parseObjective(value: string): Objective {
  if (value === 'max' || value === 'min') {
    return value;
  }
  throw new CliError('--objective must be max or min.');
}

function parseLanguage(value: string): Language {
  if (value === 'rust' || value === 'cpp' || value === 'python' || value === 'go') {
    return value;
  }
  throw new CliError('--lang must be rust, cpp, python, or go.');
}

function parseFormat(value: string): OutputFormat {
  if (value === 'text' || value === 'json') {
    return value;
  }
  throw new CliError('--format must be text or json.');
}

function parseSeed(value: string, name: string): number {
  const seed = Number(value);
  if (!Number.isInteger(seed) || seed < 0) {
    throw new CliError(`${name} must be a non-negative integer.`);
  }
  return seed;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new CliError('--port must be an integer between 0 and 65535.');
  }
  return port;
}

function parseZoom(value: string): number {
  const zoom = Number(value);
  if (!Number.isFinite(zoom) || zoom < 0.5 || zoom > 3) {
    throw new CliError('--zoom must be between 0.5 and 3.');
  }
  return zoom;
}

function parseGroupingMode(value: string): GroupingMode {
  if (value === 'execution' || value === 'byExecution') {
    return 'byExecution';
  }
  if (value === 'seed' || value === 'bySeed') {
    return 'bySeed';
  }
  throw new CliError('--grouping must be execution or seed.');
}

function parseCaseFileKind(value: string): CaseFileKind {
  if (value === 'input' || value === 'output' || value === 'error') {
    return value;
  }
  throw new CliError('--kind must be input, output, or error.');
}

function parseSortOrder(value: string): ExecutionSortOrder | SeedSortOrder {
  if (
    value === 'seedAsc' ||
    value === 'seedDesc' ||
    value === 'relativeScoreAsc' ||
    value === 'relativeScoreDesc' ||
    value === 'absoluteScoreAsc' ||
    value === 'absoluteScoreDesc' ||
    value === 'executionAsc' ||
    value === 'executionDesc'
  ) {
    return value;
  }
  throw new CliError(`Unknown sort order: ${value}`);
}

function isExecutionSortOrder(
  value: ExecutionSortOrder | SeedSortOrder | undefined,
): value is ExecutionSortOrder {
  return (
    value === 'seedAsc' ||
    value === 'seedDesc' ||
    value === 'relativeScoreAsc' ||
    value === 'relativeScoreDesc' ||
    value === 'absoluteScoreAsc' ||
    value === 'absoluteScoreDesc'
  );
}

async function findWorkspaceRoot(startDirectory: string): Promise<string | undefined> {
  let directory = path.resolve(startDirectory);
  while (true) {
    if (await fileExists(path.join(directory, 'pahcer_config.toml'))) {
      return directory;
    }
    const parent = path.dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
}

async function ask(
  reader: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: string,
): Promise<string> {
  const value = await reader.question(`${label}${defaultValue ? ` [${defaultValue}]` : ''}: `);
  return value.trim() || defaultValue;
}

async function askChoice<T extends string>(
  reader: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: T,
  choices: readonly T[],
): Promise<T> {
  while (true) {
    const value = await ask(reader, label, defaultValue);
    if (choices.includes(value as T)) {
      return value as T;
    }
    console.error(`Choose one of: ${choices.join(', ')}`);
  }
}

function printHelp(): void {
  console.log(helpText());
}

function helpText(): string {
  return `Usage: pahcer-ui [global-options] <command> [options]

Workspace:
  --workspace, -C <path>       Use this workspace instead of searching parents
  --json                      Print machine-readable JSON where supported

Commands:
  init                         Initialize the workspace
  run                          Run test cases directly through pahcer
  results                     List execution results (alias: tree)
  cases <execution-id>         List test cases for an execution
  case <execution-id> <seed>   Print an input/output/error file
  comment <execution-id> ...   Save an execution comment
  source <execution-id>        List or print source at an execution
  diff <execution-a> <execution-b>
                               Print the source diff between executions
  visualizer status             Show the cached visualizer
  visualizer download <url>    Download and cache a visualizer
  preferences                  Show or change Web UI preferences
  group <execution|seed>        Change the result grouping mode
  sort <order>                 Change the current result sort order

Browser:
  open                         Start/reuse the Web UI and open its home page
  view execution <id>          Open an execution directly in the browser
  view case <id> <seed>        Open a case directly
  view input|output|error ...   Open a case file directly
  view visualizer <id> <seed>  Open a visualizer directly
  view comparison <id> [...]   Open a comparison directly
  view diff <id> <id>          Open a diff directly
  view source <id>             Open source at an execution directly

Server lifecycle:
  start, server                Start/reuse the Web server without opening a browser
  status                       Show pahcer and Web server status
  url                          Print the running Web server URL
  stop                         Stop the Web server
  restart                      Restart the Web server and open the browser

Run options:
  --start-seed <n>             Override the start seed
  --end-seed <n>               Override the exclusive end seed
  --freeze-best-scores         Do not update best scores
  --git / --no-git             Enable or disable Git integration
  --problem <name>             Problem name for init
  --objective <min|max>        Objective for init
  --lang <language>             Language for init
  --tester-url <url>            Tester URL for init

Browser options:
  --host <host>                Web server listen host
  --port <port>                Web server port (0 = automatic)
  --no-open                    Print the URL without opening a browser

Preferences:
  --grouping <execution|seed>  Result grouping mode
  --sort <order>               Result sort order
  --zoom <0.5..3>              Visualizer zoom level

File and output options:
  --kind <input|output|error>  Case file kind (default: input)
  --file <path>                Source file path
  --format <text|json>         Output format
`;
}

function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false,
  );
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
