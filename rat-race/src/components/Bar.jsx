import { C } from "../theme.js";

export function Bar({ title }) {
  return (
    <div className="cf-disp" style={{ background: C.plum, color: C.plumInk, padding: "6px 12px", fontSize: 14, fontWeight: 600, letterSpacing: ".04em", borderRadius: 6 }}>
      {title}
    </div>
  );
}
