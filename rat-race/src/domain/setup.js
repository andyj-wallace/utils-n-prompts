import { num } from "./format.js";
import { uid, ev } from "./events.js";
import { DEBT_TYPES } from "./debt.js";

/* ---------- onboarding -> seed events ----------
   Turns the declared starting position (cash, salary, expenses,
   liabilities, assets) into the same shape of event batch the old hardcoded
   seed used to produce, tagged so it's treated as the initial setup. */
export function buildSetupEvents(setup) {
  const events = [];

  events.push(ev("SalaryChanged", { amount: Math.max(0, Math.round(num(setup.salary))) }));

  for (const x of setup.expenses ?? []) {
    const amount = Math.round(num(x.amount));
    if (amount <= 0) continue;
    events.push(ev("ExpenseAdded", { id: uid("E"), label: (x.label || "").trim() || "Expense", amount }));
  }

  for (const l of setup.liabilities ?? []) {
    const balance = Math.round(num(l.balance));
    if (balance <= 0) continue;
    const t = DEBT_TYPES.find((d) => d.id === l.ruleType) || DEBT_TYPES[0];
    const label = (l.label || "").trim() || t.name;
    const liab = { id: uid("L"), kind: "Debt", label, balance };
    if (t.rate) liab.rate = t.rate;
    else if (t.id === "fixed") {
      const pay = Math.round(num(l.payment));
      if (pay > 0) liab.payment = pay;
    }
    events.push(ev("LiabilityIncurred", liab));
  }

  for (const a of setup.assets ?? []) {
    const value = Math.round(num(a.value));
    if (value <= 0) continue;
    const acqId = uid("A");
    const isRealEstate = a.kind === "RealEstate";
    const name = (a.name || "").trim() || (isRealEstate ? "Property" : "Asset");
    events.push(ev("AssetAcquired", { acqId, kind: isRealEstate ? "RealEstate" : "Asset", name, value }));

    const mortgage = Math.round(num(a.mortgage));
    if (mortgage > 0) {
      events.push(ev("LiabilityIncurred", { id: uid("L"), kind: isRealEstate ? "Mortgage" : "AssetLoan", label: `${name} mortgage`, balance: mortgage, acqId }));
    }

    const cashflow = Math.round(num(a.cashflow));
    if (cashflow !== 0) {
      events.push(ev("IncomeAdded", { id: uid("I"), label: name, amount: cashflow, passive: true, acqId }));
    }
  }

  const startingCash = Math.round(num(setup.startingCash));
  if (startingCash > 0) {
    events.push(ev("CashReceived", { amount: startingCash, reason: "Starting cash" }));
  }

  return events.map((e) => ({ ...e, batch: "seed", batchLabel: "Starting position" }));
}
