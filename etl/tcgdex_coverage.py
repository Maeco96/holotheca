#!/usr/bin/env python3
"""Measure per-language coverage of a local clone of tcgdex/cards-database.

Usage:
    python3 etl/tcgdex_coverage.py /path/to/cards-database [--out docs/coverage/tcgdex-coverage.md]

The TCGdex database stores one TypeScript file per series, set and card:
    data/<Serie>.ts                  international series
    data/<Serie>/<Set>.ts            set
    data/<Serie>/<Set>/<localId>.ts  card
    data-asia/...                    same layout for Japanese / Asian releases

A card "exists" in a language when its `name` object has a key for that
language. No network access is needed: everything is read from the clone.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

# Order used in the report. Mirrors SupportedLanguages in interfaces.d.ts.
LANGUAGES = [
    "en", "fr", "de", "it", "es", "es-mx", "pt", "pt-br", "pt-pt",
    "nl", "pl", "ru",
    "ja", "ko", "zh-tw", "zh-cn", "th", "id",
]

LANGUAGE_NAMES = {
    "en": "English", "fr": "French", "de": "German", "it": "Italian",
    "es": "Spanish", "es-mx": "Spanish (Latin America)", "pt": "Portuguese",
    "pt-br": "Portuguese (Brazil)", "pt-pt": "Portuguese (Portugal)",
    "nl": "Dutch", "pl": "Polish", "ru": "Russian", "ja": "Japanese",
    "ko": "Korean", "zh-tw": "Chinese (Traditional)",
    "zh-cn": "Chinese (Simplified)", "th": "Thai", "id": "Indonesian",
}

NAME_BLOCK = re.compile(r"\bname\s*:\s*\{(.*?)\}", re.S)
LANG_KEY = re.compile(r"""(?:^|[,{\s])['"]?([a-z]{2}(?:-[a-z]{2})?)['"]?\s*:""")
OFFICIAL_COUNT = re.compile(r"cardCount\s*:\s*\{[^}]*?official\s*:\s*(\d+)", re.S)
STRING_VALUE = re.compile(
    r""":\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)"""
)


def name_languages(source: str) -> set[str]:
    """Return the language keys of the first `name: {...}` object in a file."""
    match = NAME_BLOCK.search(source)
    if not match:
        return set()
    body = match.group(1)
    # Blank out string values (but keep quoted keys such as 'zh-cn') so that
    # text like "x: y" inside a name is not parsed as a language key.
    body = STRING_VALUE.sub(": 0", body)
    return {key for key in LANG_KEY.findall(body)}


def scan(root: Path) -> dict:
    """Walk one data folder and collect per-language counters."""
    stats = {
        "sets": defaultdict(int),            # sets named in the language
        "cards": defaultdict(int),           # cards named in the language
        "official": defaultdict(int),        # sum of official card counts of those sets
        "empty_sets": defaultdict(int),      # sets named in the language with 0 cards in it
        "total_sets": 0,
        "total_cards": 0,
        "unknown_languages": defaultdict(int),
    }
    if not root.is_dir():
        return stats

    for serie_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        for set_file in sorted(serie_dir.glob("*.ts")):
            set_source = set_file.read_text(encoding="utf-8", errors="replace")
            set_langs = name_languages(set_source)
            official = OFFICIAL_COUNT.search(set_source)
            official_count = int(official.group(1)) if official else 0
            stats["total_sets"] += 1

            per_lang_cards = defaultdict(int)
            card_dir = set_file.with_suffix("")
            if card_dir.is_dir():
                for card_file in card_dir.glob("*.ts"):
                    card_source = card_file.read_text(encoding="utf-8", errors="replace")
                    stats["total_cards"] += 1
                    for lang in name_languages(card_source):
                        per_lang_cards[lang] += 1

            for lang in set_langs | set(per_lang_cards):
                if lang not in LANGUAGE_NAMES:
                    stats["unknown_languages"][lang] += 1
                    continue
                stats["sets"][lang] += 1
                stats["cards"][lang] += per_lang_cards.get(lang, 0)
                stats["official"][lang] += official_count
                if per_lang_cards.get(lang, 0) == 0:
                    stats["empty_sets"][lang] += 1
    return stats


def git_revision(repo: Path) -> str:
    try:
        out = subprocess.run(
            ["git", "-C", str(repo), "log", "-1", "--format=%h %cs"],
            capture_output=True, text=True, check=True,
        )
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def render(repo: Path, inter: dict, asia: dict) -> str:
    lines = [
        "# TCGdex coverage per language",
        "",
        f"Generated on {date.today().isoformat()} by `etl/tcgdex_coverage.py` "
        f"from `tcgdex/cards-database` at revision `{git_revision(repo)}`.",
        "",
        "A card counts for a language when its `name` has a value in that language. "
        "\"Official\" is the sum of `cardCount.official` over the sets named in that language; "
        "it excludes secret rares, so the ratio can exceed 100%. "
        "\"Empty sets\" are sets named in the language that hold no card in it.",
        "",
    ]
    for title, folder, stats in (
        ("International releases (`data/`)", "data", inter),
        ("Japanese and Asian releases (`data-asia/`)", "data-asia", asia),
    ):
        lines += [
            f"## {title}",
            "",
            f"{stats['total_sets']} set files, {stats['total_cards']} card files.",
            "",
            "| Language | Code | Sets | Empty sets | Cards | Official | Cards / official |",
            "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
        ]
        for lang in LANGUAGES:
            sets = stats["sets"].get(lang, 0)
            cards = stats["cards"].get(lang, 0)
            if sets == 0 and cards == 0:
                continue
            official = stats["official"].get(lang, 0)
            ratio = f"{cards / official:.0%}" if official else "n/a"
            lines.append(
                f"| {LANGUAGE_NAMES[lang]} | `{lang}` | {sets} | "
                f"{stats['empty_sets'].get(lang, 0)} | {cards} | {official} | {ratio} |"
            )
        if stats["unknown_languages"]:
            unknown = ", ".join(f"`{k}` ({v})" for k, v in sorted(stats["unknown_languages"].items()))
            lines += ["", f"Keys not recognised as languages: {unknown}."]
        lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("repo", type=Path, help="path to a clone of tcgdex/cards-database")
    parser.add_argument("--out", type=Path, help="write the Markdown report to this file")
    args = parser.parse_args()

    if not (args.repo / "data").is_dir():
        print(f"error: {args.repo} does not look like a cards-database clone", file=sys.stderr)
        return 1

    report = render(args.repo, scan(args.repo / "data"), scan(args.repo / "data-asia"))
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
