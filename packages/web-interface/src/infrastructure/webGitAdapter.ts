import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import type { IGitAdapter } from '@pahcer/core/domain/interfaces/IGitAdapter';

const execFileAsync = promisify(execFile);
const MAX_DIFF_FILES = 3;

export interface WebDiffFile {
  file: string;
  patch: string;
}

export class WebGitAdapter implements IGitAdapter {
  constructor(private readonly workspaceRoot: string) {}

  async commitAll(message: string): Promise<string> {
    await this.git(['add', '.']);
    try {
      await this.git(['diff-index', '--quiet', 'HEAD']);
    } catch {
      await this.git(['commit', '-m', message]);
    }
    return (await this.git(['rev-parse', 'HEAD'])).trim();
  }

  async showDiff(): Promise<void> {
    return;
  }

  isGitRepository(): boolean {
    try {
      execFileSync('git', ['rev-parse', '--git-dir'], {
        cwd: this.workspaceRoot,
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  async getSourceFilesAtCommit(commitHash: string): Promise<string[]> {
    const output = await this.git(['ls-tree', '-r', '--name-only', commitHash]);
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter(isSourceFile);
  }

  async getFileContentAtCommit(commitHash: string, filePath: string): Promise<string> {
    return this.git(['show', `${commitHash}:${filePath}`]);
  }

  async getDiffFiles(olderCommitHash: string, newerCommitHash: string): Promise<WebDiffFile[]> {
    const files = await this.getChangedSourceFiles(olderCommitHash, newerCommitHash);
    const limited = files.slice(0, MAX_DIFF_FILES);
    return Promise.all(
      limited.map(async (file) => ({
        file,
        patch: await this.git([
          'diff',
          '--no-ext-diff',
          olderCommitHash,
          newerCommitHash,
          '--',
          file,
        ]),
      })),
    );
  }

  async getChangedSourceFiles(olderCommitHash: string, newerCommitHash: string): Promise<string[]> {
    const output = await this.git(['diff', '--numstat', olderCommitHash, newerCommitHash]);
    if (!output.trim()) {
      return [];
    }

    return output
      .split('\n')
      .map((line) => line.split('\t'))
      .filter((parts) => parts.length >= 3 && !(parts[0] === '-' && parts[1] === '-'))
      .map((parts) => parts.slice(2).join('\t').trim())
      .filter(Boolean)
      .filter(isSourceFile);
  }

  private async git(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: this.workspaceRoot,
      maxBuffer: 1024 * 1024 * 20,
    });
    return stdout;
  }
}

function isSourceFile(filePath: string): boolean {
  if (filePath.startsWith('tools/')) {
    return false;
  }
  if (filePath.split('/').some((part) => part.startsWith('.'))) {
    return false;
  }
  const ext = filePath.toLowerCase().split('.').pop();
  return ext !== 'txt' && ext !== 'json' && ext !== 'html';
}
