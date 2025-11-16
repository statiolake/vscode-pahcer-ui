import fs from 'node:fs/promises';
import { asErrnoException } from './lang';

export async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch (e) {
    if (!(e instanceof Error) || asErrnoException(e).code !== 'ENOENT') {
      throw e;
    }

    return false;
  }
}
