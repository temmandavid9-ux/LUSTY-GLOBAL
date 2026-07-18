/**
 * Formats large engagement counts into clean shorthand strings.
 * Examples:
 * 999 -> "999"
 * 1000 -> "1K"
 * 1500 -> "1.5K"
 * 1000000 -> "1M"
 */
export function formatMetricCount(num: number | undefined | null): string {
  if (num === undefined || num === null) return '0';
  const value = Number(num);
  if (value >= 1000000) {
    // Returns 1M, 1.5M, etc. Removes trailing decimals if they are .0
    return (value / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (value >= 1000) {
    // Returns 1K, 1.2K, etc. Removes trailing decimals if they are .0
    return (value / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return value.toString();
}
