import { C } from "../theme.js";

/* Sits above the ActionSheet (zIndex 50) so rejections surface even
   while a payment sheet is open. */
export function ErrorDialog({ title, message, onClose }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(30,24,18,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20, animation: "cf-fade .15s ease" }}>
      <div role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 380, background: C.paper, border: `1px solid ${C.clay}`, borderRadius: 12, padding: 18, boxShadow: "0 12px 32px rgba(30,24,18,.25)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: C.clay, marginBottom: 4 }}>REJECTED</div>
        {title && <div className="cf-disp" style={{ fontSize: 17, fontWeight: 600, color: C.ink, marginBottom: 8 }}>{title}</div>}
        <div style={{ fontSize: 14, lineHeight: 1.5, color: C.ink }}>{message}</div>
        <button className="cf-btn cf-disp" autoFocus onClick={onClose} style={{ width: "100%", marginTop: 14, padding: "11px", fontSize: 15, fontWeight: 600, background: C.plum, border: "none", borderRadius: 9, color: C.plumInk, cursor: "pointer" }}>OK</button>
      </div>
    </div>
  );
}
