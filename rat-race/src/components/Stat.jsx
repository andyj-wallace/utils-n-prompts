import { C } from "../theme.js";

export function Stat({ label, value, color }) {
  return (
    <div style={{ background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px" }}>
      <div style={{ fontSize: 11, color: C.soft, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</div>
      <div className="cf-num" style={{ fontSize: 20, color: color || C.ink, marginTop: 2 }}>{value}</div>
    </div>
  );
}
