/**
 * Features 文字列を配列にパースする
 */
export function parseFeatures(featuresStr: string): string[] {
  return featuresStr
    .trim()
    .split(/\s+/)
    .filter((f) => f.length > 0);
}
