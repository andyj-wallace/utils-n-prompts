/* ---------- the debt model ---------- */
export const LOAN_RATE = 0.1;

// every debt declares how its monthly payment is computed: a rate of the balance, a fixed $, or none (net)
export const DEBT_TYPES = [
  { id: "creditcard", label: "Credit Card", sub: "3%", rate: 0.03, name: "Credit Cards" },
  { id: "retail", label: "Retail", sub: "5%", rate: 0.05, name: "Retail Liability" },
  { id: "bank", label: "Bank Loan", sub: "10%", rate: 0.1, name: "Bank Loan" },
  { id: "fixed", label: "Fixed $", sub: "set payment", name: "Loan" },
  { id: "none", label: "Net", sub: "no payment", name: "Liability" },
];

// one rule for every debt: rate of balance, fixed dollars, or nothing
export function debtPayment(l) {
  if (l.rate) return Math.round(l.rate * l.balance);
  if (l.payment) return l.payment;
  return 0;
}
