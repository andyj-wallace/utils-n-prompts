import { C } from "../theme.js";

export function ActionSheet({ title, onClose, onConfirm, children }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,24,18,.4)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 560, background: C.paper, borderRadius: "16px 16px 0 0", padding: 18, animation: "cf-up .22s ease", maxHeight: "88%", overflowY: "auto" }}>
        <div className="cf-disp" style={{ fontSize: 19, fontWeight: 600, marginBottom: 14 }}>{title}</div>
        {children}
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="cf-btn" onClick={onClose} style={{ flex: 1, padding: "12px", fontSize: 15, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, color: C.ink, cursor: "pointer" }}>Cancel</button>
          <button className="cf-btn cf-disp" onClick={onConfirm} style={{ flex: 2, padding: "12px", fontSize: 15, fontWeight: 600, background: C.plum, border: "none", borderRadius: 9, color: C.plumInk, cursor: "pointer" }}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
