#!/usr/bin/env python3
"""Compares what the official sites list with the TCGdex catalogue, and maps official images.

Input: one or more files written by official.py (named <lang>.json) and the catalogue SQLite.
Output: a markdown report (sets and cards missing on either side, names that differ) and a
JSON map {"<set id>-<number>": {"<lang>": "<official image url>"}} for the app.

Usage:
  python3 etl/sources/compare.py catalogue.sqlite etl/sources/data/ja.json [...] --report R.md --images I.json
"""
import argparse
import json
import os
import re
import sqlite3
import unicodedata
from collections import defaultdict


# Common start of each site's image addresses, so the map the app downloads stays small.
PREFIX = {
    "ja": "https://www.pokemon-card.com/assets/images/card_images/large/",
    "ko": "https://pokemoncard.co.kr/public-assets/home/data/cards.image_www/data/wmimages/",
    "zh-tw": "https://asia.pokemon-card.com/tw/card-img/",
}


def norm_name(s):
    s = unicodedata.normalize("NFKC", s or "").lower()
    return re.sub(r"[\s・･·'’`\-]", "", s)


def num_key(n):
    m = re.match(r"^([A-Za-z]*)0*(\d+)([A-Za-z]?)$", str(n or "").strip())
    return f"{m.group(1).upper()}{int(m.group(2))}{m.group(3).lower()}" if m else str(n or "").strip().upper()


def load_catalogue(path, lang):
    db = sqlite3.connect(path)
    sets = {}
    # The official Asian sites use the Asian set codes; TCGdex keeps those sets under "asia:"
    # series, and an international set may share a code (then its id gets a suffix).
    for set_id, source_id, count, series in db.execute("SELECT id, source_id, official_count, series_id FROM sets"):
        key = source_id.lower()
        if key not in sets or series.startswith("asia:"):
            sets[key] = (set_id, count)
    cards = defaultdict(dict)
    rows = db.execute(
        "SELECT c.set_id, c.number, n.name FROM cards c LEFT JOIN card_names n ON n.card_id = c.id AND n.lang = ?",
        (lang,),
    )
    for set_id, number, name in rows:
        cards[set_id][num_key(number)] = (number, name)
    return sets, cards


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("catalogue")
    ap.add_argument("sources", nargs="+")
    ap.add_argument("--report", required=True)
    ap.add_argument("--images", required=True)
    args = ap.parse_args()

    images = defaultdict(dict)
    out = ["# Official sites vs TCGdex", ""]
    for src in args.sources:
        lang = os.path.basename(src).removesuffix(".json")
        if not os.path.exists(src):
            out += [f"## {lang}: no data yet", ""]
            continue
        with open(src, encoding="utf-8") as f:
            official = json.load(f)
        sets, cards = load_catalogue(args.catalogue, lang)

        by_set = defaultdict(list)
        for oid, rec in official.items():
            if rec.get("set") and rec.get("number"):
                by_set[rec["set"]].append((oid, rec))
        incomplete = sum(1 for r in official.values() if not (r.get("set") and r.get("number")))

        rows, missing_sets, name_diffs = [], [], []
        matched_total = 0
        for code in sorted(by_set, key=str.lower):
            recs = by_set[code]
            hit = sets.get(code.lower())
            if not hit:
                missing_sets.append(f"{code} ({len(recs)})")
                continue
            set_id, count = hit
            ours = cards.get(set_id, {})
            seen, missing = set(), []
            for oid, rec in recs:
                k = num_key(rec["number"])
                if k in ours:
                    seen.add(k)
                    if rec.get("image"):
                        images[f"{set_id}-{ours[k][0]}"].setdefault(lang, rec["image"])
                    ours_name = ours[k][1]
                    if ours_name and rec.get("name") and norm_name(ours_name) != norm_name(rec["name"]):
                        name_diffs.append(f"{set_id}-{ours[k][0]}: TCGdex «{ours_name}» / official «{rec['name']}»")
                else:
                    missing.append(rec["number"])
            matched_total += len(seen)
            only_ours = sorted(set(ours) - seen, key=lambda x: (len(x), x))
            rows.append(
                f"| {code} | {set_id} | {len(recs)} | {len(ours)} | {len(seen)} | "
                f"{', '.join(missing[:12])}{' …' if len(missing) > 12 else ''} | "
                f"{', '.join(only_ours[:12])}{' …' if len(only_ours) > 12 else ''} |"
            )

        out += [
            f"## {lang}",
            "",
            f"{len(official)} official cards collected ({incomplete} without set or number), "
            f"{matched_total} matched to a TCGdex card and given an official image.",
            "",
            "| official set | TCGdex set | official cards | TCGdex cards | matched | official only (numbers) | TCGdex only (numbers) |",
            "|---|---|---|---|---|---|---|",
            *rows,
            "",
        ]
        if missing_sets:
            out += [f"Official sets with no TCGdex set of the same code: {', '.join(missing_sets)}", ""]
        if name_diffs:
            out += [f"Names that differ ({len(name_diffs)}, first 60):", "", *[f"- {d}" for d in name_diffs[:60]], ""]

    with open(args.report, "w", encoding="utf-8") as f:
        f.write("\n".join(out))
    cards = {}
    for key, by_lang in sorted(images.items()):
        cards[key] = {lang: url[len(PREFIX[lang]):] if url.startswith(PREFIX.get(lang, "\0")) else url for lang, url in by_lang.items()}
    with open(args.images, "w", encoding="utf-8") as f:
        json.dump({"prefix": PREFIX, "cards": cards}, f, ensure_ascii=False, separators=(",", ":"))
    print("\n".join(out[:40]))


if __name__ == "__main__":
    main()
