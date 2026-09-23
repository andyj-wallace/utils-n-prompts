import { useState } from "react";
import { C } from "../theme.js";
import { num } from "../domain/format.js";
import { DEBT_TYPES } from "../domain/debt.js";
import { buildSetupEvents } from "../domain/setup.js";
import { Bar } from "../components/Bar.jsx";
import { Note } from "../components/Note.jsx";
import { FieldInput } from "../components/FieldInput.jsx";

let _rowSeq = 0;
const rowKey = () => `r${_rowSeq++}`;

function useRows(empty) {
  const [rows, setRows] = useState([]);
  const add = () => setRows((r) => [...r, { key: rowKey(), ...empty }]);
  const update = (key, field, value) => setRows((r) => r.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
  const remove = (key) => setRows((r) => r.filter((row) => row.key !== key));
  return [rows, add, update, remove];
}

const cardStyle = { position: "relative", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 38px 0 10px", marginTop: 8, background: C.panel2 };
const removeRowBtn = { position: "absolute", top: 8, right: 8, width: 24, height: 24, padding: 0, lineHeight: 1, fontSize: 15, background: "transparent", border: `1px solid ${C.line}`, borderRadius: 6, color: C.clay, cursor: "pointer" };
const addRowBtn = { marginTop: 8, width: "100%", padding: "9px", fontSize: 13, background: C.panel2, border: `1px dashed ${C.line}`, borderRadius: 8, color: C.soft, cursor: "pointer" };

function validate({ startingCash, salary, expenses, liabilities, assets }) {
  const problems = [];
  if (num(startingCash) < 0) problems.push("Starting cash can’t be negative.");
  if (num(salary) < 0) problems.push("Salary can’t be negative.");

  for (const x of expenses) {
    const hasLabel = (x.label || "").trim() !== "";
    const hasAmount = num(x.amount) !== 0;
    if (!hasLabel && !hasAmount) continue;
    if (!hasLabel) problems.push("Every expense needs a name.");
    if (num(x.amount) <= 0) problems.push(`“${x.label || "Expense"}” needs a monthly amount greater than $0.`);
  }

  for (const l of liabilities) {
    const hasLabel = (l.label || "").trim() !== "";
    const hasBalance = num(l.balance) !== 0;
    if (!hasLabel && !hasBalance) continue;
    if (num(l.balance) <= 0) problems.push(`“${l.label || "That liability"}” needs a balance greater than $0.`);
  }

  for (const a of assets) {
    const hasName = (a.name || "").trim() !== "";
    const hasValue = num(a.value) !== 0;
    if (!hasName && !hasValue) continue;
    if (num(a.value) <= 0) problems.push(`“${a.name || "That asset"}” needs a value greater than $0.`);
  }

  return problems;
}

export default function Onboarding({ onComplete }) {
  const [startingCash, setStartingCash] = useState("");
  const [salary, setSalary] = useState("");
  const [expenses, addExpense, updateExpense, removeExpense] = useRows({ label: "", amount: "" });
  const [liabilities, addLiability, updateLiability, removeLiability] = useRows({ label: "", balance: "", ruleType: "creditcard", payment: "" });
  const [assets, addAsset, updateAsset, removeAsset] = useRows({ kind: "Asset", name: "", value: "", mortgage: "", cashflow: "" });
  const [errors, setErrors] = useState([]);

  const submit = () => {
    const setup = { startingCash, salary, expenses, liabilities, assets };
    const problems = validate(setup);
    if (problems.length) { setErrors(problems); return; }
    setErrors([]);
    onComplete(buildSetupEvents(setup));
  };

  return (
    <div className="cf" style={{ background: C.paper, color: C.ink, minHeight: "100%", fontFamily: "Georgia, 'Times New Roman', serif", padding: "16px 14px 40px", maxWidth: 560, margin: "0 auto" }}>

      <div className="cf-disp" style={{ fontSize: 26, fontWeight: 600 }}>Rat Race</div>
      <div style={{ fontSize: 13, color: C.soft, marginTop: 2, marginBottom: 14 }}>
        Set up your starting position — cash, salary, monthly expenses, liabilities, and any assets you already own. This becomes month 1.
      </div>

      <section>
        <Bar title="STARTING POSITION" />
        <div style={{ padding: "10px 6px 0" }}>
          <FieldInput label="Starting cash" prefix="$" value={startingCash} onChange={setStartingCash} />
          <FieldInput label="Monthly salary" prefix="$" value={salary} onChange={setSalary} />
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <Bar title="MONTHLY EXPENSES" />
        <div style={{ padding: "4px 6px 0" }}>
          {expenses.map((x) => (
            <div key={x.key} style={cardStyle}>
              <button className="cf-btn" onClick={() => removeExpense(x.key)} style={removeRowBtn} aria-label="Remove expense">×</button>
              <FieldInput label="Name (e.g. Taxes, Rent, Groceries)" value={x.label} onChange={(v) => updateExpense(x.key, "label", v)} />
              <FieldInput label="Monthly amount" prefix="$" value={x.amount} onChange={(v) => updateExpense(x.key, "amount", v)} />
            </div>
          ))}
          <button className="cf-btn" onClick={addExpense} style={addRowBtn}>+ Add expense</button>
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <Bar title="STARTING LIABILITIES" />
        <div style={{ padding: "4px 6px 0" }}>
          {liabilities.map((l) => {
            const ruleType = l.ruleType || "creditcard";
            return (
              <div key={l.key} style={cardStyle}>
                <button className="cf-btn" onClick={() => removeLiability(l.key)} style={removeRowBtn} aria-label="Remove liability">×</button>
                <FieldInput label="Name (optional — defaults to the type)" value={l.label} onChange={(v) => updateLiability(l.key, "label", v)} />
                <FieldInput label="Amount owed" prefix="$" value={l.balance} onChange={(v) => updateLiability(l.key, "balance", v)} />
                <div style={{ fontSize: 12, color: C.soft, margin: "2px 0 4px" }}>Payment type</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {DEBT_TYPES.map((t) => (
                    <button key={t.id} className="cf-btn" onClick={() => updateLiability(l.key, "ruleType", t.id)}
                      style={{ flex: "1 0 28%", padding: "8px 4px", fontSize: 12, lineHeight: 1.3, borderRadius: 8, cursor: "pointer",
                        background: ruleType === t.id ? C.plum : C.panel, color: ruleType === t.id ? C.plumInk : C.ink,
                        border: `1px solid ${ruleType === t.id ? C.plum : C.line}` }}>
                      {t.label}<br /><span style={{ fontSize: 10, opacity: 0.8 }}>{t.sub}</span>
                    </button>
                  ))}
                </div>
                {ruleType === "fixed" && <FieldInput label="Monthly payment" prefix="$" value={l.payment} onChange={(v) => updateLiability(l.key, "payment", v)} />}
              </div>
            );
          })}
          <button className="cf-btn" onClick={addLiability} style={addRowBtn}>+ Add liability</button>
          <Note>Rate liabilities (credit card, retail, bank loan) pay a % of the balance and shrink as you pay them down. Fixed $ liabilities carry a set monthly payment. Net liabilities carry no payment.</Note>
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <Bar title="STARTING ASSETS (OPTIONAL)" />
        <div style={{ padding: "4px 6px 0" }}>
          {assets.map((a) => {
            const kind = a.kind || "Asset";
            return (
              <div key={a.key} style={cardStyle}>
                <button className="cf-btn" onClick={() => removeAsset(a.key)} style={removeRowBtn} aria-label="Remove asset">×</button>
                <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                  {[["Asset", "Other asset"], ["RealEstate", "Real estate"]].map(([k, t]) => (
                    <button key={k} className="cf-btn" onClick={() => updateAsset(a.key, "kind", k)}
                      style={{ flex: 1, padding: "8px 4px", fontSize: 12, borderRadius: 8, cursor: "pointer",
                        background: kind === k ? C.plum : C.panel, color: kind === k ? C.plumInk : C.ink,
                        border: `1px solid ${kind === k ? C.plum : C.line}` }}>{t}</button>
                  ))}
                </div>
                <FieldInput label="Name" value={a.name} onChange={(v) => updateAsset(a.key, "name", v)} />
                <FieldInput label="Value" prefix="$" value={a.value} onChange={(v) => updateAsset(a.key, "value", v)} />
                <FieldInput label="Mortgage / loan owed (optional)" prefix="$" value={a.mortgage} onChange={(v) => updateAsset(a.key, "mortgage", v)} />
                <FieldInput label="Monthly cash flow, net (optional)" prefix="$" value={a.cashflow} onChange={(v) => updateAsset(a.key, "cashflow", v)} />
              </div>
            );
          })}
          <button className="cf-btn" onClick={addAsset} style={addRowBtn}>+ Add asset</button>
          <Note>Cash flow should be net — if a property has a mortgage payment, subtract it first. That net figure becomes passive income.</Note>
        </div>
      </section>

      {errors.length > 0 && (
        <div style={{ marginTop: 14, padding: "10px 12px", background: "#f7e4dc", border: `1px solid ${C.clay}`, borderRadius: 9, color: C.clay, fontSize: 13, animation: "cf-fade .2s" }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Fix the following:</div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <button className="cf-btn cf-disp" onClick={submit}
        style={{ width: "100%", marginTop: 14, padding: "13px", fontSize: 16, fontWeight: 600, color: C.plumInk, background: C.plum, border: "none", borderRadius: 10, cursor: "pointer" }}>
        Start tracking
      </button>
    </div>
  );
}
