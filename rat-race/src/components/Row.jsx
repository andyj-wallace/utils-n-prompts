import { C } from "../theme.js";

export function Row({ label, amount, color, muted, onTap }) {
  return (
    <div onClick={onTap} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 4px", borderBottom: `1px solid ${C.line}`, cursor: onTap ? "pointer" : "default" }}>
      <span style={{ fontSize: 14, color: muted ? C.soft : C.ink }}>{label}</span>
      <span className="cf-num" style={{ fontSize: 14, color: color || C.ink }}>{amount}</span>
    </div>
  );
}
