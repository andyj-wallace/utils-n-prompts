import { num, money } from "./format.js";
import { uid, ev } from "./events.js";
import { LOAN_RATE, DEBT_TYPES } from "./debt.js";

/* ---------- the command handlers: check, then return events ---------- */
export const ok = (events) => ({ ok: true, events });
export const rej = (reason) => ({ ok: false, reason });

export function takeLoan(p, { amount }) {
  amount = Math.round(num(amount));
  if (amount <= 0) return rej("Enter a loan amount greater than zero.");
  if (amount % 1000 !== 0) return rej(`Bank loans come in $1,000 units — ${money(amount)} isn’t a multiple of $1,000.`);
  return ok([
    ev("LiabilityIncurred", { id: uid("L"), kind: "BankLoan", label: "Bank Loan", balance: amount, rate: LOAN_RATE }),
    ev("CashReceived", { amount, reason: "Loan proceeds" }),
  ]);
}

export function buyRealEstate(p, { name, cost, down, mortgage, cashflow }) {
  name = (name || "").trim() || "Property";
  cost = num(cost); down = num(down); mortgage = num(mortgage); cashflow = num(cashflow);
  if (cost <= 0) return rej("Enter the property cost — it must be more than zero.");
  if (down < 0) return rej("The down payment can’t be negative.");
  if (down > p.cash) return rej(`Not enough cash — the down payment is ${money(down)} but you only have ${money(p.cash)} on hand.`);
  const acqId = uid("A");
  const out = [ev("AssetAcquired", { acqId, kind: "RealEstate", name, value: cost })];
  if (mortgage > 0) out.push(ev("LiabilityIncurred", { id: uid("L"), kind: "Mortgage", label: `${name} mortgage`, balance: mortgage, acqId }));
  if (cashflow !== 0) out.push(ev("IncomeAdded", { id: uid("I"), label: name, amount: cashflow, passive: true, acqId }));
  if (down > 0) out.push(ev("CashSpent", { amount: down, reason: "Down payment" }));
  return ok(out);
}

export function buyAsset(p, { name, cost, down, liability, income, payment }) {
  name = (name || "").trim() || "Asset";
  cost = num(cost); down = num(down); liability = num(liability); income = num(income);
  const pay = liability > 0 ? (payment === "" || payment == null ? Math.round(liability * LOAN_RATE) : Math.round(num(payment))) : 0;
  if (cost <= 0) return rej("Enter the asset’s cost — it must be more than zero.");
  if (down < 0) return rej("The down payment can’t be negative.");
  if (down > p.cash) return rej(`Not enough cash — the down payment is ${money(down)} but you only have ${money(p.cash)} on hand.`);
  const cashflow = Math.round(income - pay);
  const acqId = uid("A");
  const out = [ev("AssetAcquired", { acqId, kind: "Asset", name, value: cost })];
  if (liability > 0) out.push(ev("LiabilityIncurred", { id: uid("L"), kind: "AssetLoan", label: `${name} loan`, balance: liability, acqId }));
  if (cashflow !== 0) out.push(ev("IncomeAdded", { id: uid("I"), label: name, amount: cashflow, passive: true, acqId }));
  if (down > 0) out.push(ev("CashSpent", { amount: down, reason: "Asset purchase" }));
  return ok(out);
}

export function sellAsset(p, { acqId, salePrice }) {
  const a = p.assets.find((x) => x.acqId === acqId);
  if (!a) return rej("Pick an asset to sell.");
  salePrice = num(salePrice);
  const mort = p.liabilities.filter((l) => l.acqId === acqId).reduce((s, l) => s + l.balance, 0);
  const net = salePrice - mort;
  const out = [ev("AssetRemoved", { acqId }), ev("IncomeRemoved", { acqId }), ev("LiabilityRetired", { acqId })];
  out.push(net >= 0 ? ev("CashReceived", { amount: net, reason: `Sold ${a.name}` }) : ev("CashSpent", { amount: -net, reason: `Sold ${a.name} (underwater)` }));
  return ok(out);
}

export function repayLoan(p, { id, amount }) {
  const l = p.liabilities.find((x) => x.id === id);
  if (!l) return rej("Pick a liability to pay.");
  amount = Math.round(num(amount));
  if (amount <= 0) return rej("Enter a payment amount greater than zero.");
  if (amount > l.balance) return rej(`That’s more than you owe — the ${l.label} balance is only ${money(l.balance)}.`);
  if (amount > p.cash) return rej(`Not enough cash — the payment is ${money(amount)} but you only have ${money(p.cash)} on hand.`);
  if (amount === l.balance)
    return ok([ev("CashSpent", { amount, reason: `Paid off ${l.label}` }), ev("LiabilityRetired", { id })]);
  return ok([ev("CashSpent", { amount, reason: `Paid down ${l.label}` }), ev("LiabilityReduced", { id, amount })]);
}

export function advanceMonth(p, { date } = {}) {
  const m = p.month + 1;
  const out = [ev("MonthAdvanced", { month: m, date: date ?? null }), ev("PaydayReceived", { amount: p.payday })];
  if (p.escaped && !p.escapedEver) out.push(ev("RatRaceEscaped", { month: m, date: date ?? null }));
  return ok(out);
}

export function changeSalary(p, { amount }) {
  amount = Math.round(num(amount));
  if (amount < 0) return rej("Salary can’t be negative.");
  return ok([ev("SalaryChanged", { amount })]);
}

export function incurDoodad(p, { amount, label }) {
  amount = Math.round(num(amount));
  if (amount <= 0) return rej("Enter the expense amount — it must be more than zero.");
  return ok([ev("CashSpent", { amount, reason: (label || "").trim() || "Surprise expense" })]);
}

export function addExpense(p, { label, amount }) {
  label = (label || "").trim();
  amount = Math.round(num(amount));
  if (!label) return rej("Give the expense a name.");
  if (amount <= 0) return rej("Enter a monthly amount greater than zero.");
  return ok([ev("ExpenseAdded", { id: uid("E"), label, amount })]);
}

export function editExpense(p, { id, label, amount }) {
  const x = p.expenses.find((e) => e.id === id);
  if (!x || x.derived) return rej("Pick an editable expense.");
  amount = Math.round(num(amount));
  if (amount < 0) return rej("Amount can’t be negative.");
  label = (label || "").trim() || x.label;
  return ok([ev("ExpenseChanged", { id, label, amount })]);
}

export function removeExpense(p, { id }) {
  return ok([ev("ExpenseRemoved", { id })]);
}

export function addLiability(p, { label, balance, ruleType, payment }) {
  const t = DEBT_TYPES.find((d) => d.id === ruleType) || DEBT_TYPES[0];
  label = (label || "").trim() || t.name;
  balance = Math.round(num(balance));
  if (balance <= 0) return rej("Enter the amount owed — it must be more than zero.");
  const liab = { id: uid("L"), kind: "Debt", label, balance };
  if (t.rate) liab.rate = t.rate;
  else if (t.id === "fixed") { const pay = Math.round(num(payment)); if (pay > 0) liab.payment = pay; }
  return ok([ev("LiabilityIncurred", liab)]);
}

export function editLiability(p, { id, label, balance }) {
  const l = p.liabilities.find((x) => x.id === id);
  if (!l) return rej("Pick a liability.");
  balance = Math.round(num(balance));
  if (balance < 0) return rej("Balance can’t be negative.");
  label = (label || "").trim() || l.label;
  return ok([ev("LiabilityChanged", { id, label, balance })]);
}

export function removeLiability(p, { id }) {
  return ok([ev("LiabilityRetired", { id })]);
}
