/**
 * Whether the given path should be excluded from the source-file picker.
 *
 * Exclusion rules (shared by diff display and source-file listing):
 *   - files under `tools/`
 *   - any path component starting with `.` (covers .gitignore, .vscode/,
 *     .pahcer-ui/, nested dot-files like sub/deep/.hidden.rs, etc.)
 *   - extensions: .txt, .json, .html
 */
export function isExcludedSourceFile(filePath: string): boolean {
  if (filePath.startsWith('tools/')) {
    return true;
  }
  for (const part of filePath.split('/')) {
    if (part.startsWith('.')) {
      return true;
    }
  }
  const ext = filePath.toLowerCase().split('.').pop();
  return ext === 'txt' || ext === 'json' || ext === 'html';
}
