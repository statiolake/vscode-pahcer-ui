import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

type Objective = 'max' | 'min';
type Language = 'rust' | 'cpp' | 'python' | 'go';

interface ServerState {
  pid: number;
  port: number;
  host: string;
  url: string;
  workspaceRoot: string;
  startedAt: string;
}

interface CliOptions {
  problem?: string;
  objective?: Objective;
  language?: Language;
  interactive?: boolean;
  host?: string;
  port?: number;
  noOpen?: boolean;
}

class CliError extends Error {}

const SERVER_STATE_FILE = path.join('.pahcer-ui', 'server.json');
const SERVER_LOCK_FILE = path.join('.pahcer-ui', 'server.lock');
const SERVER_LOG_FILE = path.join('.pahcer-ui', 'server.log');

async function main(): Promise<void> {
  const { command, options } = parseCommand(process.argv.slice(2));

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  if (command === 'init') {
    await initializeWorkspace(options);
    return;
  }

  const workspaceRoot = await requireWorkspaceRoot();

  switch (command) {
    case 'start': {
      const state = await ensureServer(workspaceRoot, options);
      printServerState(state);
      return;
    }
    case 'open': {
      const state = await ensureServer(workspaceRoot, options);
      printServerState(state);
      if (!options.noOpen) {
        await openBrowser(state.url);
      }
      return;
    }
    case 'status':
      await showStatus(workspaceRoot);
      return;
    case 'url': {
      const state = await readHealthyState(workspaceRoot);
      if (!state) {
        throw new CliError(
          'Pahcer UI サーバーは起動していません。`pahcer-ui start` を実行してください。',
        );
      }
      console.log(state.url);
      return;
    }
    case 'stop':
      await stopServer(workspaceRoot);
      return;
    case 'restart':
      await stopServer(workspaceRoot, true);
      {
        const state = await ensureServer(workspaceRoot, options);
        printServerState(state);
        if (!options.noOpen) {
          await openBrowser(state.url);
        }
      }
      return;
    default:
      throw new CliError(`不明なサブコマンドです: ${command}\n\n${helpText()}`);
  }
}

function parseCommand(args: string[]): { command: string; options: CliOptions } {
  const command = args[0]?.startsWith('-') || !args[0] ? 'open' : args[0];
  const optionArgs = command === 'open' && args[0]?.startsWith('-') ? args : args.slice(1);
  const options: CliOptions = {};

  for (let index = 0; index < optionArgs.length; index += 1) {
    const argument = optionArgs[index];
    if (!argument) {
      continue;
    }

    if (argument === '--no-open') {
      options.noOpen = true;
      continue;
    }
    if (argument === '--interactive') {
      options.interactive = true;
      continue;
    }
    if (argument === '--non-interactive') {
      options.interactive = false;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      printHelp();
      process.exit(0);
    }

    const [name, inlineValue] = argument.split('=', 2);
    const value = inlineValue ?? optionArgs[++index];
    if (!value || value.startsWith('--')) {
      throw new CliError(`${name} には値が必要です。`);
    }

    switch (name) {
      case '--problem':
        options.problem = value;
        break;
      case '--objective':
        if (value !== 'max' && value !== 'min') {
          throw new CliError('--objective は max または min を指定してください。');
        }
        options.objective = value;
        break;
      case '--lang':
      case '--language':
        if (value !== 'rust' && value !== 'cpp' && value !== 'python' && value !== 'go') {
          throw new CliError('--lang は rust, cpp, python, go のいずれかを指定してください。');
        }
        options.language = value;
        break;
      case '--host':
        options.host = value;
        break;
      case '--port': {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 0 || port > 65535) {
          throw new CliError('--port は 0〜65535 の整数を指定してください。');
        }
        options.port = port;
        break;
      }
      default:
        throw new CliError(`不明なオプションです: ${name}`);
    }
  }

  return { command, options };
}

async function initializeWorkspace(options: CliOptions): Promise<void> {
  const currentDirectory = path.resolve(process.cwd());
  const existingRoot = await findWorkspaceRoot(currentDirectory);
  if (existingRoot) {
    throw new CliError(`すでに初期化済みです: ${existingRoot}`);
  }

  const reader = input.isTTY && output.isTTY ? createInterface({ input, output }) : undefined;

  try {
    const problem =
      options.problem ??
      (reader
        ? await ask(reader, '問題名', path.basename(currentDirectory))
        : path.basename(currentDirectory));
    const objective: Objective =
      options.objective ??
      (reader ? await askChoice(reader, '最適化の目的 (max/min)', 'max', ['max', 'min']) : 'max');
    const language: Language =
      options.language ??
      (reader
        ? await askChoice(reader, '使用言語 (rust/cpp/python/go)', 'rust', [
            'rust',
            'cpp',
            'python',
            'go',
          ])
        : 'rust');
    const interactive =
      options.interactive ??
      (reader
        ? (await ask(reader, 'インタラクティブ問題ですか (y/N)', 'N')).toLowerCase() === 'y'
        : false);

    console.log('pahcer init を実行します。');
    const exitCode = await runPahcerInit(
      currentDirectory,
      problem,
      objective,
      language,
      interactive,
    );
    if (exitCode !== 0) {
      throw new CliError(`pahcer init が終了コード ${exitCode} で失敗しました。`);
    }
    console.log(`初期化しました: ${currentDirectory}`);
    console.log('次のコマンドでUIを起動できます: pahcer-ui');
  } finally {
    reader?.close();
  }
}

function ask(
  reader: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: string,
): Promise<string> {
  return reader
    .question(`${label} [${defaultValue}]: `)
    .then((value) => value.trim() || defaultValue);
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
    console.log(`次のいずれかを指定してください: ${choices.join(', ')}`);
  }
}

function runPahcerInit(
  cwd: string,
  problem: string,
  objective: Objective,
  language: Language,
  interactive: boolean,
): Promise<number> {
  const args = ['init', '--problem', problem, '--objective', objective, '--lang', language];
  if (interactive) {
    args.push('--interactive');
  }

  return new Promise((resolve, reject) => {
    const child = spawn('pahcer', args, { cwd, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
}

async function requireWorkspaceRoot(): Promise<string> {
  const workspaceRoot = await findWorkspaceRoot(process.cwd());
  if (!workspaceRoot) {
    throw new CliError(
      'pahcer_config.toml が見つかりません。ワークスペースを初期化するには `pahcer-ui init` を実行してください。',
    );
  }
  return workspaceRoot;
}

async function findWorkspaceRoot(startDirectory: string): Promise<string | undefined> {
  let directory = path.resolve(startDirectory);
  const stats = await fs.stat(directory).catch(() => undefined);
  if (stats && !stats.isDirectory()) {
    directory = path.dirname(directory);
  }

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
    throw new CliError('別のPahcer UIサーバーの起動を待ちましたが、起動を確認できませんでした。');
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
        `Webサーバーのビルドが見つかりません: ${serverEntry}\n先に npm run build または npm run web:build を実行してください。`,
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
      throw new CliError('起動したPahcer UIサーバーのPIDを確認できませんでした。');
    }
    return state;
  } finally {
    await lockFile.close();
    await fs.unlink(path.join(workspaceRoot, SERVER_LOCK_FILE)).catch(() => undefined);
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
  throw new CliError(`Pahcer UIサーバーを起動できませんでした。${detail ? `\n\n${detail}` : ''}`);
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
        await fs.unlink(lockPath).catch(() => undefined);
        continue;
      }
      return undefined;
    }
  }
  return undefined;
}

async function showStatus(workspaceRoot: string): Promise<void> {
  const state = await readState(workspaceRoot);
  if (!state) {
    console.log('Pahcer UIサーバー: stopped');
    return;
  }

  if (!(await isHealthy(state))) {
    await removeServerState(workspaceRoot);
    console.log('Pahcer UIサーバー: stopped (stale stateを削除しました)');
    return;
  }

  console.log('Pahcer UIサーバー: running');
  printServerState(state);
}

async function stopServer(workspaceRoot: string, silent = false): Promise<void> {
  const state = await readState(workspaceRoot);
  if (!state) {
    if (!silent) {
      console.log('Pahcer UIサーバーは起動していません。');
    }
    return;
  }

  if (!(await isHealthy(state))) {
    await removeServerState(workspaceRoot);
    if (!silent) {
      console.log('Pahcer UIサーバーは起動していません（stale stateを削除しました）。');
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
        console.log('Pahcer UIサーバーを停止しました。');
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
    console.log('Pahcer UIサーバーを強制停止しました。');
  }
}

async function readHealthyState(workspaceRoot: string): Promise<ServerState | undefined> {
  const state = await readState(workspaceRoot);
  return state && (await isHealthy(state)) ? state : undefined;
}

async function readState(workspaceRoot: string): Promise<ServerState | undefined> {
  try {
    const value = JSON.parse(
      await fs.readFile(path.join(workspaceRoot, SERVER_STATE_FILE), 'utf-8'),
    ) as Partial<ServerState>;
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
  } catch {
    return undefined;
  }
}

async function removeServerState(workspaceRoot: string): Promise<void> {
  await fs.unlink(path.join(workspaceRoot, SERVER_STATE_FILE)).catch(() => undefined);
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
          } catch {
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
  } catch {
    return false;
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
    child.once('error', () => resolve());
  });
}

function printServerState(state: ServerState): void {
  console.log(`Pahcer UI: ${state.url}`);
  console.log(`Workspace: ${state.workspaceRoot}`);
  console.log(`PID: ${state.pid}`);
}

function printHelp(): void {
  console.log(helpText());
}

function helpText(): string {
  return `使い方: pahcer-ui [サブコマンド] [オプション]

サブコマンド:
  init       pahcer_config.tomlを作成してワークスペースを初期化
  open       サーバーを起動または再利用してブラウザで開く（デフォルト）
  start      サーバーを起動または再利用してURLを表示
  status     サーバーの状態を表示
  url        起動中のサーバーのURLだけを表示
  stop       サーバーを停止
  restart    サーバーを再起動してブラウザで開く

initのオプション:
  --problem <name>             問題名
  --objective <max|min>        最適化の目的（デフォルト: max）
  --lang <rust|cpp|python|go>  使用言語（デフォルト: rust）
  --interactive                インタラクティブ問題として初期化

サーバーのオプション:
  --host <host>                listenするホスト（デフォルト: 127.0.0.1）
  --port <port>                listenするポート（デフォルト: 0=自動割当）
  --no-open                    ブラウザを開かない
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
