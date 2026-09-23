import { C } from "../theme.js";
import { Bar } from "./Bar.jsx";

export function History({ history }) {
  if (!history || history.length === 0) return null;
  const rows = history.slice().reverse();
  return (
    <section>
      <Bar title="PROGRESS" />
      <div style={{ padding: "8px 6px 2px", display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.map((h, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.soft }}>
              <span>{h.month === 0 ? "Starting position" : `Month ${h.month}${h.date ? `  ·  ${h.date}` : ""}`}</span>
              <span className="cf-num" style={{ color: h.escaped ? C.green : C.ink }}>{h.escapePct}%</span>
            </div>
            <div style={{ height: 8, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 5, marginTop: 4, overflow: "hidden" }}>
              <div style={{ width: `${h.escapePct}%`, height: "100%", background: h.escaped ? C.green : C.plum, transition: "width .3s" }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
