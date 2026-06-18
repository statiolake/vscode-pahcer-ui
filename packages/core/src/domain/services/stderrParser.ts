export namespace StderrParser {
  /**
   * stderrから変数を抽出する（$varname = value の形式）
   *
   * @param content stderr のコンテンツ
   * @returns 変数名と値のマップ
   */
  export function parseVariables(content: string): Record<string, number> {
    const variables: Record<string, number> = {};
    const lines = content.split('\n');
    const pattern = /\$([a-zA-Z_][a-zA-Z_0-9]*)\s*=\s*(-?\d+(?:\.\d+)?)/;

    for (const line of lines) {
      const match = line.match(pattern);
      if (match) {
        const varName = match[1];
        const value = parseFloat(match[2]);
        if (!Number.isNaN(value)) {
          variables[varName] = value;
        }
      }
    }

    return variables;
  }
}
