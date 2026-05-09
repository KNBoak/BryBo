/**
 * Format a number as US dollars.
 * Whole dollars: $2,500
 * Cents present: $2,500.50
 */
export function formatUSD(amount: number): string {
  return (
    '$' +
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)
  );
}
