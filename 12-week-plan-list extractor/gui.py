#!/usr/bin/env python3
"""12-Week Goal Planner — Desktop GUI"""

import json
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog, ttk
from datetime import date
from pathlib import Path

import importer
from planner import MAX_WEEK, MIN_WEEK, generate_markdown, generate_pdf

SAVES_DIR = Path(__file__).parent / "saved_plans"


# ---------------------------------------------------------------------------
# Dialogs
# ---------------------------------------------------------------------------

class GoalDialog(tk.Toplevel):
    def __init__(self, parent, name: str = ""):
        super().__init__(parent)
        self.title("Goal")
        self.resizable(False, False)
        self.result: str | None = None
        self.transient(parent)
        self.grab_set()

        ttk.Label(self, text="Goal name:").grid(row=0, column=0, padx=12, pady=12, sticky="w")
        self.name_var = tk.StringVar(value=name)
        entry = ttk.Entry(self, textvariable=self.name_var, width=42)
        entry.grid(row=0, column=1, padx=(0, 12), pady=12)
        entry.focus()
        entry.bind("<Return>", lambda _: self._ok())

        btns = ttk.Frame(self)
        btns.grid(row=1, column=0, columnspan=2, pady=(0, 10))
        ttk.Button(btns, text="OK", command=self._ok).pack(side="left", padx=4)
        ttk.Button(btns, text="Cancel", command=self.destroy).pack(side="left", padx=4)

        self.wait_window()

    def _ok(self):
        name = self.name_var.get().strip()
        if not name:
            messagebox.showwarning("Missing", "Please enter a goal name.", parent=self)
            return
        self.result = name
        self.destroy()


class TacticDialog(tk.Toplevel):
    def __init__(self, parent, tactic: dict | None = None):
        super().__init__(parent)
        self.title("Tactic")
        self.resizable(False, False)
        self.result: dict | None = None
        self.transient(parent)
        self.grab_set()
        self._build(tactic or {})
        self.wait_window()

    def _build(self, t: dict):
        pad = {"padx": 12, "pady": 6}

        ttk.Label(self, text="Description:").grid(row=0, column=0, sticky="w", **pad)
        self.desc_var = tk.StringVar(value=t.get("description", ""))
        entry = ttk.Entry(self, textvariable=self.desc_var, width=44)
        entry.grid(row=0, column=1, columnspan=2, sticky="ew", **pad)
        entry.focus()

        ttk.Label(self, text="Type:").grid(row=1, column=0, sticky="w", **pad)
        self.type_var = tk.StringVar(value="r" if t.get("recurring") else "o")
        ttk.Radiobutton(self, text="Recurring weekly", variable=self.type_var,
                        value="r", command=self._toggle).grid(row=1, column=1, sticky="w")
        ttk.Radiobutton(self, text="One-time", variable=self.type_var,
                        value="o", command=self._toggle).grid(row=1, column=2, sticky="w", padx=(0, 12))

        # One-time fields
        self.one_frame = ttk.Frame(self)
        self.one_frame.grid(row=2, column=0, columnspan=3, sticky="w", padx=12, pady=4)
        ttk.Label(self.one_frame, text="Due week:").pack(side="left")
        self.due_var = tk.StringVar(value=str(t.get("due_week", MIN_WEEK)))
        ttk.Spinbox(self.one_frame, from_=MIN_WEEK, to=MAX_WEEK, textvariable=self.due_var, width=5).pack(side="left", padx=6)

        # Recurring fields
        self.rec_frame = ttk.Frame(self)
        self.rec_frame.grid(row=3, column=0, columnspan=3, sticky="w", padx=12, pady=4)
        ttk.Label(self.rec_frame, text="Begin week:").pack(side="left")
        self.begin_var = tk.StringVar(value=str(t.get("begin_week", MIN_WEEK)))
        ttk.Spinbox(self.rec_frame, from_=MIN_WEEK, to=MAX_WEEK, textvariable=self.begin_var, width=5).pack(side="left", padx=6)
        ttk.Label(self.rec_frame, text="End week:").pack(side="left", padx=(8, 0))
        self.end_var = tk.StringVar(value=str(t.get("end_week", MAX_WEEK)))
        ttk.Spinbox(self.rec_frame, from_=MIN_WEEK, to=MAX_WEEK, textvariable=self.end_var, width=5).pack(side="left", padx=6)

        self._toggle()

        btns = ttk.Frame(self)
        btns.grid(row=4, column=0, columnspan=3, pady=10)
        ttk.Button(btns, text="OK", command=self._ok).pack(side="left", padx=4)
        ttk.Button(btns, text="Cancel", command=self.destroy).pack(side="left", padx=4)

    def _toggle(self):
        if self.type_var.get() == "o":
            self.one_frame.grid()
            self.rec_frame.grid_remove()
        else:
            self.one_frame.grid_remove()
            self.rec_frame.grid()

    def _week(self, var: tk.StringVar, label: str) -> int | None:
        """Parse a week field, clamping it to MIN_WEEK–MAX_WEEK.

        The spinbox arrows stay in range, but the field is typable. Anything
        above MAX_WEEK becomes MAX_WEEK and anything below MIN_WEEK becomes
        MIN_WEEK; the clamped value is written back so the change is visible.
        Text that is not a whole number cannot be clamped, so it is rejected.
        """
        raw = var.get().strip()
        try:
            week = int(raw)
        except ValueError:
            messagebox.showwarning(
                "Invalid week",
                f"{label} must be a whole number between {MIN_WEEK} and {MAX_WEEK} "
                f"(got '{raw}').", parent=self)
            return None
        clamped = min(max(week, MIN_WEEK), MAX_WEEK)
        if clamped != week:
            var.set(str(clamped))
        return clamped

    def _ok(self):
        desc = self.desc_var.get().strip()
        if not desc:
            messagebox.showwarning("Missing", "Please enter a description.", parent=self)
            return
        if self.type_var.get() == "o":
            due = self._week(self.due_var, "Due week")
            if due is None:
                return
            self.result = {"description": desc, "recurring": False, "due_week": due}
        else:
            begin = self._week(self.begin_var, "Begin week")
            if begin is None:
                return
            end = self._week(self.end_var, "End week")
            if end is None:
                return
            if end < begin:
                messagebox.showwarning("Invalid", "End week must be ≥ begin week.", parent=self)
                return
            self.result = {"description": desc, "recurring": True,
                           "begin_week": begin, "end_week": end}
        self.destroy()


class LoadDialog(tk.Toplevel):
    def __init__(self, parent, saved: list[Path]):
        super().__init__(parent)
        self.title("Load Plan")
        self.resizable(False, False)
        self.result: Path | None = None
        self.saved = saved
        self.transient(parent)
        self.grab_set()

        ttk.Label(self, text="Select a saved plan:", padding=(12, 10)).pack()
        self.lb = tk.Listbox(self, width=38, height=min(len(saved), 10), font=("Helvetica", 12))
        self.lb.pack(padx=15, pady=(0, 8))
        for p in saved:
            self.lb.insert("end", f"  {p.stem}")
        self.lb.selection_set(0)
        self.lb.bind("<Double-Button-1>", lambda _: self._ok())

        btns = ttk.Frame(self)
        btns.pack(pady=(0, 10))
        ttk.Button(btns, text="Load", command=self._ok).pack(side="left", padx=4)
        ttk.Button(btns, text="Cancel", command=self.destroy).pack(side="left", padx=4)

        self.wait_window()

    def _ok(self):
        sel = self.lb.curselection()
        if not sel:
            return
        self.result = self.saved[sel[0]]
        self.destroy()


# ---------------------------------------------------------------------------
# Main app
# ---------------------------------------------------------------------------

class PlannerApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("12-Week Goal Planner")
        self.minsize(780, 520)

        self.goals: list[dict] = []
        self.selected_goal: int | None = None

        self._build_ui()

    def _build_ui(self):
        # ── Top bar ────────────────────────────────────────────────────────
        top = ttk.Frame(self, padding=(12, 8))
        top.pack(fill="x")
        ttk.Label(top, text="12-Week Goal Planner", font=("Helvetica", 17, "bold")).pack(side="left")
        ttk.Button(top, text="Load Plan", command=self._load).pack(side="right", padx=4)
        ttk.Button(top, text="Import…", command=self._import).pack(side="right", padx=4)
        ttk.Button(top, text="Save Plan", command=self._save).pack(side="right", padx=4)

        ttk.Separator(self).pack(fill="x")

        # ── Date row ───────────────────────────────────────────────────────
        date_row = ttk.Frame(self, padding=(12, 6))
        date_row.pack(fill="x")
        ttk.Label(date_row, text="Week 1 Start Date (YYYY-MM-DD):").pack(side="left")
        self.start_date_var = tk.StringVar(value=date.today().isoformat())
        ttk.Entry(date_row, textvariable=self.start_date_var, width=14).pack(side="left", padx=8)

        ttk.Separator(self).pack(fill="x")

        # ── Two-panel area ─────────────────────────────────────────────────
        panels = ttk.Frame(self, padding=(10, 8))
        panels.pack(fill="both", expand=True)

        # Left: Goals
        left = ttk.LabelFrame(panels, text="Goals", padding=6)
        left.pack(side="left", fill="both", expand=True, padx=(0, 6))

        # exportselection=False keeps the highlight when a dialog's entry field
        # takes the selection — otherwise the selection is silently dropped.
        self.goals_lb = tk.Listbox(left, selectmode="single", activestyle="none",
                                   exportselection=False, font=("Helvetica", 12))
        self.goals_lb.pack(fill="both", expand=True)
        self.goals_lb.bind("<<ListboxSelect>>", self._on_goal_select)
        self.goals_lb.bind("<Double-Button-1>", lambda _: self._edit_goal())

        gb = ttk.Frame(left)
        gb.pack(fill="x", pady=(6, 0))
        ttk.Button(gb, text="+ Add",    command=self._add_goal).pack(side="left", padx=2)
        ttk.Button(gb, text="✎ Edit",   command=self._edit_goal).pack(side="left", padx=2)
        ttk.Button(gb, text="✕ Remove", command=self._remove_goal).pack(side="left", padx=2)

        # Right: Tactics
        self.tactic_frame = ttk.LabelFrame(panels, text="Tactics", padding=6)
        self.tactic_frame.pack(side="left", fill="both", expand=True, padx=(6, 0))

        self.tactics_lb = tk.Listbox(self.tactic_frame, selectmode="single", activestyle="none",
                                     exportselection=False, font=("Helvetica", 11))
        self.tactics_lb.pack(fill="both", expand=True)
        self.tactics_lb.bind("<Double-Button-1>", lambda _: self._edit_tactic())

        tb = ttk.Frame(self.tactic_frame)
        tb.pack(fill="x", pady=(6, 0))
        ttk.Button(tb, text="+ Add",    command=self._add_tactic).pack(side="left", padx=2)
        ttk.Button(tb, text="✎ Edit",   command=self._edit_tactic).pack(side="left", padx=2)
        ttk.Button(tb, text="✕ Remove", command=self._remove_tactic).pack(side="left", padx=2)

        ttk.Separator(self).pack(fill="x")

        # ── Bottom bar ─────────────────────────────────────────────────────
        bottom = ttk.Frame(self, padding=(12, 8))
        bottom.pack(fill="x")
        ttk.Label(bottom, text="Output format:").pack(side="left")
        self.fmt_var = tk.StringVar(value="pdf")
        ttk.Radiobutton(bottom, text="PDF",      variable=self.fmt_var, value="pdf").pack(side="left", padx=4)
        ttk.Radiobutton(bottom, text="Markdown", variable=self.fmt_var, value="md").pack(side="left", padx=4)
        ttk.Button(bottom, text="Generate Plan", command=self._generate).pack(side="right", padx=4)

    # ── Goal helpers ───────────────────────────────────────────────────────

    def _refresh_goals(self):
        self.goals_lb.delete(0, "end")
        for i, g in enumerate(self.goals):
            self.goals_lb.insert("end", f"  {i + 1}. {g['name']}")
        self._refresh_tactics()

    def _on_goal_select(self, _=None):
        sel = self.goals_lb.curselection()
        self.selected_goal = sel[0] if sel else None
        self._refresh_tactics()

    def _add_goal(self):
        if len(self.goals) >= 13:
            messagebox.showwarning("Limit", "Maximum of 13 goals allowed.")
            return
        dlg = GoalDialog(self)
        if dlg.result:
            self.goals.append({"name": dlg.result, "tactics": []})
            self._refresh_goals()
            self.goals_lb.selection_set(len(self.goals) - 1)
            self._on_goal_select()

    def _edit_goal(self):
        goal_idx = self.selected_goal
        if goal_idx is None:
            return
        dlg = GoalDialog(self, self.goals[goal_idx]["name"])
        if dlg.result:
            self.goals[goal_idx]["name"] = dlg.result
            self._refresh_goals()
            self.goals_lb.selection_set(goal_idx)
            self._on_goal_select()

    def _remove_goal(self):
        if self.selected_goal is None:
            return
        if messagebox.askyesno("Remove", f"Remove '{self.goals[self.selected_goal]['name']}'?"):
            self.goals.pop(self.selected_goal)
            self.selected_goal = None
            self._refresh_goals()

    # ── Tactic helpers ─────────────────────────────────────────────────────

    def _refresh_tactics(self):
        self.tactics_lb.delete(0, "end")
        if self.selected_goal is None:
            self.tactic_frame.configure(text="Tactics")
            return
        goal = self.goals[self.selected_goal]
        self.tactic_frame.configure(text=f"Tactics — {goal['name']}")
        for t in goal["tactics"]:
            if t["recurring"]:
                label = f"  {t['description']}  [weeks {t['begin_week']}–{t['end_week']}]"
            else:
                label = f"  {t['description']}  [week {t['due_week']}]"
            self.tactics_lb.insert("end", label)

    def _add_tactic(self):
        # Capture the goal up front: the dialog runs a nested event loop.
        goal_idx = self.selected_goal
        if goal_idx is None:
            messagebox.showinfo("No goal selected", "Select a goal first.")
            return
        dlg = TacticDialog(self)
        if dlg.result:
            self.goals[goal_idx]["tactics"].append(dlg.result)
            self._refresh_tactics()

    def _edit_tactic(self):
        goal_idx = self.selected_goal
        if goal_idx is None:
            return
        sel = self.tactics_lb.curselection()
        if not sel:
            return
        idx = sel[0]
        dlg = TacticDialog(self, self.goals[goal_idx]["tactics"][idx])
        if dlg.result:
            self.goals[goal_idx]["tactics"][idx] = dlg.result
            self._refresh_tactics()

    def _remove_tactic(self):
        goal_idx = self.selected_goal
        if goal_idx is None:
            return
        sel = self.tactics_lb.curselection()
        if not sel:
            return
        idx = sel[0]
        desc = self.goals[goal_idx]["tactics"][idx]["description"]
        if messagebox.askyesno("Remove", f"Remove '{desc}'?"):
            self.goals[goal_idx]["tactics"].pop(idx)
            self._refresh_tactics()

    # ── Save / Load ────────────────────────────────────────────────────────

    def _save(self):
        if not self.goals:
            messagebox.showwarning("Empty", "Add at least one goal before saving.")
            return
        start_date = self._parse_date()
        if start_date is None:
            return
        name = simpledialog.askstring("Save Plan", "Save plan as:", parent=self)
        if not name:
            return
        SAVES_DIR.mkdir(exist_ok=True)
        path = SAVES_DIR / f"{name}.json"
        with open(path, "w") as f:
            json.dump({"start_date": start_date.isoformat(), "goals": self.goals}, f, indent=2)
        messagebox.showinfo("Saved", f"Plan saved as '{name}'.")

    def _load(self):
        SAVES_DIR.mkdir(exist_ok=True)
        saved = sorted(SAVES_DIR.glob("*.json"))
        if not saved:
            messagebox.showinfo("No saves", "No saved plans found.")
            return
        dlg = LoadDialog(self, saved)
        if dlg.result is None:
            return
        with open(dlg.result) as f:
            data = json.load(f)
        self.goals = data["goals"]
        self.start_date_var.set(data["start_date"])
        self.selected_goal = None
        self._refresh_goals()

    def _import(self):
        """Rebuild a plan from a generated Markdown or PDF file."""
        path = filedialog.askopenfilename(
            title="Import plan from generated file",
            filetypes=[("Plan files", "*.md *.pdf *.json"),
                       ("Markdown files", "*.md"),
                       ("PDF files", "*.pdf"),
                       ("JSON files", "*.json")])
        if not path:
            return
        try:
            start_date, goals, warnings = importer.load_any(path)
        except Exception as e:
            messagebox.showerror("Import failed", str(e))
            return

        self.goals = goals
        self.start_date_var.set(start_date.isoformat())
        self.selected_goal = None
        self._refresh_goals()

        summary = (f"Imported {len(goals)} goal(s) and "
                   f"{sum(len(g['tactics']) for g in goals)} tactic(s).")
        if warnings:
            messagebox.showwarning("Imported with warnings",
                                   summary + "\n\n• " + "\n• ".join(warnings))
        else:
            messagebox.showinfo("Imported", summary)

    # ── Generate ───────────────────────────────────────────────────────────

    def _parse_date(self) -> date | None:
        try:
            return date.fromisoformat(self.start_date_var.get().strip())
        except ValueError:
            messagebox.showerror("Invalid date", "Start date must be YYYY-MM-DD (e.g. 2026-03-15).")
            return None

    def _generate(self):
        if not self.goals:
            messagebox.showwarning("Empty", "Add at least one goal.")
            return
        for g in self.goals:
            if not g["tactics"]:
                messagebox.showwarning("Empty tactics", f"'{g['name']}' has no tactics.")
                return
        start_date = self._parse_date()
        if start_date is None:
            return

        fmt = self.fmt_var.get()
        default_name = f"12_week_plan_{start_date}.{fmt}"
        filetypes = [("PDF files", "*.pdf"), ("Markdown files", "*.md")] if fmt == "pdf" \
               else [("Markdown files", "*.md"), ("PDF files", "*.pdf")]

        path = filedialog.asksaveasfilename(
            defaultextension=f".{fmt}",
            filetypes=filetypes,
            initialfile=default_name,
        )
        if not path:
            return

        try:
            if fmt == "md":
                content = generate_markdown(start_date, self.goals)
                with open(path, "w") as f:
                    f.write(content)
            else:
                try:
                    generate_pdf(start_date, self.goals, path)
                except Exception as e:
                    fallback = path.replace(".pdf", ".md")
                    content = generate_markdown(start_date, self.goals)
                    with open(fallback, "w") as f:
                        f.write(content)
                    messagebox.showwarning("PDF failed",
                        f"PDF generation failed ({e}).\nSaved as Markdown instead:\n{fallback}")
                    return
            messagebox.showinfo("Done", f"Generated:\n{path}")
        except Exception as e:
            messagebox.showerror("Error", str(e))


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app = PlannerApp()
    app.mainloop()
