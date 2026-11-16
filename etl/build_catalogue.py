#!/usr/bin/env python3
"""Build the Scrinium catalogue (SQLite) from a local clone of tcgdex/cards-database.

Usage:
    python3 etl/build_catalogue.py /path/to/cards-database --out build/catalogue.sqlite

Reads the TypeScript data files directly (no network, no API). The output follows
db/catalogue.sql. Manual corrections to marketplace IDs live in
etl/overrides/external_ids.csv and are re-applied on every build, so they survive
catalogue updates. Standard library only.
"""
from __future__ import annotations

import argparse
import csv
import sqlite3
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from tcgdex_coverage import LANGUAGE_NAMES, git_revision
from tsliteral import Ident, parse_declaration

ROOT = Path(__file__).resolve().parent.parent
SCHEMA = ROOT / "db" / "catalogue.sql"
OVERRIDES = Path(__file__).resolve().parent / "overrides" / "external_ids.csv"

FAMILIES = {
    "international": ("data", "International releases (English, French, German, Italian, Spanish, Portuguese)"),
    "asia": ("data-asia", "Japanese and Asian releases"),
}
DIGITAL_SERIES = {"tcgp"}  # Pokémon TCG Pocket: digital only
PROVIDERS = ("cardmarket", "tcgplayer", "cardtrader")

# Legacy `variants: { ... }` flags used by about 300 older cards.
LEGACY_FLAG_VARIANTS = {
    "normal": {"type": "normal"},
    "reverse": {"type": "reverse"},
    "holo": {"type": "holo"},
    "firstEdition": {"type": "normal", "stamp": ["1st-edition"]},
    "jumbo": {"type": "normal", "size": "jumbo"},
    "preRelease": {"type": "normal", "stamp": ["pre-release"]},
    "wPromo": {"type": "normal", "stamp": ["w-promo"]},
}


def read(path: Path):
    return parse_declaration(path.read_text(encoding="utf-8", errors="replace"))


def number_sort(local_id: str) -> int | None:
    digits = ""
    for char in local_id:
        if char.isdigit():
            digits += char
        elif digits:
            break
    return int(digits) if digits else None


def join(values) -> str | None:
    if not values:
        return None
    return ",".join(str(v) for v in values)


def earliest_date(value) -> str | None:
    if isinstance(value, str):
        return value
    if isinstance(value, dict) and value:
        return min(v for v in value.values() if isinstance(v, str))
    return None


class Builder:
    def __init__(self, db: sqlite3.Connection):
        self.db = db
        self.stats = {"series": 0, "sets": 0, "cards": 0, "names": 0, "variants": 0, "external_ids": 0, "variants_inferred": 0}
        self.warnings: list[str] = []
        self.languages_seen: set[str] = set()
        self.set_data: dict[Path, dict] = {}   # parsed set files
        self.set_id_for: dict[Path, str] = {}  # final, unique id of each set file

    # ----- helpers -----

    def warn(self, message: str) -> None:
        self.warnings.append(message)

    def ensure_language(self, code: str) -> bool:
        if code not in LANGUAGE_NAMES:
            return False
        self.languages_seen.add(code)
        return True

    def add_external(self, card_id: int, variant_id: int | None, third_party) -> None:
        if not isinstance(third_party, dict):
            return
        for provider in PROVIDERS:
            value = third_party.get(provider)
            if value is None:
                continue
            self.db.execute(
                "INSERT INTO external_ids (card_id, variant_id, provider, external_id, manual) VALUES (?, ?, ?, ?, 0)",
                (card_id, variant_id, provider, str(value)),
            )
            self.stats["external_ids"] += 1

    # ----- series, sets, cards -----

    def plan_set_ids(self, tcgdex: Path) -> None:
        """Give every set file a unique id.

        TCGdex ids are unique per language list, not globally: the Japanese Neo sets reuse
        `neo1`..`neo4`, and a few Asian files declare the id of a sibling file (copy-paste
        slips in the source). Rules, in order:
          1. A set keeps its declared id when it is the only one with that id.
          2. Among files declaring the same id, the file whose name equals the id keeps it;
             the others become `<id>~<file name>`.
          3. An id already used by an earlier family becomes `<id>~<family>`.
        Every case that is not rule 1 is reported as a warning.
        """
        taken: set[str] = set()
        for family, (folder, _title) in FAMILIES.items():
            root = tcgdex / folder
            declared: dict[str, list[Path]] = defaultdict(list)
            for serie_file in sorted(root.glob("*.ts")):
                serie_dir = serie_file.with_suffix("")
                if not serie_dir.is_dir():
                    continue
                for set_file in sorted(serie_dir.glob("*.ts")):
                    data = read(set_file)
                    self.set_data[set_file] = data
                    if isinstance(data.get("id"), str):
                        declared[data["id"]].append(set_file)
                    else:
                        self.warn(f"{set_file.relative_to(tcgdex)}: set without id, skipped")
            family_ids: set[str] = set()
            for set_id, files in declared.items():
                owner = next((f for f in files if f.stem == set_id), files[0])
                for set_file in files:
                    final = set_id if set_file is owner else f"{set_id}~{set_file.stem}"
                    if final in taken:
                        final = f"{final}~{family}"
                    if final != set_id:
                        self.warn(f"{set_file.relative_to(tcgdex)}: declared id {set_id!r} stored as {final!r}")
                    self.set_id_for[set_file] = final
                    family_ids.add(final)
            taken |= family_ids

    def build_family(self, family: str, tcgdex: Path) -> None:
        folder, title = FAMILIES[family]
        root = tcgdex / folder
        if not root.is_dir():
            self.warn(f"{folder}/ not found, skipped")
            return
        self.db.execute("INSERT INTO set_families (id, game_id, name) VALUES (?, 'pokemon', ?)", (family, title))

        for serie_file in sorted(root.glob("*.ts")):
            serie_dir = serie_file.with_suffix("")
            if not serie_dir.is_dir():
                continue
            serie = read(serie_file)
            source_id = serie.get("id")
            if not isinstance(source_id, str) or source_id in ("", "null"):
                # TCGdex has two placeholder series (DP, DPt in data-asia) with id 'null' and no name.
                self.warn(f"{serie_file.relative_to(tcgdex)}: series id {source_id!r}, using {serie_file.stem!r}")
                source_id = serie_file.stem
            series_id = f"{family}:{serie_file.stem}"
            self.db.execute(
                "INSERT INTO series (id, family_id, source_id) VALUES (?, ?, ?)", (series_id, family, source_id)
            )
            self.stats["series"] += 1
            for lang, name in (serie.get("name") or {}).items():
                if self.ensure_language(lang):
                    self.db.execute(
                        "INSERT INTO series_names (series_id, lang, name) VALUES (?, ?, ?)", (series_id, lang, name)
                    )
            for set_file in sorted(serie_dir.glob("*.ts")):
                self.build_set(family, series_id, source_id in DIGITAL_SERIES, set_file)

    def build_set(self, family: str, series_id: str, digital: bool, set_file: Path) -> None:
        set_id = self.set_id_for.get(set_file)
        if set_id is None:
            return
        data = self.set_data[set_file]

        abbreviations = data.get("abbreviations") or {}
        official_count = (data.get("cardCount") or {}).get("official")
        release = data.get("releaseDate")
        self.db.execute(
            "INSERT INTO sets (id, source_id, series_id, code, official_count, release_date, is_digital) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                set_id, data["id"], series_id, abbreviations.get("official"), official_count,
                earliest_date(release), int(digital),
            ),
        )
        self.stats["sets"] += 1

        for lang, name in (data.get("name") or {}).items():
            if not self.ensure_language(lang):
                continue
            lang_release = release.get(lang) if isinstance(release, dict) else None
            self.db.execute(
                "INSERT INTO set_names (set_id, lang, name, code, release_date) VALUES (?, ?, ?, ?, ?)",
                (set_id, lang, name, abbreviations.get(lang), lang_release),
            )
        for provider, value in (data.get("thirdParty") or {}).items():
            if provider in PROVIDERS and value is not None:
                self.db.execute(
                    "INSERT INTO set_external_ids (set_id, provider, external_id) VALUES (?, ?, ?)",
                    (set_id, provider, str(value)),
                )

        card_dir = set_file.with_suffix("")
        if card_dir.is_dir():
            for card_file in sorted(card_dir.glob("*.ts")):
                self.build_card(set_id, card_file)

    def build_card(self, set_id: str, card_file: Path) -> None:
        data = read(card_file)
        local_id = card_file.stem
        cursor = self.db.execute(
            "INSERT INTO cards (source_id, set_id, number, number_sort, category, rarity, illustrator, hp) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                f"{set_id}-{local_id}", set_id, local_id, number_sort(local_id),
                data.get("category"), data.get("rarity"), data.get("illustrator"),
                data.get("hp") if isinstance(data.get("hp"), int) else None,
            ),
        )
        card_id = cursor.lastrowid
        self.stats["cards"] += 1

        for lang, name in (data.get("name") or {}).items():
            if not isinstance(name, str) or not self.ensure_language(lang):
                continue
            self.db.execute("INSERT INTO card_names (card_id, lang, name) VALUES (?, ?, ?)", (card_id, lang, name))
            self.db.execute("INSERT INTO card_search (name, card_id, lang) VALUES (?, ?, ?)", (name, card_id, lang))
            self.stats["names"] += 1

        self.add_external(card_id, None, data.get("thirdParty"))
        self.build_variants(card_id, data.get("variants"))
        self.infer_variants(card_id, data.get("rarity"))

    def build_variants(self, card_id: int, variants) -> None:
        entries: list[dict] = []
        if isinstance(variants, list):
            entries = [v for v in variants if isinstance(v, dict)]
        elif isinstance(variants, dict):
            entries = [LEGACY_FLAG_VARIANTS[k] for k, on in variants.items() if on is True and k in LEGACY_FLAG_VARIANTS]
        for entry in entries:
            cursor = self.db.execute(
                "INSERT INTO variants (card_id, type, subtype, size, stamps, foil, languages, inferred) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
                (
                    card_id, entry.get("type", "normal"), entry.get("subtype"), entry.get("size", "standard"),
                    join(entry.get("stamp")), entry.get("foil"), join(entry.get("languages")),
                ),
            )
            self.stats["variants"] += 1
            self.add_external(card_id, cursor.lastrowid, entry.get("thirdParty"))

    def infer_variants(self, card_id: int, rarity) -> None:
        """Guess one print variant from the rarity when TCGdex lists none.

        Deliberately conservative: plain Common/Uncommon/Rare become `normal`, any "Holo"
        rarity becomes `holo`. Reverse holos, 1st editions and stamps are never guessed.
        Rows are flagged inferred = 1 so the app can show them as a guess.
        """
        if self.db.execute("SELECT 1 FROM variants WHERE card_id = ?", (card_id,)).fetchone():
            return
        text = (rarity or "").strip().lower()
        if "holo" in text:
            kind = "holo"
        elif text in ("common", "uncommon", "rare"):
            kind = "normal"
        else:
            return
        self.db.execute(
            "INSERT INTO variants (card_id, type, size, inferred) VALUES (?, ?, 'standard', 1)", (card_id, kind)
        )
        self.stats["variants_inferred"] += 1

    # ----- manual corrections -----

    def apply_overrides(self, path: Path) -> int:
        """Apply etl/overrides/external_ids.csv. Columns: card_source_id, provider, external_id, variant_type.

        An override replaces every ID the catalogue holds for that card and provider
        (and, when variant_type is given, for that variant only). Rows are flagged manual = 1.
        """
        if not path.is_file():
            return 0
        applied = 0
        with path.open(encoding="utf-8", newline="") as handle:
            rows = csv.DictReader(line for line in handle if not line.lstrip().startswith("#"))
            for row in rows:
                source_id = (row.get("card_source_id") or "").strip()
                provider = (row.get("provider") or "").strip()
                external_id = (row.get("external_id") or "").strip()
                variant_type = (row.get("variant_type") or "").strip()
                if not (source_id and provider in PROVIDERS and external_id):
                    self.warn(f"override ignored (incomplete row): {dict(row)}")
                    continue
                card = self.db.execute("SELECT id FROM cards WHERE source_id = ?", (source_id,)).fetchone()
                if not card:
                    self.warn(f"override ignored (unknown card {source_id!r})")
                    continue
                variant_id = None
                if variant_type:
                    found = self.db.execute(
                        "SELECT id FROM variants WHERE card_id = ? AND type = ? ORDER BY id LIMIT 1",
                        (card[0], variant_type),
                    ).fetchone()
                    if not found:
                        self.warn(f"override ignored ({source_id!r} has no {variant_type!r} variant)")
                        continue
                    variant_id = found[0]
                if variant_id is None:
                    self.db.execute(
                        "DELETE FROM external_ids WHERE card_id = ? AND provider = ?", (card[0], provider)
                    )
                else:
                    self.db.execute(
                        "DELETE FROM external_ids WHERE card_id = ? AND provider = ? AND variant_id = ?",
                        (card[0], provider, variant_id),
                    )
                self.db.execute(
                    "INSERT INTO external_ids (card_id, variant_id, provider, external_id, manual) VALUES (?, ?, ?, ?, 1)",
                    (card[0], variant_id, provider, external_id),
                )
                applied += 1
        return applied


def build(tcgdex: Path, out: Path) -> dict:
    if not (tcgdex / "data").is_dir():
        raise SystemExit(f"error: {tcgdex} does not look like a cards-database clone")
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_suffix(out.suffix + ".tmp")
    tmp.unlink(missing_ok=True)

    db = sqlite3.connect(tmp)
    try:
        db.executescript(SCHEMA.read_text(encoding="utf-8"))
        db.execute("INSERT INTO games (id, name) VALUES ('pokemon', 'Pokémon')")
        # Languages are inserted first so every foreign key resolves.
        for code, name in LANGUAGE_NAMES.items():
            db.execute("INSERT INTO languages (code, name) VALUES (?, ?)", (code, name))

        builder = Builder(db)
        builder.plan_set_ids(tcgdex)
        for family in FAMILIES:
            builder.build_family(family, tcgdex)
        overrides = builder.apply_overrides(OVERRIDES)

        # Drop languages with no data so the app only lists real ones.
        used = tuple(builder.languages_seen)
        db.execute(f"DELETE FROM languages WHERE code NOT IN ({','.join('?' * len(used))})", used)

        meta = {
            "schema_version": "1",
            "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "tcgdex_revision": git_revision(tcgdex),
            "manual_overrides_applied": str(overrides),
            "image_url_pattern": "https://assets.tcgdex.net/{lang}/{serie}/{set}/{number}",
        }
        db.executemany("INSERT INTO meta (key, value) VALUES (?, ?)", meta.items())
        db.commit()
        violations = db.execute("PRAGMA foreign_key_check").fetchall()
        if violations:
            raise SystemExit(f"error: {len(violations)} foreign key violations, first: {violations[0]}")
        db.execute("INSERT INTO card_search(card_search) VALUES ('optimize')")
        db.commit()
        db.execute("VACUUM")
    finally:
        db.close()
    tmp.replace(out)
    result = dict(builder.stats)
    result["warnings"] = builder.warnings
    result["overrides"] = overrides
    result["bytes"] = out.stat().st_size
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("repo", type=Path, help="path to a clone of tcgdex/cards-database")
    parser.add_argument("--out", type=Path, default=ROOT / "build" / "catalogue.sqlite")
    args = parser.parse_args()
    result = build(args.repo, args.out)
    for warning in result["warnings"]:
        print(f"warning: {warning}", file=sys.stderr)
    print(
        f"wrote {args.out} ({result['bytes'] / 1e6:.1f} MB): {result['series']} series, {result['sets']} sets, "
        f"{result['cards']} cards, {result['names']} names, {result['variants']} variants, "
        f"{result['external_ids']} marketplace IDs, {result['overrides']} manual overrides"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
