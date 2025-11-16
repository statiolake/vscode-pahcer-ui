/**
 * Parse features string into array
 */
export function parseFeatures(featuresStr: string): string[] {
  return featuresStr
    .trim()
    .split(/\s+/)
    .filter((f) => f.length > 0);
}
