import { C } from "../theme.js";

export function FieldInput({ value, onChange, label, prefix }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: C.soft, display: "block", marginBottom: 3 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "center", border: `1px solid ${C.line}`, borderRadius: 8, background: "#fff", padding: "0 10px" }}>
        {prefix && <span className="cf-num" style={{ color: C.soft, marginRight: 4 }}>{prefix}</span>}
        <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} inputMode={prefix ? "decimal" : "text"}
          className="cf-num" style={{ border: "none", outline: "none", padding: "9px 0", width: "100%", fontSize: 15, background: "transparent", color: C.ink }} />
      </span>
    </label>
  );
}
