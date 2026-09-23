# CLAUDE.md

This file gives Claude Code guidance for working in this directory.

## What this is

A small personal tool for "12 Week Year"-style planning. The user enters goals, each with tactics. The tool writes a 12-week plan with one section per week, listing the tactics that are active that week, grouped by goal. Output is Markdown or PDF.

The directory is not a git repo and has no tests, build step, or dependency manifest.

## Running

```bash
python3 planner.py   # interactive CLI (stdin prompts)
python3 gui.py       # Tkinter desktop GUI
python3 -c "import gui"   # quick import/syntax check without opening a window
```

- Needs Python 3.10+ (uses `X | None` and `list[dict]` type hints).
- Tkinter comes from the standard library. There are two third-party dependencies, each installed on demand the first time it's needed: `fpdf2` for PDF output (`planner.generate_pdf`) and `pypdf` for PDF import (`importer._require_pypdf`). Both shell out to `pip install`, so the first PDF operation on a fresh machine needs network access.

## Architecture

- **`planner.py`**: the core logic and the CLI together.
  - `week_date_range`, `format_date`: week N starts at `start_date + (N-1) weeks` and ends 6 days later. Dates print as `Mar 15, 2026` (no leading zero on the day).
  - `active_tactics(goal, week_num)`: decides which tactics appear in which week. The markdown and PDF generators both call it.
  - `generate_markdown(start_date, goals) -> str` and `generate_pdf(start_date, goals, output_path)`: the two output functions. The PDF is A4 with 15 mm margins and one page per week. Each goal is a bordered header cell followed by a gray-filled cell listing its tactics.
  - Everything else (`prompt_*`, `collect_*`, `save_plan`, `load_plan`, `main`) is CLI-only I/O.
- **`importer.py`**: the reverse direction — rebuilds a plan from generated output when the JSON is gone. `load_any(path)` dispatches on the extension and every parser returns `(start_date, goals, warnings)`; `warnings` is a list of strings the caller is expected to show. `_assemble` inverts `active_tactics`: the set of weeks a description appears in becomes a one-time tactic (one week) or a recurring span (several). It imports `planner`, so `planner` imports it lazily inside `import_plan` to avoid a cycle.
- **`gui.py`**: a Tkinter app (`PlannerApp`) with modal dialogs (`GoalDialog`, `TacticDialog`, `LoadDialog`). It imports the generators and week bounds from `planner.py` and `importer` for the Import button. It has its own save/load code, which duplicates the CLI's.

If you change output formatting or week logic, make the change in `planner.py` so both front ends pick it up — and check `importer.py`, since its parsers are coupled to the exact Markdown and PDF layouts the generators emit.

## Plan data model

Saved plans are JSON files in `saved_plans/<name>.json`, next to the scripts (the folder is created on demand):

```json
{
  "start_date": "2026-03-15",
  "goals": [
    {
      "name": "Goal name",
      "tactics": [
        {"description": "Run 3x", "recurring": true,  "begin_week": 1, "end_week": 12},
        {"description": "Sign up for race", "recurring": false, "due_week": 4}
      ]
    }
  ]
}
```

- Recurring tactics appear in every week from `begin_week` to `end_week`, inclusive. One-time tactics appear only in `due_week`.
- Week bounds live in `planner.MIN_WEEK` / `planner.MAX_WEEK` (1 and 12). Use those constants rather than literals; `gui.py` imports them. The GUI's spinboxes are typable, so the arrows' range is not validation on its own: `TacticDialog._week` clamps anything above `MAX_WEEK` down and anything below `MIN_WEEK` up, writing the clamped value back into the field so the user sees it. Text that is not a whole number can't be clamped and is rejected with a warning. The CLI takes a different line: `prompt_int` re-prompts until the input is in range.
- Both UIs allow at most 13 goals. Every goal needs at least one tactic: the CLI requires one when you enter a goal, and the GUI checks when you click Generate.

## Behaviors to keep consistent across both front ends

- The default output filename is `12_week_plan_<YYYY-MM-DD>.{md,pdf}`. The CLI writes it to the current working directory. The GUI asks where to save it.
- If PDF generation fails, both front ends write Markdown instead. The GUI does this by replacing `.pdf` with `.md` in the chosen path.
- Only the CLI lets you change the start date after loading a plan. In the GUI you edit the date field directly.

## Importing from generated output

`importer.load_any(path)` accepts `.json`, `.md`, and `.pdf`. Entry points: the **Import…** button in the GUI (`PlannerApp._import`) and the `[i]` option in the CLI (`planner.import_plan`).

Three limits are inherent to reading back a rendered plan, not bugs to fix:

- **A tactic appearing in exactly one week** imports as one-time. A recurring tactic with `begin_week == end_week` produces identical output, so the two cannot be told apart.
- **PDF descriptions longer than roughly 100 characters** wrap in `multi_cell`, and each wrapped line comes back as a separate tactic. Markdown has no such limit — it writes one line per tactic. Prefer Markdown for import when both exist.
- **Gaps in a run** (only reachable by hand-editing) import as one continuous span, with a warning naming the missing weeks.

PDF parsing identifies goal headers by their bold font via `extract_text(visitor_text=...)`. If a PDF has no bold text at all, it wasn't produced by this tool and the parser raises rather than guessing.

## Files

- `12_week_plan_2026-03-15.pdf`: a sample generated output.
- `__pycache__/`, `.DS_Store`: artifacts, not source.
