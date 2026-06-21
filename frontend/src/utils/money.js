export function centsFromValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function decimalFromCents(cents) {
  return (cents / 100).toFixed(2);
}

export function moneyFromCents(cents) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS"
  }).format(cents / 100);
}

export function splitEvenly(totalCents, count) {
  if (count <= 0) {
    return [];
  }

  const base = Math.floor(totalCents / count);
  const remainder = totalCents % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
