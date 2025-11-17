import * as fs from 'node:fs';
import type { IFileAnalyzer } from '../domain/interfaces/IFileAnalyzer';
import { parseStderrVariables as domainParseStderr } from '../domain/services/stderrParser';

/**
 * ファイル解析アダプター
 * ストリーミング処理で大きなファイルにも対応
 */
export class FileAnalyzer implements IFileAnalyzer {
  /**
   * ファイルの1行目だけを読み込む（ストリーミング）
   */
  async readFirstLine(filePath: string): Promise<string> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      return lines[0]?.trim() || '';
    } catch (error) {
      console.warn(`Failed to read first line from ${filePath}:`, error);
      return '';
    }
  }

  /**
   * ファイルの先頭N行と末尾N行を読み込む（メモリ読み込み）
   */
  async readHeadAndTail(
    filePath: string,
    headLines = 100,
    tailLines = 100,
  ): Promise<{ head: string; tail: string }> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const head = lines.slice(0, headLines).join('\n');
      const tail = lines.length > headLines ? lines.slice(-tailLines).join('\n') : '';
      return { head, tail };
    } catch (error) {
      console.warn(`Failed to read head and tail from ${filePath}:`, error);
      return { head: '', tail: '' };
    }
  }

  /**
   * 複数のファイルの1行目を並列読み込み
   */
  async readFirstLinesParallel(filePaths: string[]): Promise<Map<string, string>> {
    const results = await Promise.all(
      filePaths.map(async (path) => ({
        path,
        content: await this.readFirstLine(path),
      })),
    );

    const map = new Map<string, string>();
    for (const { path, content } of results) {
      map.set(path, content);
    }
    return map;
  }

  /**
   * 複数のファイルの先頭・末尾を並列読み込み
   */
  async readHeadAndTailParallel(
    filePaths: string[],
    headLines = 100,
    tailLines = 100,
  ): Promise<Map<string, { head: string; tail: string }>> {
    const results = await Promise.all(
      filePaths.map(async (path) => ({
        path,
        content: await this.readHeadAndTail(path, headLines, tailLines),
      })),
    );

    const map = new Map<string, { head: string; tail: string }>();
    for (const { path, content } of results) {
      map.set(path, content);
    }
    return map;
  }

  /**
   * stderrファイルから変数を抽出（$varname = value）
   * 先頭100行と末尾100行のみをストリーミングで読み込んでパース
   */
  async parseStderrVariables(
    filePath: string,
    headLines = 100,
    tailLines = 100,
  ): Promise<Record<string, number>> {
    const { head, tail } = await this.readHeadAndTail(filePath, headLines, tailLines);

    // Parse head first
    const variables = domainParseStderr(head);

    // Parse tail (these override earlier values)
    const tailVars = domainParseStderr(tail);
    for (const [key, value] of Object.entries(tailVars)) {
      variables[key] = value;
    }

    return variables;
  }

  /**
   * 複数のstderrファイルから変数を並列抽出
   */
  async parseStderrVariablesParallel(
    filePaths: string[],
    headLines = 100,
    tailLines = 100,
  ): Promise<Map<string, Record<string, number>>> {
    const results = await Promise.all(
      filePaths.map(async (path) => ({
        path,
        variables: await this.parseStderrVariables(path, headLines, tailLines),
      })),
    );

    const map = new Map<string, Record<string, number>>();
    for (const { path, variables } of results) {
      map.set(path, variables);
    }
    return map;
  }
}
