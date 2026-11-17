"""Measure which card images the TCGdex asset server really has, per set and language.

The catalogue has one image address per card and language, built from a pattern; nothing in
the source data says whether the picture exists. This asks the server for one card of every
set in every language of that set (the first, a middle and the last card), plus any card
named with --card, and writes a table.

Usage: python3 etl/check_images.py web/data/scan-index.json --out docs/coverage/tcgdex-images.md
       [--card base2-54 --card M3-008] [--per-set 3]
Standard library only. One request per sampled image, a few at a time.
"""
from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

USER_AGENT = "card-catalogue-image-check/1.0"


def image_url(pattern: str, lang: str, series: str, set_source: str, number: str, quality: str = "low") -> str:
    quote = lambda value: urllib.parse.quote(str(value), safe="")
    return (
        pattern.replace("{lang}", lang).replace("{serie}", quote(series))
        .replace("{set}", quote(set_source)).replace("{number}", quote(number)) + f"/{quality}.webp"
    )


def exists(url: str) -> int:
    """HTTP status of the image, 0 when the server could not be reached."""
    for method in ("HEAD", "GET"):
        request = urllib.request.Request(url, method=method, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.status
        except urllib.error.HTTPError as error:
            if error.code == 405 and method == "HEAD":
                continue
            return error.code
        except (urllib.error.URLError, TimeoutError, OSError):
            return 0
    return 0


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("index", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--card", action="append", default=[], help="card key <set id>-<number> to check in every language")
    parser.add_argument("--per-set", type=int, default=3)
    args = parser.parse_args()

    index = json.loads(args.index.read_text(encoding="utf-8"))
    pattern = index["image_url_pattern"]
    by_set: dict[int, list[str]] = {}
    for card in index["cards"]:
        by_set.setdefault(card[0], []).append(card[1])

    jobs: list[tuple[str, str, str, str]] = []  # (set id, lang, number, url)
    wanted = set(args.card)
    for set_index, row in enumerate(index["sets"]):
        set_id, langs, series, source = row[0], row[5] or [], row[6], row[7]
        numbers = by_set.get(set_index, [])
        if not numbers or not series:
            continue
        picks = {numbers[0], numbers[len(numbers) // 2], numbers[-1]} if args.per_set >= 3 else {numbers[0]}
        picks |= {n for n in numbers if f"{set_id}-{n}" in wanted}
        for lang in langs:
            for number in sorted(picks):
                jobs.append((set_id, lang, number, image_url(pattern, lang, series, source, number)))

    with ThreadPoolExecutor(max_workers=6) as pool:
        statuses = list(pool.map(lambda job: exists(job[3]), jobs))

    per_lang: dict[str, list[int]] = {}
    per_set: dict[tuple[str, str], list[int]] = {}
    for (set_id, lang, _number, _url), status in zip(jobs, statuses):
        per_lang.setdefault(lang, []).append(status)
        per_set.setdefault((set_id, lang), []).append(status)

    names = {row[0]: row[3] for row in index["sets"]}
    lines = [
        "# TCGdex image coverage",
        "",
        f"Catalogue revision {index.get('tcgdex_revision')}; {len(jobs)} images asked, up to {args.per_set} cards per set and language.",
        "",
        "| Language | Sets | All sampled images present | Some | None | Unreachable |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for lang in sorted(per_lang):
        groups = [v for (s, l), v in per_set.items() if l == lang]
        full = sum(all(x == 200 for x in g) for g in groups)
        none = sum(all(x not in (200, 0) for x in g) for g in groups)
        down = sum(any(x == 0 for x in g) for g in groups)
        lines.append(f"| {lang} | {len(groups)} | {full} | {len(groups) - full - none - down} | {none} | {down} |")
    lines += ["", "## Sets without any sampled image", "", "| Set | Name | Languages without image |", "|---|---|---|"]
    missing: dict[str, list[str]] = {}
    for (set_id, lang), group in sorted(per_set.items()):
        if all(x not in (200, 0) for x in group):
            missing.setdefault(set_id, []).append(lang)
    for set_id, langs in missing.items():
        lines.append(f"| {set_id} | {names.get(set_id, '')} | {', '.join(langs)} |")
    if wanted:
        lines += ["", "## Cards asked by name", "", "| Card | Language | Status |", "|---|---|---:|"]
        for (set_id, lang, number, _url), status in zip(jobs, statuses):
            if f"{set_id}-{number}" in wanted:
                lines.append(f"| {set_id}-{number} | {lang} | {status} |")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
