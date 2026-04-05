import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { IGitIntegrationConfig } from '../../../application/commitResultsUseCase';
import { ensureDir } from '../../../util/fs';
import { asErrnoException } from '../../../util/lang';

interface StoredConfig {
  gitIntegration: boolean | null;
}

export class FileGitIntegrationConfig implements IGitIntegrationConfig {
  private readonly configDirPath: string;
  private readonly configPath: string;

  constructor(workspaceRoot: string) {
    this.configDirPath = path.join(workspaceRoot, '.pahcer-ui');
    this.configPath = path.join(this.configDirPath, 'http-shell.json');
  }

  async gitIntegration(): Promise<boolean | null> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const parsed = JSON.parse(content) as StoredConfig;
      return parsed.gitIntegration ?? null;
    } catch (error) {
      if (!(error instanceof Error) || asErrnoException(error).code !== 'ENOENT') {
        throw error;
      }
      return null;
    }
  }

  async setGitIntegration(enabled: boolean): Promise<void> {
    await ensureDir(this.configDirPath);
    await fs.writeFile(
      this.configPath,
      JSON.stringify({ gitIntegration: enabled satisfies StoredConfig['gitIntegration'] }, null, 2),
      'utf-8',
    );
  }
}
