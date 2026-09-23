import { C } from "../theme.js";
import { num, money } from "../domain/format.js";
import { LOAN_RATE, DEBT_TYPES } from "../domain/debt.js";
import {
  takeLoan, buyRealEstate, buyAsset, sellAsset, repayLoan,
  changeSalary, incurDoodad, addExpense, editExpense, removeExpense,
  addLiability, editLiability, removeLiability,
} from "../domain/commands.js";
import { FieldInput } from "./FieldInput.jsx";
import { Note } from "./Note.jsx";
import { Pick } from "./Pick.jsx";

const removeBtn = { width: "100%", marginTop: 2, padding: "10px", fontSize: 13, background: "transparent", border: `1px solid ${C.clay}`, borderRadius: 8, color: C.clay, cursor: "pointer" };

/* ---------- the action-sheet config for every command ----------
   Built fresh each render from live `form`/`p` state (same as the
   inline object this replaces) so previews stay in sync with input. */
export function buildActionSheets({ form, set, p, run }) {
  const liab = num(form.liability), inc = num(form.income);
  const assetPay = liab > 0 ? (form.payment === "" || form.payment == null ? Math.round(liab * LOAN_RATE) : Math.round(num(form.payment))) : 0;
  const assetPayIsDefault = liab > 0 && (form.payment === "" || form.payment == null);
  const assetNet = Math.round(inc - assetPay);
  const ruleType = form.ruleType || "creditcard";

  return {
    loan: {
      title: "Take a loan",
      body: <>
        <FieldInput label="Amount (multiples of $1,000)" prefix="$" value={form.amount} onChange={(v) => set("amount", v)} />
        <Note>Adds a liability + cash now. A 10% monthly payment appears automatically.</Note>
      </>,
      go: () => run(takeLoan, form, `Loan ${money(num(form.amount))}`),
    },

    property: {
      title: "Buy real estate",
      body: <>
        <FieldInput label="Name (e.g. 3/2 House)" value={form.name} onChange={(v) => set("name", v)} />
        <FieldInput label="Cost" prefix="$" value={form.cost} onChange={(v) => set("cost", v)} />
        <FieldInput label="Down payment" prefix="$" value={form.down} onChange={(v) => set("down", v)} />
        <FieldInput label="Mortgage" prefix="$" value={form.mortgage} onChange={(v) => set("mortgage", v)} />
        <FieldInput label="Monthly cash flow (net)" prefix="$" value={form.cashflow} onChange={(v) => set("cashflow", v)} />
        <Note>Cash flow is net — the property’s mortgage payment is already inside it, so it adds no expense line.</Note>
      </>,
      go: () => run(buyRealEstate, form, `Buy ${(form.name || "property")}`),
    },

    asset: {
      title: "Buy an asset",
      body: <>
        <FieldInput label="Name (business, fund, CD…)" value={form.name} onChange={(v) => set("name", v)} />
        <FieldInput label="Cost (asset value)" prefix="$" value={form.cost} onChange={(v) => set("cost", v)} />
        <FieldInput label="Down payment (cash now)" prefix="$" value={form.down} onChange={(v) => set("down", v)} />
        <FieldInput label="Loan / liability attached (optional)" prefix="$" value={form.liability} onChange={(v) => set("liability", v)} />
        <FieldInput label="Gross monthly income (optional)" prefix="$" value={form.income} onChange={(v) => set("income", v)} />
        {liab > 0 && <FieldInput label="Loan payment (blank = 10% of loan)" prefix="$" value={form.payment} onChange={(v) => set("payment", v)} />}
        <Note>Net cash flow = income − loan payment = <b style={{ color: assetNet >= 0 ? C.green : C.clay }}>{money(assetNet)}/mo</b>{liab > 0 ? ` (payment ${money(assetPay)}${assetPayIsDefault ? ", the 10% default" : ""})` : ""}. That net figure is what lands under Income.</Note>
      </>,
      go: () => run(buyAsset, form, `Buy ${(form.name || "asset")}`),
    },

    sell: {
      title: "Sell an asset",
      body: (
        <Pick items={p.assets.map((a) => ({ id: a.acqId, label: a.name, sub: money(a.value) }))} val={form.acqId} onPick={(id) => set("acqId", id)} empty="No assets to sell.">
          <FieldInput label="Sale price" prefix="$" value={form.salePrice} onChange={(v) => set("salePrice", v)} />
        </Pick>
      ),
      go: () => run(sellAsset, form, "Sell asset"),
    },

    repay: {
      title: "Pay down a liability",
      body: (
        <Pick items={p.liabilities.map((l) => ({ id: l.id, label: l.label, sub: money(l.balance) }))} val={form.id} onPick={(id) => set("id", id)} empty="No liabilities.">
          <FieldInput label="Amount to pay" prefix="$" value={form.amount} onChange={(v) => set("amount", v)} />
        </Pick>
      ),
      go: () => run(repayLoan, form, "Repay liability"),
    },

    salary: {
      title: "Change salary",
      body: <FieldInput label="New monthly salary" prefix="$" value={form.amount} onChange={(v) => set("amount", v)} />,
      go: () => run(changeSalary, form, "Change salary"),
    },

    doodad: {
      title: "Surprise expense",
      body: <>
        <FieldInput label="What was it?" value={form.label} onChange={(v) => set("label", v)} />
        <FieldInput label="Amount" prefix="$" value={form.amount} onChange={(v) => set("amount", v)} />
        <Note>Cash can dip below zero — it’ll show in red as a flag.</Note>
      </>,
      go: () => run(incurDoodad, form, "Surprise expense"),
    },

    addExpense: {
      title: "Add monthly expense",
      body: <>
        <FieldInput label="Name (e.g. Gym, Insurance)" value={form.label} onChange={(v) => set("label", v)} />
        <FieldInput label="Monthly amount" prefix="$" value={form.amount} onChange={(v) => set("amount", v)} />
        <Note>Adds a recurring line to Expenses — subtracted every payday, and it counts against your escape target.</Note>
      </>,
      go: () => run(addExpense, form, `Add ${(form.label || "expense")}`),
    },

    editExpense: {
      title: form.label ? `Edit · ${form.label}` : "Edit expense",
      body: <>
        <FieldInput label="Name" value={form.label} onChange={(v) => set("label", v)} />
        <FieldInput label="Monthly amount" prefix="$" value={form.amount} onChange={(v) => set("amount", v)} />
        <button className="cf-btn" onClick={() => run(removeExpense, { id: form.id }, "Remove expense")} style={removeBtn}>Remove this expense</button>
      </>,
      go: () => run(editExpense, form, "Edit expense"),
    },

    addLiability: {
      title: "Add a liability",
      body: <>
        <FieldInput label="Name (optional — defaults to the type)" value={form.label} onChange={(v) => set("label", v)} />
        <FieldInput label="Amount owed" prefix="$" value={form.balance} onChange={(v) => set("balance", v)} />
        <div style={{ fontSize: 12, color: C.soft, margin: "2px 0 4px" }}>Payment type</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {DEBT_TYPES.map((t) => (
            <button key={t.id} className="cf-btn" onClick={() => set("ruleType", t.id)}
              style={{ flex: "1 0 28%", padding: "8px 4px", fontSize: 12, lineHeight: 1.3, borderRadius: 8, cursor: "pointer",
                background: ruleType === t.id ? C.plum : C.panel, color: ruleType === t.id ? C.plumInk : C.ink,
                border: `1px solid ${ruleType === t.id ? C.plum : C.line}` }}>
              {t.label}<br /><span style={{ fontSize: 10, opacity: 0.8 }}>{t.sub}</span>
            </button>
          ))}
        </div>
        {ruleType === "fixed" && <FieldInput label="Monthly payment" prefix="$" value={form.payment} onChange={(v) => set("payment", v)} />}
        <Note>Rate liabilities (credit card, retail, bank loan) compute their payment as a % of the balance and shrink it as you pay down. Net liabilities carry no payment.</Note>
      </>,
      go: () => run(addLiability, { ...form, ruleType }, `Add ${(form.label || "liability")}`),
    },

    editLiability: {
      title: form.label ? `Edit · ${form.label}` : "Edit liability",
      body: <>
        <FieldInput label="Name" value={form.label} onChange={(v) => set("label", v)} />
        <FieldInput label="Amount owed" prefix="$" value={form.balance} onChange={(v) => set("balance", v)} />
        <Note>Editing the balance just corrects the number — it doesn’t move cash. Use “Pay down liabilities” to pay with cash. The payment follows the balance automatically.</Note>
        <button className="cf-btn" onClick={() => run(removeLiability, { id: form.id }, "Remove liability")} style={removeBtn}>Remove this liability</button>
      </>,
      go: () => run(editLiability, form, "Edit liability"),
    },
  };
}
