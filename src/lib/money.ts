/** Invoice amounts are immutable; always format their stored cents, not today's plan price. */
export function formatUsd(cents: number, minimumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
