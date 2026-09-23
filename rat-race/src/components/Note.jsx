import { C } from "../theme.js";

export function Note({ children }) {
  return <div style={{ fontSize: 12, color: C.soft, lineHeight: 1.5, background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", marginTop: 2 }}>{children}</div>;
}
