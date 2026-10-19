#!/usr/bin/env python3
"""Plan an edge-function deploy from supabase/config.toml.

Prints the functions that would deploy and each verify_jwt flag.
Does not call Supabase, does not open a database, and does not print secret values.

  FUNCTIONS=all PROJECT_REF=aykopqinnnssxdhxqruo python3 scripts/function-deploy-plan.py
  python3 scripts/function-deploy-plan.py --names
  python3 scripts/function-deploy-plan.py --write-env /tmp/fn.env

FUNCTIONS is "all" or a comma-separated list. PROJECT_REF defaults to the
ether-prod ref. A missing verify_jwt entry, a config name without a directory,
or a directory without a config entry exits non-zero.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

DEFAULT_PROJECT_REF = "aykopqinnnssxdhxqruo"
ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "supabase" / "config.toml"
FUNCTIONS_DIR = ROOT / "supabase" / "functions"

# Deno.env.get names under supabase/functions, except the three values Supabase
# injects itself (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).
# The workflow passes each of these from GitHub Actions secrets and skips empties.
SECRET_NAMES = (
    "APPLE_PASS_TYPE_ID",
    "APPLE_TEAM_ID",
    "APP_URL",
    "EMAIL_FROM",
    "GOOGLE_WALLET_ISSUER_ID",
    "GOOGLE_WALLET_SERVICE_ACCOUNT_KEY",
    "INTERNAL_FUNCTION_SECRET",
    "LOVABLE_API_KEY",
    "MUX_TOKEN_ID",
    "MUX_TOKEN_SECRET",
    "RESEND_API_KEY",
    "SITE_URL",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_PHONE_NUMBER",
    "VAPID_PRIVATE_KEY",
    "VAPID_PUBLIC_KEY",
    "VAPID_SUBJECT",
)

SLUG_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*$")
PROJECT_REF_RE = re.compile(r"^[a-z]{20}$")
SECTION_RE = re.compile(r"^\[functions\.([A-Za-z][A-Za-z0-9_-]*)\]$")
VERIFY_RE = re.compile(r"^verify_jwt\s*=\s*(true|false)$")
PROJECT_RE = re.compile(r'^project_id\s*=\s*"([^"]+)"$')


def parse_config(text: str) -> tuple[str | None, dict[str, bool | None]]:
    project_id = None
    section: str | None = None
    found: dict[str, bool | None] = {}
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        header = SECTION_RE.fullmatch(line)
        if header:
            section = header.group(1)
            found.setdefault(section, None)
            continue
        if line.startswith("[") and line.endswith("]"):
            section = None
            continue
        project = PROJECT_RE.fullmatch(line)
        if project and section is None:
            project_id = project.group(1)
            continue
        verify = VERIFY_RE.fullmatch(line)
        if verify and section is not None:
            found[section] = verify.group(1) == "true"
    return project_id, found


def function_directories() -> list[str]:
    names = []
    for path in sorted(FUNCTIONS_DIR.iterdir()):
        if not path.is_dir() or path.name.startswith("_"):
            continue
        if (path / "index.ts").is_file():
            names.append(path.name)
    return names


def selected_names(functions: str, directories: list[str]) -> list[str]:
    raw = functions.strip()
    if not raw:
        raise SystemExit("functions input is empty. Use all, or a comma-separated list.")
    if raw == "all":
        return list(directories)
    names = []
    seen = set()
    for part in raw.split(","):
        name = part.strip()
        if not name:
            raise SystemExit("functions list has an empty name. Example: stripe-music-webhook,mux-stream")
        if not SLUG_RE.fullmatch(name):
            raise SystemExit(f"invalid function name: {name}")
        if name in seen:
            raise SystemExit(f"duplicate function name: {name}")
        if name not in directories:
            raise SystemExit(f"no function directory for {name}")
        seen.add(name)
        names.append(name)
    return names


def mismatches(config: dict[str, bool | None], directories: list[str]) -> list[str]:
    directory_set = set(directories)
    problems = []
    for name in sorted(set(config) - directory_set):
        problems.append(f"config.toml lists {name} but supabase/functions/{name}/index.ts is missing")
    for name in sorted(directory_set - set(config)):
        problems.append(f"supabase/functions/{name} has no [functions.{name}] entry in config.toml")
    for name, flag in sorted(config.items()):
        if flag is None:
            problems.append(f"[functions.{name}] has no verify_jwt value")
    return problems


def dotenv_line(name: str, value: str) -> str:
    """Quote a value for the dotenv parser pinned by Supabase CLI 2.121.0.

    That parser keeps single-quoted text as written, including quotes, hashes,
    backslashes, and newlines. It does not unescape \\' . A single quote or a
    carriage return cannot round-trip, so those values fail before any file is
    written. The error names the variable and does not include the value.
    """
    if "'" in value or "\r" in value:
        raise SystemExit(
            f"{name} contains a single quote or a carriage return. "
            "Store it as one line without apostrophes, or set that one secret "
            "in the Supabase dashboard under Edge Functions, Secrets."
        )
    return f"{name}='{value}'\n"


def write_env(path: Path) -> int:
    for name in SECRET_NAMES:
        if name.startswith("SUPABASE_"):
            raise SystemExit(f"refusing to write {name}")
    included = []
    skipped = []
    body = []
    for name in SECRET_NAMES:
        value = os.environ.get(name)
        if not value:
            skipped.append(name)
            continue
        body.append(dotenv_line(name, value))
        included.append(name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(body), encoding="utf-8")
    os.chmod(path, 0o600)
    print("set: " + (", ".join(included) if included else "(none)"))
    print("skip: " + ", ".join(skipped))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Plan Ether edge function deploys")
    parser.add_argument("--names", action="store_true", help="print selected function names only")
    parser.add_argument("--write-env", metavar="FILE", help="write set secrets as a dotenv file")
    args = parser.parse_args()

    if args.write_env:
        return write_env(Path(args.write_env))

    project_ref = os.environ.get("PROJECT_REF", "").strip() or DEFAULT_PROJECT_REF
    if not PROJECT_REF_RE.fullmatch(project_ref):
        raise SystemExit(f"PROJECT_REF is not a 20-letter project ref: {project_ref}")

    project_id, config = parse_config(CONFIG_PATH.read_text(encoding="utf-8"))
    directories = function_directories()
    problems = mismatches(config, directories)
    if project_id != project_ref:
        problems.insert(
            0,
            f"config.toml project_id is {project_id or '(missing)'}; deploy ref is {project_ref}",
        )

    functions = os.environ.get("FUNCTIONS", "all")
    chosen = selected_names(functions, directories)
    for name in chosen:
        if name not in config or config[name] is None:
            problems.append(f"{name} is selected but has no verify_jwt in config.toml")

    if problems:
        print("function deploy plan failed:", file=sys.stderr)
        for problem in problems:
            print(f"- {problem}", file=sys.stderr)
        return 1

    if args.names:
        for name in chosen:
            print(name)
        return 0

    print(f"project_ref={project_ref}")
    print(f"config_project_id={project_id}")
    print(f"directories={len(directories)} selected={len(chosen)}")
    print("mismatches: none")
    print("name\tverify_jwt")
    for name in chosen:
        flag = "true" if config[name] else "false"
        print(f"{name}\t{flag}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
