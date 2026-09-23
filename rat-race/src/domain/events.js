/* ---------- event-log primitives ---------- */
let _seq = 0;
export const uid = (p = "e") => `${p}_${(_seq++).toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

export const ev = (type, data) => ({ type, ...data });
