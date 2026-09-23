#!/usr/bin/env python3
"""Rebuild a plan from generated output when the saved JSON is gone.

Markdown round-trips cleanly. PDF is best-effort: see parse_pdf.
"""

import json
import re
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

from planner import MAX_WEEK, MIN_WEEK

WEEK_HEADING = re.compile(r"^#?\s*Weekly Plan\s*-\s*Week\s+(\d+)\s*$")
DATE_RANGE = re.compile(r"^([A-Z][a-z]{2} \d{1,2}, \d{4})\s*-\s*[A-Z][a-z]{2} \d{1,2}, \d{4}\s*$")
BOLD_GOAL = re.compile(r"^\*\*(.+?)\*\*$")


class ImportError_(Exception):
    """Raised when a file cannot be read as a plan."""


# ---------------------------------------------------------------------------
# Assembly: weeks -> goals
# ---------------------------------------------------------------------------

def _assemble(entries: list[tuple[int, str, str]],
              week_starts: dict[int, date]) -> tuple[date, list[dict], list[str]]:
    """Turn (week, goal, description) rows back into the plan structure.

    Inverts planner.active_tactics: the set of weeks a description appears in
    becomes either a one-time tactic or a recurring span.
    """
    warnings: list[str] = []
    if not entries:
        raise ImportError_("No weekly plan sections found - is this a generated plan file?")
    if not week_starts:
        raise ImportError_("No week date ranges found, so the start date cannot be recovered.")

    # Back-compute week 1 from whichever week we saw first.
    week_num, ws = sorted(week_starts.items())[0]
    start_date = ws - timedelta(weeks=week_num - 1)

    # Disagreement between headings means a hand-edited file.
    for num, seen in sorted(week_starts.items()):
        expected = start_date + timedelta(weeks=num - 1)
        if seen != expected:
            warnings.append(
                f"Week {num} is dated {seen:%b %d, %Y} but week 1 implies "
                f"{expected:%b %d, %Y}; using week {week_num}'s date.")
            break

    goal_order: list[str] = []
    weeks_by_tactic: dict[tuple[str, str], list[int]] = {}
    tactic_order: dict[str, list[str]] = {}

    for week, goal, desc in entries:
        if goal not in goal_order:
            goal_order.append(goal)
            tactic_order[goal] = []
        if desc not in tactic_order[goal]:
            tactic_order[goal].append(desc)
        weeks_by_tactic.setdefault((goal, desc), []).append(week)

    goals = []
    for goal in goal_order:
        tactics = []
        for desc in tactic_order[goal]:
            weeks = sorted(set(weeks_by_tactic[(goal, desc)]))
            if len(weeks) == 1:
                # Ambiguous: could also have been a 1-week recurring tactic.
                tactics.append({"description": desc, "recurring": False,
                                "due_week": weeks[0]})
            else:
                begin, end = weeks[0], weeks[-1]
                if weeks != list(range(begin, end + 1)):
                    missing = [w for w in range(begin, end + 1) if w not in weeks]
                    warnings.append(
                        f"'{desc}' ({goal}) skips week(s) {', '.join(map(str, missing))}; "
                        f"imported as a continuous run from {begin} to {end}.")
                tactics.append({"description": desc, "recurring": True,
                                "begin_week": begin, "end_week": end})
        goals.append({"name": goal, "tactics": tactics})

    return start_date, goals, warnings


def _clamp_week(raw: int, warnings: list[str]) -> int:
    week = min(max(raw, MIN_WEEK), MAX_WEEK)
    if week != raw:
        warnings.append(f"Week {raw} is outside {MIN_WEEK}-{MAX_WEEK}; treated as week {week}.")
    return week


# ---------------------------------------------------------------------------
# Markdown
# ---------------------------------------------------------------------------

def parse_markdown(text: str) -> tuple[date, list[dict], list[str]]:
    """Parse the output of planner.generate_markdown back into a plan."""
    entries: list[tuple[int, str, str]] = []
    week_starts: dict[int, date] = {}
    warnings: list[str] = []

    week: int | None = None
    goal: str | None = None
    pending_date: date | None = None

    for line in text.splitlines():
        line = line.strip()
        if not line or line == "---":
            continue

        m = DATE_RANGE.match(line)
        if m:
            try:
                pending_date = datetime.strptime(m.group(1), "%b %d, %Y").date()
            except ValueError:
                pending_date = None
            continue

        m = WEEK_HEADING.match(line)
        if m:
            week = _clamp_week(int(m.group(1)), warnings)
            goal = None
            if pending_date is not None:
                week_starts.setdefault(week, pending_date)
                pending_date = None
            continue

        m = BOLD_GOAL.match(line)
        if m:
            goal = m.group(1).strip()
            continue

        if week is not None and goal is not None:
            entries.append((week, goal, line))

    return _assemble(entries, week_starts)


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------

def _require_pypdf():
    try:
        import pypdf
    except ImportError:
        print("pypdf not found - installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf"],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        import pypdf
        print("Installed pypdf.")
    return pypdf


def parse_pdf(path: str | Path) -> tuple[date, list[dict], list[str]]:
    """Parse a generated PDF back into a plan. Best-effort.

    Goal headers are told apart from tactics by their bold font, so this only
    works on PDFs this tool generated. Descriptions longer than roughly 100
    characters wrap in the PDF, and each wrapped line comes back as its own
    tactic - there is no way to tell a wrap from a line break after the fact.
    """
    pypdf = _require_pypdf()

    entries: list[tuple[int, str, str]] = []
    week_starts: dict[int, date] = {}
    warnings: list[str] = []
    saw_bold = False

    reader = pypdf.PdfReader(str(path))
    for page in reader.pages:
        # (text, is_bold) per visual line, in layout order.
        lines: list[tuple[str, bool]] = []

        def visitor(text, cm, tm, font_dict, font_size, _lines=lines):
            nonlocal saw_bold
            stripped = text.strip()
            if not stripped:
                return
            base = ""
            if font_dict:
                base = str(font_dict.get("/BaseFont", ""))
            bold = "Bold" in base
            saw_bold = saw_bold or bold
            _lines.append((stripped, bold))

        page.extract_text(visitor_text=visitor)

        week: int | None = None
        goal: str | None = None
        pending_date: date | None = None

        for text, bold in lines:
            m = DATE_RANGE.match(text)
            if m:
                try:
                    pending_date = datetime.strptime(m.group(1), "%b %d, %Y").date()
                except ValueError:
                    pending_date = None
                continue

            m = WEEK_HEADING.match(text)
            if m:
                week = _clamp_week(int(m.group(1)), warnings)
                goal = None
                if pending_date is not None:
                    week_starts.setdefault(week, pending_date)
                    pending_date = None
                continue

            if week is None:
                continue
            if bold:
                goal = text
            elif goal is not None:
                entries.append((week, goal, text))

    if not saw_bold:
        raise ImportError_(
            "No bold text found, so goals cannot be told apart from tactics. "
            "This PDF was probably not produced by this tool - import the Markdown instead.")

    start_date, goals, assembly_warnings = _assemble(entries, week_starts)
    warnings.extend(assembly_warnings)
    warnings.append("Imported from PDF: tactics longer than about 100 characters "
                    "may have been split across lines. Check them before generating.")
    return start_date, goals, warnings


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

def load_any(path: str | Path) -> tuple[date, list[dict], list[str]]:
    """Load a plan from .json, .md, or .pdf based on the file extension."""
    path = Path(path)
    suffix = path.suffix.lower()

    if suffix == ".json":
        with open(path) as f:
            data = json.load(f)
        return date.fromisoformat(data["start_date"]), data["goals"], []
    if suffix in (".md", ".markdown", ".txt"):
        return parse_markdown(path.read_text())
    if suffix == ".pdf":
        return parse_pdf(path)
    raise ImportError_(f"Don't know how to read '{path.suffix}' files. Use .json, .md, or .pdf.")
