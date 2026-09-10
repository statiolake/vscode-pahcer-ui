import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { IPahcerConfigRepository } from '@pahcer/core/domain/interfaces/IPahcerConfigRepository';
import { PahcerStatus } from '@pahcer/core/domain/models/pahcerStatus';
import { asErrnoException } from '../util/lang';

const execFileAsync = promisify(execFile);

/**
 * Resolve the pahcer status of a workspace.
 *
 * Shared by every environment (CLI, Web server, VS Code) so that "pahcer is
 * usable here" is decided in exactly one place.
 */
export async function resolvePahcerStatus(
  pahcerConfigRepository: IPahcerConfigRepository,
  workspaceRoot: string,
): Promise<PahcerStatus> {
  if (!(await isPahcerInstalled(workspaceRoot))) {
    return PahcerStatus.NotInstalled;
  }

  // The repository returns undefined when pahcer_config.toml is absent and
  // throws when it exists but cannot be read/parsed. A broken config is not
  // "not initialized", so that failure is left to propagate.
  return (await pahcerConfigRepository.findById('normal'))
    ? PahcerStatus.Ready
    : PahcerStatus.NotInitialized;
}

async function isPahcerInstalled(workspaceRoot: string): Promise<boolean> {
  try {
    await execFileAsync('pahcer', ['--version'], { cwd: workspaceRoot });
    return true;
  } catch (error) {
    // ENOENT/EACCES mean the pahcer binary cannot be launched at all, which is
    // exactly "not installed". Any other failure (pahcer exists but exits with
    // an error) is a real problem and must surface.
    const code = error instanceof Error ? asErrnoException(error).code : undefined;
    if (code === 'ENOENT' || code === 'EACCES') {
      return false;
    }
    throw error;
  }
}
