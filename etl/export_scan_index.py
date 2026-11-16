"""Export a compact lookup index for the scanner from the catalogue database.

The scanner reads a name, an HP value and a collector number that are never perfect.
It ranks catalogue cards against those readings, so it needs every physical card with
its set, number, HP and names in every language, in one small file.

Usage: python3 etl/export_scan_index.py build/catalogue.sqlite --out web/data/scan-index.json

Layout (arrays, to stay small):
  names: [str]                      unique card names across all languages
  sets:  [[id, code, official_count, display_name, release_date, [lang, ...]]]
  illustrators: [str]               unique illustrator names
  cards: [[set_index, number, hp, [name_index, ...], illustrator_index]]   (-1 when unknown)
Standard library only.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path

DISPLAY_LANGS = ("en", "it", "ja")


def export(database: Path, out: Path) -> dict:
    db = sqlite3.connect(database)
    meta = dict(db.execute("SELECT key, value FROM meta"))

    set_names: dict[str, dict[str, str]] = {}
    for set_id, lang, name in db.execute("SELECT set_id, lang, name FROM set_names"):
        set_names.setdefault(set_id, {})[lang] = name

    sets = []
    set_index: dict[str, int] = {}
    for set_id, code, official, release in db.execute(
        "SELECT id, code, official_count, release_date FROM sets WHERE is_digital = 0 ORDER BY id"
    ):
        names = set_names.get(set_id, {})
        display = next((names[lang] for lang in DISPLAY_LANGS if lang in names), None)
        if display is None:
            display = next(iter(names.values()), set_id)
        set_index[set_id] = len(sets)
        sets.append([set_id, code, official, display, release, sorted(names)])

    names: list[str] = []
    name_index: dict[str, int] = {}
    card_names: dict[int, list[int]] = {}
    # English first, then Italian, then the rest: the first name is the one shown by default.
    for card_id, name in db.execute(
        "SELECT card_id, name FROM card_names ORDER BY card_id, "
        "CASE lang WHEN 'en' THEN 0 WHEN 'it' THEN 1 ELSE 2 END, lang"
    ):
        index = name_index.get(name)
        if index is None:
            index = name_index[name] = len(names)
            names.append(name)
        bucket = card_names.setdefault(card_id, [])
        if index not in bucket:
            bucket.append(index)

    cards = []
    illustrators: list[str] = []
    illustrator_index: dict[str, int] = {}
    for card_id, set_id, number, hp, illustrator in db.execute(
        "SELECT id, set_id, number, hp, illustrator FROM cards ORDER BY set_id, number_sort, number"
    ):
        if set_id not in set_index:
            continue
        artist = -1
        if illustrator:
            artist = illustrator_index.get(illustrator, -1)
            if artist < 0:
                artist = illustrator_index[illustrator] = len(illustrators)
                illustrators.append(illustrator)
        cards.append([set_index[set_id], number, hp or 0, card_names.get(card_id, []), artist])
    db.close()

    index = {
        "schema": 1,
        "built_at": meta.get("built_at"),
        "tcgdex_revision": meta.get("tcgdex_revision"),
        "names": names,
        "illustrators": illustrators,
        "sets": sets,
        "cards": cards,
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return {"sets": len(sets), "cards": len(cards), "names": len(names), "bytes": out.stat().st_size}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("database", type=Path)
    parser.add_argument("--out", type=Path, default=Path("web/data/scan-index.json"))
    args = parser.parse_args()
    stats = export(args.database, args.out)
    print(f"wrote {args.out} ({stats['bytes'] / 1e6:.1f} MB): {stats['sets']} sets, {stats['cards']} cards, {stats['names']} names")


if __name__ == "__main__":
    main()
