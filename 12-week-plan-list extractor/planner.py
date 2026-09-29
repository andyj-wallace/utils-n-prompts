#!/usr/bin/env python3
"""12-Week Goal Planner — Interactive CLI"""

import json
import sys
from datetime import date, timedelta
from pathlib import Path

SAVES_DIR = Path(__file__).parent / "saved_plans"

# Week numbers are valid only within this inclusive range.
MIN_WEEK = 1
MAX_WEEK = 12

# How many weekly sections the PDF packs onto one page.
WEEKS_PER_PAGE = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def format_date(d: date) -> str:
    """Return a date string like 'Jan 25, 2026'."""
    day = str(d.day)  # no leading zero
    return d.strftime(f"%b {day}, %Y")


def week_date_range(start_date: date, week_num: int) -> tuple[date, date]:
    week_start = start_date + timedelta(weeks=week_num - 1)
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


def prompt_int(prompt: str, min_val: int, max_val: int) -> int:
    while True:
        try:
            val = int(input(prompt).strip())
            if min_val <= val <= max_val:
                return val
            print(f"  Please enter a number between {min_val} and {max_val}.")
        except ValueError:
            print("  Please enter a whole number.")


def prompt_date(prompt: str) -> date:
    while True:
        try:
            return date.fromisoformat(input(prompt).strip())
        except ValueError:
            print("  Invalid date. Use YYYY-MM-DD format (e.g. 2025-12-14).")


def prompt_choice(prompt: str, choices: list[str]) -> str:
    while True:
        val = input(prompt).strip().lower()
        if val in choices:
            return val
        print(f"  Enter one of: {', '.join(choices)}")


# ---------------------------------------------------------------------------
# Save / Load
# ---------------------------------------------------------------------------

def save_plan(start_date: date, goals: list[dict]) -> None:
    SAVES_DIR.mkdir(exist_ok=True)
    name = input("\nSave plan as (press Enter to skip): ").strip()
    if not name:
        return
    path = SAVES_DIR / f"{name}.json"
    payload = {"start_date": start_date.isoformat(), "goals": goals}
    with open(path, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"  Saved to {path.name}")


def list_saved_plans() -> list[Path]:
    if not SAVES_DIR.exists():
        return []
    return sorted(SAVES_DIR.glob("*.json"))


def load_plan() -> tuple[date, list[dict]] | None:
    saved = list_saved_plans()
    if not saved:
        print("  No saved plans found.")
        return None

    print("\nSaved plans:")
    for i, p in enumerate(saved, 1):
        print(f"  {i}. {p.stem}")

    choice = input("Select a plan number (or press Enter to cancel): ").strip()
    if not choice:
        return None
    try:
        idx = int(choice) - 1
        if not (0 <= idx < len(saved)):
            raise ValueError
    except ValueError:
        print("  Invalid selection.")
        return None

    with open(saved[idx]) as f:
        data = json.load(f)

    start_date = date.fromisoformat(data["start_date"])
    goals = data["goals"]
    print(f"  Loaded '{saved[idx].stem}' (start date: {format_date(start_date)}, {len(goals)} goals)")
    return start_date, goals


def import_plan() -> tuple[date, list[dict]] | None:
    """Rebuild a plan from a generated .md or .pdf file."""
    # Imported here: importer depends on this module for the week bounds.
    import importer

    path = input("\nPath to a generated .md or .pdf (Enter to cancel): ").strip()
    if not path:
        return None

    try:
        start_date, goals, warnings = importer.load_any(path.strip("'\" "))
    except Exception as e:
        print(f"  Import failed: {e}")
        return None

    tactic_count = sum(len(g["tactics"]) for g in goals)
    print(f"  Imported {len(goals)} goal(s) and {tactic_count} tactic(s) "
          f"(start date: {format_date(start_date)})")
    for w in warnings:
        print(f"  Note: {w}")

    save_plan(start_date, goals)
    return start_date, goals


# ---------------------------------------------------------------------------
# Data collection
# ---------------------------------------------------------------------------

def collect_tactic(index: int) -> dict | None:
    """Collect one tactic. Returns None if the user is done entering tactics."""
    print(f"\n  Tactic {index} — press Enter with no description to finish:")
    desc = input("    Description: ").strip()
    if not desc:
        return None

    ttype = prompt_choice("    Type — [r]ecurring weekly or [o]ne-time? ", ["r", "o"])

    if ttype == "o":
        due_week = prompt_int(f"    Due week ({MIN_WEEK}–{MAX_WEEK}): ", MIN_WEEK, MAX_WEEK)
        return {"description": desc, "recurring": False, "due_week": due_week}
    else:
        begin_week = prompt_int(f"    Begin week ({MIN_WEEK}–{MAX_WEEK}): ", MIN_WEEK, MAX_WEEK)
        end_week = prompt_int(f"    End week ({begin_week}–{MAX_WEEK}): ", begin_week, MAX_WEEK)
        return {
            "description": desc,
            "recurring": True,
            "begin_week": begin_week,
            "end_week": end_week,
        }


def collect_goal(index: int) -> dict:
    print(f"\nGoal {index}:")
    name = input("  Goal name: ").strip()
    while not name:
        name = input("  Goal name (cannot be empty): ").strip()

    tactics = []
    while True:
        tactic = collect_tactic(len(tactics) + 1)
        if tactic is None:
            if not tactics:
                print("  At least one tactic is required.")
                continue
            break
        tactics.append(tactic)

    return {"name": name, "tactics": tactics}


def collect_goals() -> list[dict]:
    print()
    num_goals = prompt_int("How many goals do you have? (1–13): ", 1, 13)
    return [collect_goal(i + 1) for i in range(num_goals)]


# ---------------------------------------------------------------------------
# Week logic
# ---------------------------------------------------------------------------

def active_tactics(goal: dict, week_num: int) -> list[str]:
    result = []
    for t in goal["tactics"]:
        if t["recurring"]:
            if t["begin_week"] <= week_num <= t["end_week"]:
                result.append(t["description"])
        else:
            if t["due_week"] == week_num:
                result.append(t["description"])
    return result


# ---------------------------------------------------------------------------
# Markdown output
# ---------------------------------------------------------------------------

def generate_markdown(start_date: date, goals: list[dict]) -> str:
    sections = []

    for week_num in range(1, 13):
        ws, we = week_date_range(start_date, week_num)
        lines = [
            f"{format_date(ws)} - {format_date(we)}",
            f"# Weekly Plan - Week {week_num}",
            "",
        ]

        for goal in goals:
            tactics = active_tactics(goal, week_num)
            if tactics:
                lines.append(f"**{goal['name']}**")
                lines.append("")
                lines.extend(tactics)
                lines.append("")

        sections.append("\n".join(lines))

    return "\n---\n\n".join(sections)


# ---------------------------------------------------------------------------
# PDF output
# ---------------------------------------------------------------------------

def generate_pdf(start_date: date, goals: list[dict], output_path: str) -> None:
    try:
        from fpdf import FPDF
    except ImportError:
        print("\nfpdf2 not found — installing...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "fpdf2"],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        from fpdf import FPDF
        print("Installed fpdf2.")

    from fpdf.enums import XPos, YPos

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    MARGIN = 15
    PAGE_WIDTH = 210 - 2 * MARGIN  # A4 usable width in mm
    PAGE_BOTTOM = 297 - MARGIN     # A4 height in mm, less the bottom margin

    weeks_on_page = 0

    for week_num in range(1, 13):
        active = [(g["name"], active_tactics(g, week_num)) for g in goals]
        active = [(name, tactics) for name, tactics in active if tactics]

        # Header (7 + 12 + 3) plus each goal's header, tactic lines, and gap.
        block_height = 22 + sum(9 + 7 * len(t) + 2 for _, t in active)

        if (pdf.page_no() == 0
                or weeks_on_page == WEEKS_PER_PAGE
                or pdf.get_y() + block_height > PAGE_BOTTOM):
            pdf.add_page()
            weeks_on_page = 0
        elif weeks_on_page:
            rule_y = pdf.get_y() + 3
            pdf.set_draw_color(180, 180, 180)
            pdf.line(MARGIN, rule_y, MARGIN + PAGE_WIDTH, rule_y)
            pdf.set_draw_color(0, 0, 0)
            pdf.set_y(rule_y + 5)

        weeks_on_page += 1
        ws, we = week_date_range(start_date, week_num)

        # Date range line
        pdf.set_font("Helvetica", size=11)
        pdf.set_x(MARGIN)
        pdf.cell(0, 7, f"{format_date(ws)} - {format_date(we)}",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        # Week title
        pdf.set_font("Helvetica", "B", size=22)
        pdf.set_x(MARGIN)
        pdf.cell(0, 12, f"Weekly Plan - Week {week_num}",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.ln(3)

        for name, tactics in active:
            # Goal header cell
            pdf.set_font("Helvetica", "B", size=12)
            pdf.set_fill_color(255, 255, 255)
            pdf.set_x(MARGIN)
            pdf.cell(PAGE_WIDTH, 9, name, border=1, fill=True,
                     new_x=XPos.LMARGIN, new_y=YPos.NEXT)

            # Tactics cell
            pdf.set_font("Helvetica", size=11)
            pdf.set_fill_color(242, 242, 242)
            tactic_text = "\n".join(tactics)
            pdf.set_x(MARGIN)
            pdf.multi_cell(PAGE_WIDTH, 7, tactic_text, border=1, fill=True)
            pdf.ln(2)

    pdf.output(output_path)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=== 12-Week Goal Planner ===")

    # Load or create
    action = prompt_choice(
        "\n[n]ew plan, [l]oad saved plan, or [i]mport a generated .md/.pdf? ",
        ["n", "l", "i"])

    if action == "i":
        result = import_plan()
        if result is None:
            print("Starting a new plan instead.")
            action = "n"
        else:
            start_date, goals = result

    if action == "l":
        result = load_plan()
        if result is None:
            print("Starting a new plan instead.")
            action = "n"
        else:
            start_date, goals = result
            # Allow changing the start date on load
            change = prompt_choice("Use the saved start date or enter a new one? [k]eep / [c]hange: ", ["k", "c"])
            if change == "c":
                start_date = prompt_date("Enter new Week 1 start date (YYYY-MM-DD): ")

    if action == "n":
        start_date = prompt_date("\nEnter Week 1 start date (YYYY-MM-DD): ")
        goals = collect_goals()
        save_plan(start_date, goals)

    fmt = prompt_choice("Output format — [m]arkdown or [p]df? ", ["m", "p"])
    filename_base = f"12_week_plan_{start_date}"

    if fmt == "m":
        output_path = f"{filename_base}.md"
        content = generate_markdown(start_date, goals)
        with open(output_path, "w") as f:
            f.write(content)
    else:
        output_path = f"{filename_base}.pdf"
        try:
            generate_pdf(start_date, goals, output_path)
        except Exception as e:
            print(f"\nPDF generation failed ({e}). Falling back to Markdown...")
            output_path = f"{filename_base}.md"
            content = generate_markdown(start_date, goals)
            with open(output_path, "w") as f:
                f.write(content)

    print(f"\nDone! Generated: {output_path}")


if __name__ == "__main__":
    main()
