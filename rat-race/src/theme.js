/* ---------- palette + fonts (parchment ledger, nods to the board) ---------- */
export const C = {
  paper: "#f1e9d7", panel: "#fbf7ec", panel2: "#f6efdf",
  ink: "#2c2722", soft: "#7a6e5c", faint: "#9b8f7a",
  line: "#ddd0b6", plum: "#5d4a6b", plumInk: "#f3ecdd",
  green: "#3f6b4a", clay: "#9c4a30", gold: "#9a6f23",
};

export const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap');
.cf * { box-sizing: border-box; }
.cf-disp { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; }
.cf-num  { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-variant-numeric: tabular-nums; }
.cf-btn { transition: transform .08s ease, background .15s ease, opacity .15s; }
.cf-btn:active { transform: scale(.97); }
.cf-btn:disabled { opacity: .4; }
@keyframes cf-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes cf-fade { from { opacity: 0; } to { opacity: 1; } }
`;
