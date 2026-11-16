#!/usr/bin/env python3
"""Measure how often the fields Scrinium needs are filled in tcgdex/cards-database.

Usage:
    python3 etl/tcgdex_fields.py /path/to/cards-database [--out docs/coverage/tcgdex-fields.md]

Reads the TypeScript source files of a local clone; no network access.
Pokémon TCG Pocket (digital-only) series are reported separately and
excluded from the physical-card figures.
"""
from __future__ import annotations

import argparse
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

from tcgdex_coverage import git_revision

DIGITAL_SERIES = {"Pokémon TCG Pocket"}

RARITY = re.compile(r"\brarity\s*:\s*[\"']")
ILLUSTRATOR = re.compile(r"\billustrator\s*:\s*[\"']")
VARIANTS_DETAILED = re.compile(r"\bvariants\s*:\s*\[")
VARIANTS_FLAGS = re.compile(r"\bvariants\s*:\s*\{")
CARDMARKET = re.compile(r"\bcardmarket\s*:\s*\d")
TCGPLAYER = re.compile(r"\btcgplayer\s*:\s*\d")
CARDTRADER = re.compile(r"\bcardtrader\s*:\s*\d")
ABBREVIATION = re.compile(r"\babbreviations\s*:\s*\{[^}]*?\bofficial\s*:\s*[\"']", re.S)
VARIANT_TYPE = re.compile(r"\btype\s*:\s*[\"'](normal|holo|reverse|metal|lenticular)[\"']")
STAMP = re.compile(r"\bstamp\s*:\s*\[")

CARD_CHECKS = [
    ("Rarity", RARITY),
    ("Illustrator", ILLUSTRATOR),
    ("Detailed variants (list)", VARIANTS_DETAILED),
    ("Legacy variant flags (object)", VARIANTS_FLAGS),
    ("Cardmarket product ID", CARDMARKET),
    ("TCGplayer product ID", TCGPLAYER),
    ("CardTrader ID", CARDTRADER),
    ("At least one stamped variant", STAMP),
]
SET_CHECKS = [
    ("Official abbreviation (set code)", ABBREVIATION),
    ("Cardmarket expansion ID", CARDMARKET),
    ("TCGplayer group ID", TCGPLAYER),
    ("CardTrader ID", CARDTRADER),
]


def scan(root: Path) -> dict:
    result = {
        "cards": 0, "sets": 0, "digital_cards": 0, "digital_sets": 0,
        "card_hits": Counter(), "set_hits": Counter(),
        "no_variant_info": 0, "variant_types": Counter(),
        "sets_without_cardmarket": [],
    }
    if not root.is_dir():
        return result
    for serie_dir in sorted(p for p in root.iterdir() if p.is_dir()):
        digital = serie_dir.name in DIGITAL_SERIES
        for set_file in sorted(serie_dir.glob("*.ts")):
            set_source = set_file.read_text(encoding="utf-8", errors="replace")
            card_dir = set_file.with_suffix("")
            card_files = sorted(card_dir.glob("*.ts")) if card_dir.is_dir() else []
            if digital:
                result["digital_sets"] += 1
                result["digital_cards"] += len(card_files)
                continue
            result["sets"] += 1
            for label, pattern in SET_CHECKS:
                if pattern.search(set_source):
                    result["set_hits"][label] += 1
            if not CARDMARKET.search(set_source):
                result["sets_without_cardmarket"].append(f"{serie_dir.name} / {set_file.stem}")
            for card_file in card_files:
                source = card_file.read_text(encoding="utf-8", errors="replace")
                result["cards"] += 1
                for label, pattern in CARD_CHECKS:
                    if pattern.search(source):
                        result["card_hits"][label] += 1
                detailed = VARIANTS_DETAILED.search(source)
                if not detailed and not VARIANTS_FLAGS.search(source):
                    result["no_variant_info"] += 1
                if detailed:
                    for variant_type in VARIANT_TYPE.findall(source[detailed.start():]):
                        result["variant_types"][variant_type] += 1
    return result


def pct(part: int, whole: int) -> str:
    return f"{part / whole:.0%}" if whole else "n/a"


def render(repo: Path, sections: list[tuple[str, dict]]) -> str:
    lines = [
        "# TCGdex field coverage",
        "",
        f"Generated on {date.today().isoformat()} by `etl/tcgdex_fields.py` "
        f"from `tcgdex/cards-database` at revision `{git_revision(repo)}`.",
        "",
        "Counts are per card file (one file per printed card, shared by all languages). "
        "Digital-only Pokémon TCG Pocket sets are excluded. "
        "Card images are not stored in the repository, so image coverage is not measured here.",
        "",
    ]
    for title, r in sections:
        lines += [
            f"## {title}",
            "",
            f"{r['sets']} sets, {r['cards']} cards. "
            f"Excluded as digital: {r['digital_sets']} sets, {r['digital_cards']} cards.",
            "",
            "| Card field | Cards | Share |",
            "| --- | ---: | ---: |",
        ]
        for label, _ in CARD_CHECKS:
            hits = r["card_hits"][label]
            lines.append(f"| {label} | {hits} | {pct(hits, r['cards'])} |")
        lines.append(f"| No variant information at card level | {r['no_variant_info']} | {pct(r['no_variant_info'], r['cards'])} |")
        lines += ["", "| Set field | Sets | Share |", "| --- | ---: | ---: |"]
        for label, _ in SET_CHECKS:
            hits = r["set_hits"][label]
            lines.append(f"| {label} | {hits} | {pct(hits, r['sets'])} |")
        if r["variant_types"]:
            types = ", ".join(f"{k} {v}" for k, v in r["variant_types"].most_common())
            lines += ["", f"Detailed variant entries by type: {types}."]
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
    report = render(args.repo, [
        ("International releases (`data/`)", scan(args.repo / "data")),
        ("Japanese and Asian releases (`data-asia/`)", scan(args.repo / "data-asia")),
    ])
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(report, encoding="utf-8")
        print(f"wrote {args.out}")
    else:
        print(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
