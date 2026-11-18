#!/usr/bin/env python3
"""Cardmarket prices for the app, from the files Cardmarket publishes for its users.

Cardmarket publishes, once a day, a price guide for every Pokémon product (singles and sealed)
and a product list, as plain JSON files that need no account or API
(https://www.cardmarket.com/Data/Download). Nothing is scraped. This script:

  fetch    downloads the price guide and the sealed product list into a folder;
  history  adds the day of a price guide to the month file of the price history
           (history-YYYY-MM.json.gz, kept as release assets by .github/workflows/prices.yml);
  phone    writes what the phone reads: data/prices.json (today's prices of the products the
           catalogue knows, plus the sealed products) and data/prices-h/NNN.json (the history of
           those products, split into buckets by product id so a card page loads one small file).

Prices are stored in euro cents (integers) to keep the files small; missing values are null.
In the price guide the "-holo" fields are the foil copies of a product: for Pokémon that is the
reverse holo of a card (a holo rare is its own product with its own normal fields).

Standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import sys
import urllib.request
from pathlib import Path

GAME = 6  # Pokémon on Cardmarket
BASE = "https://downloads.s3.cardmarket.com/productCatalog"
GUIDE_URL = f"{BASE}/priceGuide/price_guide_{GAME}.json"
SEALED_URL = f"{BASE}/productList/products_nonsingles_{GAME}.json"
UA = "Holotheca-prices/0.1 (+https://github.com/Maeco96/holotheca)"

# Positions in each row of prices.json "p". Keep in step with web/prices.js.
FIELDS = ("trend", "avg30", "avg7", "low", "trend-holo", "avg30-holo", "avg7-holo", "low-holo")
# The history keeps the trend of the normal and of the foil (reverse) copy.
HISTORY_FIELDS = ("trend", "trend-holo")
BUCKETS = 256
DAILY_DAYS = 90       # the phone history keeps every day for this long...
HISTORY_DAYS = 730    # ...then one day a week, up to this age


def cents(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if number <= 0:
        return None
    return int(round(number * 100))


def guide_day(guide: dict) -> str:
    """The day a price guide describes, from its createdAt (Central European time)."""
    created = str(guide.get("createdAt") or "")
    try:
        return dt.datetime.strptime(created, "%Y-%m-%dT%H:%M:%S%z").date().isoformat()
    except ValueError:
        return created[:10] or dt.date.today().isoformat()


def compact_guide(guide: dict) -> dict[int, list[int | None]]:
    """Product id -> prices in cents, in the order of FIELDS. Products without any price are left out."""
    out = {}
    for row in guide.get("priceGuides", []):
        try:
            product = int(row["idProduct"])
        except (KeyError, TypeError, ValueError):
            continue
        values = [cents(row.get(field)) for field in FIELDS]
        if any(v is not None for v in values):
            out[product] = values
    return out


# ---------- history ----------

def load_json(path: Path):
    data = path.read_bytes()
    if path.suffix == ".gz":
        data = gzip.decompress(data)
    return json.loads(data)


def blank_history() -> dict:
    return {"schema": 1, "source": "cardmarket", "fields": list(HISTORY_FIELDS), "dates": [], "series": {}}


def add_day(history: dict, day: str, guide: dict) -> dict:
    """Puts one day of a price guide into a month history, keeping every series aligned with dates.

    Re-adding a day that is already there replaces it, so a rerun of the workflow is harmless.
    """
    dates = history["dates"]
    series = history["series"]
    if day in dates:
        at = dates.index(day)
    else:
        dates.append(day)
        dates.sort()
        at = dates.index(day)
        for values in series.values():
            values.insert(at, None)
    picks = [FIELDS.index(f) for f in HISTORY_FIELDS]
    seen = set()
    for product, prices in compact_guide(guide).items():
        key = str(product)
        seen.add(key)
        point = [prices[i] for i in picks]
        if all(v is None for v in point):
            point = None
        values = series.get(key)
        if values is None:
            values = series[key] = [None] * len(dates)
        values[at] = point
    for key, values in series.items():
        if key not in seen:
            values[at] = None
    return history


def month_file(folder: Path, day: str) -> Path:
    return folder / f"history-{day[:7]}.json.gz"


def write_gz(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    raw = json.dumps(data, separators=(",", ":")).encode()
    path.write_bytes(gzip.compress(raw, mtime=0))


# ---------- phone files ----------

def catalogue_ids(index: dict) -> set[int]:
    """Cardmarket product ids of the catalogue cards (position 7 of a card row in scan-index.json)."""
    ids = set()
    for row in index.get("cards", []):
        if len(row) > 7 and row[7]:
            ids.add(int(row[7]))
    return ids


def sealed_rows(products: dict) -> list[list]:
    """Sealed products as [id, name, category, expansion id, date added], newest first."""
    rows = []
    for p in products.get("products", []):
        try:
            rows.append([int(p["idProduct"]), str(p.get("name") or ""), str(p.get("categoryName") or ""),
                         int(p.get("idExpansion") or 0), str(p.get("dateAdded") or "")[:10]])
        except (KeyError, TypeError, ValueError):
            continue
    rows.sort(key=lambda r: (r[4], r[0]), reverse=True)
    return rows


def thin_dates(dates: list[str], today: str) -> list[str]:
    """Every day of the last DAILY_DAYS, then Mondays only, up to HISTORY_DAYS back."""
    end = dt.date.fromisoformat(today)
    kept = []
    for day in dates:
        age = (end - dt.date.fromisoformat(day)).days
        if age < 0 or age > HISTORY_DAYS:
            continue
        if age <= DAILY_DAYS or dt.date.fromisoformat(day).weekday() == 0:
            kept.append(day)
    return kept


def merge_histories(months: list[dict], wanted: set[int], today: str) -> dict:
    """One history over several month files, for the wanted products only, thinned with thin_dates."""
    all_dates = sorted({d for m in months for d in m.get("dates", [])})
    dates = thin_dates(all_dates, today)
    position = {d: i for i, d in enumerate(dates)}
    series: dict[str, list] = {}
    for month in months:
        month_dates = month.get("dates", [])
        for key, values in month.get("series", {}).items():
            if int(key) not in wanted:
                continue
            for day, point in zip(month_dates, values):
                if point is None or day not in position:
                    continue
                series.setdefault(key, [None] * len(dates))[position[day]] = point
    return {"dates": dates, "series": series}


def bucket_of(product: int) -> int:
    return product % BUCKETS


def write_phone(guide: dict, sealed: dict | None, index: dict, months: list[dict], out: Path) -> dict:
    day = guide_day(guide)
    prices = compact_guide(guide)
    sealed_list = sealed_rows(sealed) if sealed else []
    wanted = catalogue_ids(index) | {r[0] for r in sealed_list}
    phone = {
        "schema": 1,
        "source": "cardmarket",
        "currency": "EUR",
        "day": day,
        "created_at": guide.get("createdAt"),
        "fields": list(FIELDS),
        "buckets": BUCKETS,
        "p": {str(k): v for k, v in prices.items() if k in wanted},
        "sealed": [r for r in sealed_list if r[0] in prices] + [r for r in sealed_list if r[0] not in prices],
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "prices.json").write_text(json.dumps(phone, separators=(",", ":"), ensure_ascii=False))

    history = merge_histories(months, wanted, day)
    folder = out / "prices-h"
    folder.mkdir(parents=True, exist_ok=True)
    buckets: dict[int, dict] = {}
    for key, values in history["series"].items():
        buckets.setdefault(bucket_of(int(key)), {})[key] = values
    for number in range(BUCKETS):
        data = {"fields": list(HISTORY_FIELDS), "dates": history["dates"], "series": buckets.get(number, {})}
        (folder / f"{number:03d}.json").write_text(json.dumps(data, separators=(",", ":")))
    return {"day": day, "products": len(phone["p"]), "sealed": len(phone["sealed"]),
            "history_days": len(history["dates"]), "history_products": len(history["series"])}


# ---------- command line ----------

def download(url: str, path: Path) -> None:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(request, timeout=120) as response:
        path.write_bytes(response.read())


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    p_fetch = sub.add_parser("fetch", help="download the price guide and the sealed product list")
    p_fetch.add_argument("--out", type=Path, required=True)

    p_hist = sub.add_parser("history", help="add a price guide day to its month history file")
    p_hist.add_argument("--guide", type=Path, required=True)
    p_hist.add_argument("--history-dir", type=Path, required=True)

    p_phone = sub.add_parser("phone", help="write data/prices.json and data/prices-h/ for the app")
    p_phone.add_argument("--guide", type=Path, required=True)
    p_phone.add_argument("--sealed", type=Path)
    p_phone.add_argument("--index", type=Path, required=True, help="web/data/scan-index.json")
    p_phone.add_argument("--history-dir", type=Path, help="folder with history-YYYY-MM.json.gz files")
    p_phone.add_argument("--out", type=Path, required=True, help="web/data")

    args = parser.parse_args(argv)
    if args.command == "fetch":
        args.out.mkdir(parents=True, exist_ok=True)
        download(GUIDE_URL, args.out / f"price_guide_{GAME}.json")
        download(SEALED_URL, args.out / f"products_nonsingles_{GAME}.json")
        guide = load_json(args.out / f"price_guide_{GAME}.json")
        print(f"price guide of {guide.get('createdAt')}: {len(guide.get('priceGuides', []))} products")
        return 0

    if args.command == "history":
        guide = load_json(args.guide)
        day = guide_day(guide)
        path = month_file(args.history_dir, day)
        history = load_json(path) if path.exists() else blank_history()
        add_day(history, day, guide)
        write_gz(path, history)
        print(f"{path.name}: {len(history['dates'])} days, {len(history['series'])} products, last {day}")
        return 0

    guide = load_json(args.guide)
    sealed = load_json(args.sealed) if args.sealed and args.sealed.exists() else None
    index = load_json(args.index)
    months = []
    if args.history_dir and args.history_dir.exists():
        months = [load_json(p) for p in sorted(args.history_dir.glob("history-*.json.gz"))]
    if not any(guide_day(guide) in m.get("dates", []) for m in months):
        months.append(add_day(blank_history(), guide_day(guide), guide))  # today, even before the first history run
    stats = write_phone(guide, sealed, index, months, args.out)
    print(json.dumps(stats))
    return 0


if __name__ == "__main__":
    sys.exit(main())
