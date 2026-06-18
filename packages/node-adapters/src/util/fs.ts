import fs from 'node:fs/promises';
import * as path from 'node:path';
import { asErrnoException } from './lang';

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (e) {
    if (!(e instanceof Error) || asErrnoException(e).code !== 'ENOENT') {
      throw e;
    }

    return false;
  }
}

/**
 * ディレクトリが存在しない場合は作成する
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * ファイルパスの親ディレクトリが存在しない場合は作成する
 */
export async function ensureDirForFile(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}
