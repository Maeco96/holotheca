"""Export a compact lookup index for the scanner from the catalogue database.

The scanner reads a name, an HP value and a collector number that are never perfect.
It ranks catalogue cards against those readings, so it needs every physical card with
its set, number, HP and names in every language, in one small file.

Usage: python3 etl/export_scan_index.py build/catalogue.sqlite --out web/data/scan-index.json

Layout (arrays, to stay small; `schema` is bumped when positions change):
  names:        [str]   unique card names across all languages
  illustrators: [str]   unique illustrator names
  rarities:     [str]   unique rarity labels
  sets:  [[id, code, official_count, display_name, release_date, [lang, ...], series_source_id, set_source_id]]
  cards: [[set_index, number, hp, [name_index, ...], illustrator_index, rarity_index, category,
           cardmarket_id, tcgplayer_id, cardtrader_id, variants]]
         category is "P", "T" or "E"; missing indexes are -1 and missing ids are 0;
         variants is "normal,holo" and ends with "?" when the ETL inferred it.
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
    for set_id, code, official, release, set_source, series_source in db.execute(
        "SELECT s.id, s.code, s.official_count, s.release_date, s.source_id, r.source_id "
        "FROM sets s JOIN series r ON r.id = s.series_id WHERE s.is_digital = 0 ORDER BY s.id"
    ):
        names = set_names.get(set_id, {})
        display = next((names[lang] for lang in DISPLAY_LANGS if lang in names), None)
        if display is None:
            display = next(iter(names.values()), set_id)
        set_index[set_id] = len(sets)
        sets.append([set_id, code, official, display, release, sorted(names), series_source, set_source])

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

    # One marketplace id per card and provider: the card-level one, else the first variant's.
    external: dict[int, dict[str, str]] = {}
    for card_id, provider, external_id in db.execute(
        "SELECT card_id, provider, external_id FROM external_ids ORDER BY card_id, variant_id IS NOT NULL, id"
    ):
        external.setdefault(card_id, {}).setdefault(provider, external_id)

    variants: dict[int, list[str]] = {}
    inferred: set[int] = set()
    for card_id, kind, guessed in db.execute("SELECT card_id, type, inferred FROM variants ORDER BY card_id, id"):
        bucket = variants.setdefault(card_id, [])
        if kind not in bucket:
            bucket.append(kind)
        if guessed:
            inferred.add(card_id)

    def intern(value, table: list[str], lookup: dict[str, int]) -> int:
        if not value:
            return -1
        index = lookup.get(value)
        if index is None:
            index = lookup[value] = len(table)
            table.append(value)
        return index

    def numeric(value) -> int:
        return int(value) if value and str(value).isdigit() else 0

    cards = []
    illustrators: list[str] = []
    illustrator_index: dict[str, int] = {}
    rarities: list[str] = []
    rarity_index: dict[str, int] = {}
    for card_id, set_id, number, hp, illustrator, rarity, category in db.execute(
        "SELECT id, set_id, number, hp, illustrator, rarity, category FROM cards ORDER BY set_id, number_sort, number"
    ):
        if set_id not in set_index:
            continue
        ids = external.get(card_id, {})
        kinds = ",".join(variants.get(card_id, [])) + ("?" if card_id in inferred else "")
        cards.append([
            set_index[set_id], number, hp or 0, card_names.get(card_id, []),
            intern(illustrator, illustrators, illustrator_index),
            intern(rarity if rarity != "None" else None, rarities, rarity_index),
            (category or "?")[0],
            numeric(ids.get("cardmarket")), numeric(ids.get("tcgplayer")), numeric(ids.get("cardtrader")),
            kinds,
        ])
    db.close()

    index = {
        "schema": 2,
        "image_url_pattern": meta.get("image_url_pattern"),
        "built_at": meta.get("built_at"),
        "tcgdex_revision": meta.get("tcgdex_revision"),
        "names": names,
        "illustrators": illustrators,
        "rarities": rarities,
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
