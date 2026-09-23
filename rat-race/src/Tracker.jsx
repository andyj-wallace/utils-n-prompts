import { useState, useMemo, useEffect, useRef } from "react";
import { C } from "./theme.js";
import { project } from "./domain/project.js";
import { advanceMonth } from "./domain/commands.js";
import { money } from "./domain/format.js";
import { uid } from "./domain/events.js";
import { saveEvents, exportEvents, importEventsFromFile } from "./persistence/storage.js";
import { Bar } from "./components/Bar.jsx";
import { Row } from "./components/Row.jsx";
import { Stat } from "./components/Stat.jsx";
import { History } from "./components/History.jsx";
import { ActionSheet } from "./components/ActionSheet.jsx";
import { ErrorDialog } from "./components/ErrorDialog.jsx";
import { buildActionSheets } from "./components/actionSheets.jsx";

const utilBtn = { padding: "10px 14px", fontSize: 13, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, color: C.ink, cursor: "pointer" };

export default function Tracker({ initialEvents, onReset }) {
  const [events, setEvents] = useState(initialEvents);
  const [action, setAction] = useState(null);
  const [form, setForm] = useState({});
  const [reject, setReject] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [collapsed, setCollapsed] = useState({ incomes: true, expenses: true, assets: true, liabilities: true });
  const toggleSection = (key) => setCollapsed((s) => ({ ...s, [key]: !s[key] }));
  const fileInputRef = useRef(null);

  const p = useMemo(() => project(events), [events]);
  const canUndo = events.length > 0 && events[events.length - 1].batch !== "seed";

  useEffect(() => { saveEvents(events); }, [events]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const open = (name) => { setReject(null); setForm(name === "salary" ? { amount: String(p.salary) } : {}); setAction(name); };
  const openExpense = (x) => { setReject(null); setForm({ id: x.id, label: x.label, amount: String(x.amount) }); setAction("editExpense"); };
  const openLiability = (l) => { setReject(null); setForm({ id: l.id, label: l.label, balance: String(l.balance) }); setAction("editLiability"); };

  const run = (fn, args, label) => {
    const r = fn(p, args);
    if (!r.ok) { setReject({ title: label, reason: r.reason }); return; }
    const batch = uid("b");
    setEvents((ev0) => [...ev0, ...r.events.map((e) => ({ ...e, batch, batchLabel: label }))]);
    setReject(null); setAction(null);
  };
  const undo = () => {
    const last = events[events.length - 1]?.batch;
    if (!last || last === "seed") return;
    setEvents(events.filter((e) => e.batch !== last));
    setReject(null);
  };

  const handleReset = () => {
    if (window.confirm("Start over? This will erase your saved data and return you to setup.")) onReset();
  };
  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const imported = await importEventsFromFile(file);
      setEvents(imported);
      setAction(null);
      setReject(null);
    } catch (err) {
      setReject({ title: "Import save", reason: err.message });
    }
  };

  const gap = p.totalExpenses - p.passiveIncome;

  const sheets = buildActionSheets({ form, set, p, run });

  const COLLAPSE_AT = 4;
  const slice = (items, key) => collapsed[key] && items.length > COLLAPSE_AT ? items.slice(0, COLLAPSE_AT) : items;
  const moreCount = (items, key) => collapsed[key] && items.length > COLLAPSE_AT ? items.length - COLLAPSE_AT : 0;
  const showMoreBtn = (items, key) => {
    const more = moreCount(items, key);
    const labelStyle = { fontSize: 12, color: C.soft, cursor: "pointer", background: "none", border: "none", padding: "6px 0 2px", width: "100%", textAlign: "center" };
    if (more > 0) return <button className="cf-btn" style={labelStyle} onClick={() => toggleSection(key)}>Show {more} more ▾</button>;
    if (items.length > COLLAPSE_AT) return <button className="cf-btn" style={labelStyle} onClick={() => toggleSection(key)}>Show less ▴</button>;
    return null;
  };

  return (
    <div className="cf" style={{ background: C.paper, color: C.ink, minHeight: "100%", fontFamily: "Georgia, 'Times New Roman', serif", padding: "16px 14px 40px", maxWidth: 560, margin: "0 auto" }}>

      {/* header */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div className="cf-disp" style={{ fontSize: 26, fontWeight: 600 }}>Rat Race</div>
        <div style={{ fontSize: 13, color: C.soft }}>Month <span className="cf-num" style={{ color: C.ink, fontSize: 15 }}>{p.month}</span></div>
      </div>

      {/* escape bar */}
      <div style={{ marginTop: 12, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 14 }}>
        {p.escaped ? (
          <div className="cf-disp" style={{ color: C.green, fontSize: 16, fontWeight: 600 }}>● Out of the Rat Race — passive income covers your expenses.</div>
        ) : (
          <div style={{ fontSize: 13, color: C.soft }}>Increase passive income to escape — <span className="cf-num" style={{ color: C.clay }}>{money(gap)}</span> to go.</div>
        )}
        <div style={{ height: 12, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 7, marginTop: 8, overflow: "hidden" }}>
          <div style={{ width: `${p.escapePct}%`, height: "100%", background: p.escaped ? C.green : C.plum, transition: "width .3s" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 12, color: C.soft }}>
          <span>Passive <span className="cf-num" style={{ color: C.green }}>{money(p.passiveIncome)}</span></span>
          <span>Expenses <span className="cf-num" style={{ color: C.clay }}>{money(p.totalExpenses)}</span></span>
        </div>
      </div>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <Stat label="Cash" value={money(p.cash)} color={p.cash < 0 ? C.clay : C.ink} />
        <Stat label="Payday (monthly)" value={money(p.payday)} color={p.payday < 0 ? C.clay : C.green} />
        <Stat label="Total income" value={money(p.totalIncome)} />
        <Stat label="Net worth" value={money(p.netWorth)} color={p.netWorth < 0 ? C.clay : C.ink} />
      </div>

      {/* advance + actions */}
      <button className="cf-btn cf-disp" onClick={() => run(advanceMonth, { date: new Date().toISOString().slice(0, 10) }, `Advance to month ${p.month + 1}`)}
        style={{ width: "100%", marginTop: 14, padding: "13px", fontSize: 16, fontWeight: 600, color: C.plumInk, background: C.plum, border: "none", borderRadius: 10, cursor: "pointer" }}>
        Advance one month  ·  {money(p.payday)} payday
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        {[["loan", "Take loan"], ["property", "Buy property"], ["asset", "Buy asset"], ["sell", "Sell asset"], ["repay", "Pay down liabilities"], ["salary", "Change salary"], ["doodad", "Surprise cost"]].map(([k, t]) => (
          <button key={k} className="cf-btn" onClick={() => open(k)}
            style={{ padding: "11px", fontSize: 14, color: C.ink, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, cursor: "pointer" }}>{t}</button>
        ))}
      </div>

      {/* ledger */}
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <History history={p.history} />
        <section>
          <Bar title="INCOME" />
          <div style={{ padding: "4px 6px 0" }}>
            <Row label="Salary" amount={money(p.salary)} muted />
            {slice(p.incomes, "incomes").map((i) => <Row key={i.id} label={i.label} amount={money(i.amount)} color={C.green} />)}
            {showMoreBtn(p.incomes, "incomes")}
            <Row label="Total income" amount={money(p.totalIncome)} />
          </div>
        </section>
        <section>
          <Bar title="EXPENSES" />
          <div style={{ padding: "4px 6px 0" }}>
            {slice(p.expenses, "expenses").map((x) => <Row key={x.id} label={x.label + (x.derived ? `  ·  ${x.hint}` : "")} amount={money(x.amount)} color={C.clay} muted={x.derived} onTap={x.derived ? undefined : () => openExpense(x)} />)}
            {showMoreBtn(p.expenses, "expenses")}
            <Row label="Total expenses" amount={money(p.totalExpenses)} color={C.clay} />
            <button className="cf-btn" onClick={() => open("addExpense")} style={{ marginTop: 8, marginBottom: 2, width: "100%", padding: "9px", fontSize: 13, background: C.panel2, border: `1px dashed ${C.line}`, borderRadius: 8, color: C.soft, cursor: "pointer" }}>+ Add monthly expense</button>
          </div>
        </section>
        <section>
          <Bar title="ASSETS" />
          <div style={{ padding: "4px 6px 0" }}>
            {p.assets.length === 0 && <Row label="—" amount="" muted />}
            {slice(p.assets, "assets").map((a) => <Row key={a.acqId} label={`${a.name}  ·  ${a.kind === "RealEstate" ? "real estate" : "asset"}`} amount={money(a.value)} />)}
            {showMoreBtn(p.assets, "assets")}
          </div>
        </section>
        <section>
          <Bar title="LIABILITIES" />
          <div style={{ padding: "4px 6px 0" }}>
            {p.liabilities.length === 0 && <Row label="—" amount="" muted />}
            {slice(p.liabilities, "liabilities").map((l) => <Row key={l.id} label={l.label} amount={money(l.balance)} color={C.clay} onTap={() => openLiability(l)} />)}
            {showMoreBtn(p.liabilities, "liabilities")}
            <button className="cf-btn" onClick={() => open("addLiability")} style={{ marginTop: 8, marginBottom: 2, width: "100%", padding: "9px", fontSize: 13, background: C.panel2, border: `1px dashed ${C.line}`, borderRadius: 8, color: C.soft, cursor: "pointer" }}>+ Add a liability</button>
          </div>
        </section>
      </div>

      {/* event log + save controls */}
      <div style={{ marginTop: 18 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="cf-btn" onClick={() => setLogOpen((v) => !v)} style={{ flex: 1, padding: "10px", fontSize: 13, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, color: C.ink, cursor: "pointer" }}>
            {logOpen ? "Hide" : "Show"} event log ({events.length})
          </button>
          <button className="cf-btn" disabled={!canUndo} onClick={undo} style={utilBtn}>↶ Undo</button>
        </div>
        {logOpen && (
          <div style={{ marginTop: 8, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, maxHeight: 280, overflowY: "auto" }}>
            {events.map((e, i) => (
              <div key={i} className="cf-num" style={{ fontSize: 11.5, color: C.soft, padding: "2px 0", borderBottom: i < events.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <span style={{ color: C.plum }}>{e.type}</span>
                {e.amount != null && <span> {money(e.amount)}</span>}
                {e.label && <span> · {e.label}</span>}
                {e.name && <span> · {e.name}</span>}
                {e.balance != null && <span> · bal {money(e.balance)}</span>}
                {e.month != null && <span> · m{e.month}</span>}
                {e.date && <span> · {e.date}</span>}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="cf-btn" onClick={() => exportEvents(events)} style={{ ...utilBtn, flex: 1 }}>Export save</button>
          <button className="cf-btn" onClick={() => fileInputRef.current?.click()} style={{ ...utilBtn, flex: 1 }}>Import save</button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleImport} />
          <button className="cf-btn" onClick={handleReset} style={{ ...utilBtn, flex: 1, color: C.clay, borderColor: C.clay }}>Start over</button>
        </div>
        <div style={{ fontSize: 11, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          The log is the source of truth — every number above is folded from it. Undo drops the last action’s events and recomputes.
        </div>
      </div>

      {/* action sheet */}
      {action && (
        <ActionSheet title={sheets[action].title} onClose={() => setAction(null)} onConfirm={sheets[action].go}>
          {sheets[action].body}
        </ActionSheet>
      )}

      {/* rejection dialog — rendered above the action sheet so failed
          payments are never silently swallowed */}
      {reject && <ErrorDialog title={reject.title} message={reject.reason} onClose={() => setReject(null)} />}
    </div>
  );
}
