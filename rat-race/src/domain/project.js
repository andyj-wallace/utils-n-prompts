import { debtPayment } from "./debt.js";
import { coveragePct } from "./format.js";

// every debt's payment is derived from its own rule — one model, not two.
// living expenses (taxes, other, custom) stay as stored, editable lines.
function summarize(p) {
  const debtPayments = p.liabilities
    .map((l) => { const amt = debtPayment(l); return amt > 0 ? { id: `pay_${l.id}`, label: `${l.label} payment`, amount: amt, derived: true, hint: l.rate ? `${Math.round(l.rate * 100)}% of balance` : "fixed" } : null; })
    .filter(Boolean);
  const expenses = [...p.expenses, ...debtPayments];

  const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
  const passiveIncome = p.incomes.filter((i) => i.passive).reduce((s, i) => s + i.amount, 0);
  const totalIncome = p.salary + p.incomes.reduce((s, i) => s + i.amount, 0);
  const payday = totalIncome - totalExpenses;
  const assetValue = p.assets.reduce((s, a) => s + a.value, 0);
  const liabilityTotal = p.liabilities.reduce((s, l) => s + l.balance, 0);
  const netWorth = assetValue + p.cash - liabilityTotal;
  const escaped = totalExpenses > 0 && passiveIncome >= totalExpenses;
  return { expenses, totalExpenses, passiveIncome, totalIncome, payday, netWorth, escaped };
}

// a point-in-time checkpoint for the progress history: passive income vs.
// expenses, net worth, and cash, as of a given month/date.
function snapshot(p, month, date) {
  const s = summarize(p);
  return { month, date, cash: p.cash, passiveIncome: s.passiveIncome, totalExpenses: s.totalExpenses, totalIncome: s.totalIncome, payday: s.payday, netWorth: s.netWorth, escaped: s.escaped, escapePct: coveragePct(s.passiveIncome, s.totalExpenses) };
}

/* ---------- the fold: a list of events -> the board ---------- */
export function project(events) {
  const p = { month: 0, cash: 0, salary: 0, incomes: [], expenses: [], assets: [], liabilities: [], escapedEver: false };
  const history = [];
  let lastDate = null;
  for (const e of events) {
    switch (e.type) {
      case "SalaryChanged": p.salary = e.amount; break;
      case "ExpenseAdded": p.expenses.push({ id: e.id, label: e.label, amount: e.amount, liabId: e.liabId }); break;
      case "ExpenseRemoved": p.expenses = p.expenses.filter((x) => (e.id ? x.id !== e.id : x.liabId !== e.liabId)); break;
      case "ExpenseChanged": p.expenses = p.expenses.map((x) => (x.id === e.id ? { ...x, amount: e.amount, label: e.label ?? x.label } : x)); break;
      case "IncomeAdded": p.incomes.push({ id: e.id, label: e.label, amount: e.amount, passive: e.passive, acqId: e.acqId }); break;
      case "IncomeRemoved": p.incomes = p.incomes.filter((x) => x.acqId !== e.acqId); break;
      case "AssetAcquired": p.assets.push({ acqId: e.acqId, kind: e.kind, name: e.name, value: e.value }); break;
      case "AssetRemoved": p.assets = p.assets.filter((x) => x.acqId !== e.acqId); break;
      case "LiabilityIncurred": p.liabilities.push({ id: e.id, kind: e.kind, label: e.label, balance: e.balance, acqId: e.acqId, rate: e.rate, payment: e.payment }); break;
      case "LiabilityReduced": p.liabilities = p.liabilities.map((x) => (x.id === e.id ? { ...x, balance: x.balance - e.amount } : x)); break;
      case "LiabilityRetired": p.liabilities = p.liabilities.filter((x) => (e.id ? x.id !== e.id : x.acqId !== e.acqId)); break;
      case "LiabilityChanged": p.liabilities = p.liabilities.map((x) => (x.id === e.id ? { ...x, balance: e.balance, label: e.label ?? x.label } : x)); break;
      case "CashReceived": p.cash += e.amount; break;
      case "CashSpent": p.cash -= e.amount; break;
      case "PaydayReceived":
        p.cash += e.amount;
        history.push(snapshot(p, p.month, lastDate));
        break;
      case "MonthAdvanced":
        if (history.length === 0) history.push(snapshot(p, 0, null));
        p.month = e.month;
        lastDate = e.date ?? null;
        break;
      case "RatRaceEscaped": p.escapedEver = true; break;
      default: break;
    }
  }
  const final = summarize(p);
  return { ...p, ...final, escapePct: coveragePct(final.passiveIncome, final.totalExpenses), history };
}
