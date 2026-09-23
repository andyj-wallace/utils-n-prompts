/* ---------- local persistence: localStorage + JSON file export/import ---------- */
export const STORAGE_KEY = "ratrace.events.v1";

export function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  } catch {
    // ignore (e.g. storage quota exceeded)
  }
}

export function clearEvents() {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportEvents(events, filename) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `ratrace-save-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importEventsFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!Array.isArray(parsed)) throw new Error();
        resolve(parsed);
      } catch {
        reject(new Error("That file doesn't look like a valid save."));
      }
    };
    reader.readAsText(file);
  });
}
