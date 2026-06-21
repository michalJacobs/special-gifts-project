export function formatMoney(value) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS"
  }).format(Number(value || 0));
}
