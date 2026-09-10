import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiffFile, IGitAdapter } from '@pahcer/core/domain/interfaces/IGitAdapter';
import { isExcludedSourceFile } from '../util/gitSourceFileFilter';
import { streamGitSourceFilesAtCommit } from '../util/streamGitLsTree';

const execFileAsync = promisify(execFile);

/**
 * Maximum number of files a diff view renders at once
 */
export const MAX_DIFF_FILES = 3;

export class NodeGitAdapter implements IGitAdapter {
  constructor(protected readonly workspaceRoot: string) {}

  async commitAll(message: string): Promise<string> {
    await this.git(['add', '.']);
    // `git diff-index --quiet` reports "there is something to commit" through a
    // non-zero exit code, so the rejection here is the answer, not a failure.
    const hasChanges = await this.git(['diff-index', '--quiet', 'HEAD']).then(
      () => false,
      () => true,
    );
    if (hasChanges) {
      await this.git(['commit', '-m', message]);
    }
    return (await this.git(['rev-parse', 'HEAD'])).trim();
  }

  /**
   * Rendering a diff is a presentation concern; outside VS Code the caller
   * renders {@link getDiffFiles} itself. Reaching this method means the wrong
   * adapter was wired up, so it fails instead of silently doing nothing.
   */
  async showDiff(
    _olderCommitHash: string,
    _newerCommitHash: string,
    _leftTitle: string,
    _rightTitle: string,
  ): Promise<void> {
    throw new Error(
      'この環境では差分の表示に対応していません。getDiffFiles() の結果を呼び出し側で表示してください',
    );
  }

  isGitRepository(): boolean {
    // `git rev-parse --git-dir` answers "is this a repository?" with its exit
    // code, and a missing git binary means Git integration is unavailable all
    // the same, so every failure is a legitimate "no".
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
    return streamGitSourceFilesAtCommit(this.workspaceRoot, commitHash);
  }

  async getFileContentAtCommit(commitHash: string, filePath: string): Promise<string> {
    return this.git(['show', `${commitHash}:${filePath}`]);
  }

  /**
   * List the source files that changed between two commits.
   *
   * Binary files (reported as "- -" by --numstat) and non-source files are
   * excluded, matching what the diff views are able to show.
   */
  async listChangedSourceFiles(
    olderCommitHash: string,
    newerCommitHash: string,
  ): Promise<string[]> {
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
      .filter((filePath) => !isExcludedSourceFile(filePath));
  }

  async getDiffFiles(olderCommitHash: string, newerCommitHash: string): Promise<DiffFile[]> {
    const files = (await this.listChangedSourceFiles(olderCommitHash, newerCommitHash)).slice(
      0,
      MAX_DIFF_FILES,
    );

    return Promise.all(
      files.map(async (file) => ({
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

  private async git(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync('git', args, {
      cwd: this.workspaceRoot,
      maxBuffer: 1024 * 1024 * 20,
    });
    return stdout;
  }
}
