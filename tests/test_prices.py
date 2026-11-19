"""Tests for the Cardmarket price files. Run: python3 -m unittest discover -s tests"""
import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "etl" / "prices"))

import cardmarket_prices as cp  # noqa: E402


def guide(created, rows):
    return {"version": 1, "createdAt": created, "priceGuides": rows}


ROW_A = {"idProduct": 100, "idCategory": 51, "avg": 0.06, "low": 0.02, "trend": 0.09, "avg1": 0.05,
         "avg7": 0.09, "avg30": 0.06, "avg-holo": 0.22, "low-holo": 0.08, "trend-holo": 0.28,
         "avg1-holo": 0.23, "avg7-holo": 0.41, "avg30-holo": 0.29}
ROW_B = {"idProduct": 200, "idCategory": 52, "avg": 153.5, "low": 150, "trend": 207.15, "avg30": None,
         "trend-holo": 0, "avg7": None}


class GuideTests(unittest.TestCase):
    def test_cents_and_field_order(self):
        prices = cp.compact_guide(guide("2026-11-17T02:51:10+0100", [ROW_A, ROW_B, {"idProduct": 300}]))
        self.assertEqual(prices[100], [9, 6, 9, 2, 28, 29, 41, 8])
        self.assertEqual(prices[200], [20715, None, None, 15000, None, None, None, None])  # zero is no price
        self.assertNotIn(300, prices)

    def test_day_is_the_guide_day(self):
        self.assertEqual(cp.guide_day(guide("2026-11-17T02:51:10+0100", [])), "2026-11-17")


class HistoryTests(unittest.TestCase):
    def test_days_stay_aligned_and_reruns_replace(self):
        h = cp.blank_history()
        cp.add_day(h, "2026-11-17", guide("x", [ROW_A]))
        cp.add_day(h, "2026-11-19", guide("x", [ROW_A, ROW_B]))
        cp.add_day(h, "2026-11-18", guide("x", [dict(ROW_A, trend=0.5)]))  # out of order
        cp.add_day(h, "2026-11-18", guide("x", [dict(ROW_A, trend=0.7)]))  # rerun of the same day
        self.assertEqual(h["dates"], ["2026-11-17", "2026-11-18", "2026-11-19"])
        self.assertEqual(h["series"]["100"], [[9, 28], [70, 28], [9, 28]])
        self.assertEqual(h["series"]["200"], [None, None, [20715, None]])

    def test_thin_dates_keeps_recent_days_and_old_mondays(self):
        dates = ["2025-01-01", "2026-06-01", "2026-06-02", "2026-11-01", "2026-11-17"]
        # 2026-06-01 is a Monday (older than 90 days, kept), 2026-06-02 a Tuesday (dropped),
        # 2025-01-01 is a Wednesday older than two years (dropped).
        self.assertEqual(cp.thin_dates(dates, "2026-11-17"), ["2026-06-01", "2026-11-01", "2026-11-17"])


class PhoneTests(unittest.TestCase):
    def test_phone_files(self):
        g = guide("2026-11-17T02:51:10+0100", [ROW_A, ROW_B, dict(ROW_A, idProduct=999)])
        sealed = {"products": [{"idProduct": 200, "name": "Base Set Booster", "categoryName": "Pokémon Booster",
                                "idExpansion": 1523, "dateAdded": "2007-01-01 00:00:00"}]}
        index = {"cards": [[0, "1", 0, [], -1, -1, "P", 100, 0, 0, ""], [0, "2", 0, [], -1, -1, "P", 0, 0, 0, ""]]}
        month = cp.add_day(cp.blank_history(), "2026-11-16", guide("x", [dict(ROW_A, trend=0.08)]))
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            stats = cp.write_phone(g, sealed, index, [month, cp.add_day(cp.blank_history(), "2026-11-17", g)], out)
            phone = json.loads((out / "prices.json").read_text())
            self.assertEqual(sorted(phone["p"]), ["100", "200"])  # 999 is not in the catalogue
            self.assertEqual(phone["sealed"][0][:2], [200, "Base Set Booster"])
            self.assertEqual(phone["day"], "2026-11-17")
            bucket = json.loads((out / "prices-h" / f"{100 % cp.BUCKETS:03d}.json").read_text())
            self.assertEqual(bucket["dates"], ["2026-11-16", "2026-11-17"])
            self.assertEqual(bucket["series"]["100"], [[8, 28], [9, 28]])
            self.assertEqual(stats["products"], 2)

    def test_cli_history_round_trip(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            path = folder / "g.json"
            path.write_text(json.dumps(guide("2026-11-17T02:51:10+0100", [ROW_A])))
            cp.main(["history", "--guide", str(path), "--history-dir", str(folder / "h")])
            cp.main(["history", "--guide", str(path), "--history-dir", str(folder / "h")])
            data = json.loads(gzip.decompress((folder / "h" / "history-2026-11.json.gz").read_bytes()))
            self.assertEqual(data["dates"], ["2026-11-17"])


if __name__ == "__main__":
    unittest.main()


import cardtrader_prices as ct  # noqa: E402


class CardTraderTests(unittest.TestCase):
    def offer(self, cents, lang="it", cond="Near Mint", reverse=False, graded=False, qty=1, nested=True):
        price = {"price": {"cents": cents, "currency": "EUR"}} if nested else {"price_cents": cents, "price_currency": "EUR"}
        return {**price, "quantity": qty, "graded": graded,
                "properties_hash": {"condition": cond, "pokemon_language": lang, "pokemon_reverse": reverse}}

    def test_summarize_lowest_and_count_per_key(self):
        summary = ct.summarize([
            self.offer(300), self.offer(250, qty=2, nested=False), self.offer(900, graded=True),
            self.offer(120, lang="en"), self.offer(400, reverse=True), self.offer(100, cond="Wrong"),
            {**self.offer(50), "price": {"cents": 50, "currency": "USD"}},
        ])
        self.assertEqual(summary[("it", "Near Mint", 0, 0)], [250, 3])
        self.assertEqual(summary[("en", "Near Mint", 0, 0)], [120, 1])
        self.assertEqual(summary[("it", "Near Mint", 1, 0)], [400, 1])
        self.assertEqual(len(summary), 3)

    def test_phone_keys_by_cardmarket_id(self):
        collected = {"day": "2026-11-19", "blueprints": {"77": {"cm": [100, 101], "offers": [["it", "Near Mint", 0, 0, 250, 3]]}}}
        data = ct.phone(collected, {100})
        self.assertEqual(data["p"], {"100": {"b": 77, "o": [["it", 1, 0, 0, 250, 3]]}})
