#!/usr/bin/env python3
"""Plan or install Ontotect into common Agent Skills roots.

The default is a dry run. Pass --apply to copy files. Existing destinations are
left untouched unless --force is also supplied.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from pathlib import Path


SKILL_NAME = "ontotect"
AGENTS = ("cursor", "codex", "kilo", "opencode", "claude")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--agents",
        nargs="+",
        choices=(*AGENTS, "all"),
        default=["all"],
        help="Hosts to target (default: all).",
    )
    parser.add_argument(
        "--scope",
        choices=("project", "user"),
        default="project",
        help="Install into a project or user skill root (default: project).",
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=Path.cwd(),
        help="Project root for project scope (default: current directory).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform the copy. Without this flag, print a dry-run plan.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Merge into an existing destination and overwrite same-named files.",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON output.")
    return parser.parse_args()


def validate_source(source: Path) -> None:
    skill_file = source / "SKILL.md"
    if not skill_file.is_file():
        raise ValueError(f"Missing required file: {skill_file}")
    text = skill_file.read_text(encoding="utf-8")
    match = re.match(r"\A---\s*\n(.*?)\n---\s*\n", text, flags=re.DOTALL)
    if not match:
        raise ValueError("SKILL.md must start with YAML frontmatter")
    name_match = re.search(r"(?m)^name:\s*['\"]?([^'\"\n]+)", match.group(1))
    description_match = re.search(r"(?m)^description:\s*\S", match.group(1))
    if not name_match or name_match.group(1).strip() != SKILL_NAME:
        raise ValueError(f"SKILL.md name must be {SKILL_NAME!r}")
    if not description_match:
        raise ValueError("SKILL.md description must be non-empty")
    if source.name != SKILL_NAME:
        raise ValueError(f"Skill directory must be named {SKILL_NAME!r}")


def selected_agents(values: list[str]) -> list[str]:
    if "all" in values:
        return list(AGENTS)
    return list(dict.fromkeys(values))


def user_roots() -> dict[str, Path]:
    home = Path.home()
    return {
        "cursor": home / ".cursor" / "skills",
        # Codex's public local-skill discovery root. The managed/bundled
        # $CODEX_HOME/skills location is intentionally not assumed here.
        "codex": home / ".agents" / "skills",
        "kilo": home / ".kilo" / "skills",
        "opencode": home / ".config" / "opencode" / "skills",
        "claude": home / ".claude" / "skills",
    }


def project_roots(project_root: Path) -> dict[str, Path]:
    root = project_root.expanduser().resolve()
    return {
        "cursor": root / ".cursor" / "skills",
        # .agents is the portable project root used by multiple compatible hosts.
        "codex": root / ".agents" / "skills",
        "kilo": root / ".kilo" / "skills",
        "opencode": root / ".opencode" / "skills",
        "claude": root / ".claude" / "skills",
    }


def build_plan(source: Path, args: argparse.Namespace) -> list[dict[str, str | bool]]:
    roots = user_roots() if args.scope == "user" else project_roots(args.project_root)
    plan: list[dict[str, str | bool]] = []
    seen: set[Path] = set()
    for agent in selected_agents(args.agents):
        destination = (roots[agent] / SKILL_NAME).resolve()
        if destination in seen:
            continue
        seen.add(destination)
        plan.append(
            {
                "agent": agent,
                "source": str(source),
                "destination": str(destination),
                "exists": destination.exists(),
                "action": "merge" if destination.exists() and args.force else "copy",
            }
        )
    return plan


def copy_skill(source: Path, destination: Path, force: bool) -> None:
    if destination == source:
        return
    if destination.exists() and not force:
        raise FileExistsError(
            f"Destination exists: {destination}. Use --force to merge explicitly."
        )
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        source,
        destination,
        dirs_exist_ok=force,
        ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"),
    )


def main() -> int:
    args = parse_args()
    if args.force and not args.apply:
        print("error: --force has no effect without --apply", file=sys.stderr)
        return 2

    source = Path(__file__).resolve().parent.parent
    try:
        validate_source(source)
        plan = build_plan(source, args)
    except (OSError, ValueError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    failures: list[str] = []
    if args.apply:
        for item in plan:
            try:
                copy_skill(source, Path(str(item["destination"])), args.force)
                item["status"] = "installed"
            except (OSError, shutil.Error) as exc:
                item["status"] = "failed"
                item["error"] = str(exc)
                failures.append(str(exc))
    else:
        for item in plan:
            item["status"] = "planned"

    if args.json:
        print(json.dumps({"dry_run": not args.apply, "targets": plan}, indent=2))
    else:
        mode = "DRY RUN" if not args.apply else "INSTALL"
        print(f"{mode}: {SKILL_NAME}")
        for item in plan:
            suffix = " (exists)" if item["exists"] else ""
            print(f"- {item['agent']}: {item['destination']}{suffix} -> {item['status']}")
            if "error" in item:
                print(f"  error: {item['error']}")
        if not args.apply:
            print("Re-run with --apply after reviewing these targets.")

    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
