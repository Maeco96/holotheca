"""Tests for the TCGdex reader and the catalogue builder. Run: python3 -m unittest discover -s tests"""
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "etl"))

import build_catalogue  # noqa: E402
from tsliteral import Ident, ParseError, parse_declaration  # noqa: E402


class ParserTests(unittest.TestCase):
    def test_object_with_comments_trailing_commas_and_quoted_keys(self):
        source = """
        import { Card } from '../../../interfaces'
        // a comment
        const card: Card = {
            name: { en: "It's", 'zh-cn': '宝', },  /* block */
            hp: 80, retreat: -1, ratio: 1.5,
            types: ["Fire", "Water",],
            set: Set,
            flag: true, none: null,
        }
        export default card
        """
        card = parse_declaration(source)
        self.assertEqual(card["name"], {"en": "It's", "zh-cn": "宝"})
        self.assertEqual((card["hp"], card["retreat"], card["ratio"]), (80, -1, 1.5))
        self.assertEqual(card["types"], ["Fire", "Water"])
        self.assertEqual(card["set"], Ident("Set"))
        self.assertIs(card["flag"], True)
        self.assertIsNone(card["none"])

    def test_string_concatenation_and_escapes(self):
        card = parse_declaration('const c = { effect: { en: "Flip " + "a coin.\\n" + "Done" } }')
        self.assertEqual(card["effect"]["en"], "Flip a coin.\nDone")

    def test_errors(self):
        with self.assertRaises(ParseError):
            parse_declaration("const c = { name: ")
        with self.assertRaises(ParseError):
            parse_declaration("export default 1")


SERIE = "const serie: Serie = { id: 'base', name: { en: 'Base' } }"


def write(root: Path, relative: str, content: str) -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


class BuildTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.src = root / "cards-database"
        write(self.src, "data/Base.ts", SERIE)
        write(self.src, "data/Base/Base Set.ts", """const set: Set = {
            id: "base1", name: { en: "Base Set", it: "Set Base" }, serie: serie,
            cardCount: { official: 102 }, releaseDate: "1999-01-09",
            abbreviations: { official: "BS", fr: "BAS" }, thirdParty: { cardmarket: 1523 } }""")
        write(self.src, "data/Base/Base Set/4.ts", """const card: Card = {
            name: { en: "Charizard", it: "Charizard", fr: "Dracaufeu" }, rarity: "Rare",
            category: "Pokemon", illustrator: "Mitsuhiro Arita", hp: 120, set: Set,
            variants: [ { type: "holo", thirdParty: { cardmarket: 111 } }, { type: "normal", stamp: ["1st-edition"] } ],
            thirdParty: { cardmarket: 999 } }""")
        write(self.src, "data/Base/Base Set/5a.ts", """const card: Card = {
            name: { en: "Pidgey" }, category: "Pokemon", set: Set, variants: { normal: true, firstEdition: true } }""")
        write(self.src, "data/Base/Base Set/6.ts", """const card: Card = {
            name: { en: "Rattata" }, rarity: "Common", category: "Pokemon", set: Set }""")
        write(self.src, "data/Base/Base Set/7.ts", """const card: Card = {
            name: { en: "Mew" }, rarity: "Holo Rare", category: "Pokemon", set: Set }""")
        write(self.src, "data/Base/Base Set/8.ts", """const card: Card = {
            name: { en: "Ditto" }, rarity: "Ultra Rare", category: "Pokemon", set: Set }""")
        # Asian family reuses the id base1 for a different set, and one series has the placeholder id 'null'.
        write(self.src, "data-asia/Base.ts", "const serie: Serie = { id: 'null', name: {} }")
        write(self.src, "data-asia/Base/base1.ts", """const set: Set = {
            id: "base1", name: { ja: "拡張パック" }, serie: serie, cardCount: { official: 96 },
            releaseDate: { ja: "1996-10-20" } }""")
        write(self.src, "data-asia/Base/base1/001.ts", """const card: Card = {
            name: { ja: "フシギダネ" }, category: "Pokemon", set: Set }""")
        self.out = root / "catalogue.sqlite"
        self.result = build_catalogue.build(self.src, self.out)
        self.db = sqlite3.connect(self.out)
        self.addCleanup(self.db.close)

    def test_counts_and_unique_set_ids(self):
        self.assertEqual((self.result["sets"], self.result["cards"]), (2, 6))
        ids = dict(self.db.execute("SELECT id, source_id FROM sets"))
        self.assertEqual(ids, {"base1": "base1", "base1~asia": "base1"})

    def test_lookup_by_set_code_and_number(self):
        row = self.db.execute(
            "SELECT c.source_id, n.name FROM cards c JOIN sets s ON s.id = c.set_id "
            "JOIN card_names n ON n.card_id = c.id AND n.lang = 'it' WHERE s.code = 'BS' AND c.number_sort = 4"
        ).fetchone()
        self.assertEqual(row, ("base1-4", "Charizard"))

    def test_names_variants_and_marketplace_ids(self):
        langs = {r[0] for r in self.db.execute("SELECT lang FROM card_names WHERE card_id = (SELECT id FROM cards WHERE source_id = 'base1-4')")}
        self.assertEqual(langs, {"en", "it", "fr"})
        variants = self.db.execute(
            "SELECT type, stamps FROM variants WHERE card_id = (SELECT id FROM cards WHERE source_id = 'base1-4') ORDER BY id"
        ).fetchall()
        self.assertEqual(variants, [("holo", None), ("normal", "1st-edition")])
        legacy = self.db.execute(
            "SELECT type, stamps FROM variants WHERE card_id = (SELECT id FROM cards WHERE source_id = 'base1-5a') ORDER BY id"
        ).fetchall()
        self.assertEqual(legacy, [("normal", None), ("normal", "1st-edition")])
        ids = self.db.execute(
            "SELECT provider, external_id, variant_id IS NULL FROM external_ids WHERE card_id = "
            "(SELECT id FROM cards WHERE source_id = 'base1-4') ORDER BY external_id"
        ).fetchall()
        self.assertEqual(ids, [("cardmarket", "111", 0), ("cardmarket", "999", 1)])

    def test_variants_inferred_only_when_unambiguous(self):
        def inferred(source_id):
            return self.db.execute(
                "SELECT type, inferred FROM variants WHERE card_id = (SELECT id FROM cards WHERE source_id = ?)",
                (source_id,),
            ).fetchall()

        self.assertEqual(inferred("base1-6"), [("normal", 1)])
        self.assertEqual(inferred("base1-7"), [("holo", 1)])
        self.assertEqual(inferred("base1-8"), [])
        self.assertEqual(inferred("base1-4")[0][1], 0)

    def test_scan_index_export(self):
        import export_scan_index
        import json

        out = Path(self.tmp.name) / "scan-index.json"
        stats = export_scan_index.export(self.out, out)
        index = json.loads(out.read_text(encoding="utf-8"))
        self.assertEqual(stats["cards"], len(index["cards"]))
        sets = {row[0]: i for i, row in enumerate(index["sets"])}
        charizard = next(c for c in index["cards"] if c[0] == sets["base1"] and c[1] == "4")
        self.assertEqual(charizard[2], 120)
        # English name first, then Italian (same text here), then the others.
        self.assertEqual([index["names"][i] for i in charizard[3]], ["Charizard", "Dracaufeu"])
        self.assertEqual(index["illustrators"][charizard[4]], "Mitsuhiro Arita")
        self.assertEqual(index["sets"][sets["base1"]][1:3], ["BS", 102])

    def test_search_and_foreign_keys(self):
        hit = self.db.execute("SELECT card_id FROM card_search WHERE card_search MATCH 'dracaufeu*'").fetchall()
        self.assertEqual(len(hit), 1)
        self.assertEqual(self.db.execute("PRAGMA foreign_key_check").fetchall(), [])

    def test_manual_override_replaces_and_flags(self):
        overrides = Path(self.tmp.name) / "overrides.csv"
        overrides.write_text(
            "# comment\ncard_source_id,provider,external_id,variant_type\nbase1-4,cardmarket,424242,\n", encoding="utf-8"
        )
        builder = build_catalogue.Builder(self.db)
        self.assertEqual(builder.apply_overrides(overrides), 1)
        rows = self.db.execute(
            "SELECT external_id, manual FROM external_ids WHERE card_id = (SELECT id FROM cards WHERE source_id = 'base1-4') "
            "AND variant_id IS NULL"
        ).fetchall()
        self.assertEqual(rows, [("424242", 1)])


if __name__ == "__main__":
    unittest.main()
