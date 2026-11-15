export function isValidPeekBlocklistPattern(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

export function isPeekBlocklisted(
  absoluteUrl: string,
  patterns: string[],
): boolean {
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(absoluteUrl);
    } catch {
      // Storage normalization removes invalid expressions. Keep malformed
      // legacy or externally edited data from breaking link handling.
      return false;
    }
  });
}
