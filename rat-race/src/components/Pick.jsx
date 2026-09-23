import { C } from "../theme.js";
import { Note } from "./Note.jsx";

export function Pick({ items, val, onPick, empty, children }) {
  if (items.length === 0) return <Note>{empty}</Note>;
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
        {items.map((it) => (
          <button key={it.id} className="cf-btn" onClick={() => onPick(it.id)}
            style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", fontSize: 14, textAlign: "left",
              background: val === it.id ? C.plum : C.panel, color: val === it.id ? C.plumInk : C.ink,
              border: `1px solid ${val === it.id ? C.plum : C.line}`, borderRadius: 9, cursor: "pointer" }}>
            <span>{it.label}</span><span className="cf-num">{it.sub}</span>
          </button>
        ))}
      </div>
      {children}
    </>
  );
}
