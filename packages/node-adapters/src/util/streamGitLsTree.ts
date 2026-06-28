import { spawn } from 'node:child_process';
import * as readline from 'node:readline';
import { isExcludedSourceFile } from './gitSourceFileFilter';

/**
 * Stream `git ls-tree` output line-by-line so the entire tree is never loaded
 * into memory at once. This avoids ENOBUF on large repositories (see issue #5).
 */
export async function streamGitSourceFilesAtCommit(
  workspaceRoot: string,
  commitHash: string,
): Promise<string[]> {
  return new Promise<string[]>((resolve, reject) => {
    const child = spawn('git', ['ls-tree', '-r', '--name-only', commitHash], {
      cwd: workspaceRoot,
    });

    const rl = readline.createInterface({ input: child.stdout });
    const files: string[] = [];

    rl.on('line', (line) => {
      const filePath = line.trim();
      if (!filePath || isExcludedSourceFile(filePath)) {
        return;
      }
      files.push(filePath);
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `git ls-tree exited with code ${code}`));
        return;
      }
      resolve(files);
    });
  });
}
