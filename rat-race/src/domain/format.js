/* ---------- numeric + currency formatting ---------- */
export const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const money = (n) => (n < 0 ? "−$" : "$") + Math.abs(Math.round(n)).toLocaleString();

// passive income as a % of expenses, capped at 100 — the "escape" coverage figure
export const coveragePct = (passiveIncome, totalExpenses) =>
  totalExpenses > 0 ? Math.min(100, Math.round((passiveIncome / totalExpenses) * 100)) : 0;
