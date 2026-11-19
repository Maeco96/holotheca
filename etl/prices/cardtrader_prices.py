#!/usr/bin/env python3
"""CardTrader offers by language and condition, through CardTrader's public API.

CardTrader gives every account a free API token (profile settings). With it this script asks,
for every Pokémon expansion, for the blueprints (one per sellable card, with its Cardmarket ids)
and for the cheapest offers on sale, then keeps, for each card, the lowest price and the number of
offers for each combination of language, condition, reverse and 1st edition. Graded offers are
left out. The token comes from the environment (CARDTRADER_TOKEN) and is never written anywhere.

  collect  calls the API and writes cardtrader-latest.json.gz (kept as a release asset);
  phone    turns that file into web/data/cardtrader.json for the app, keyed by Cardmarket id.

The API shape follows https://www.cardtrader.com/docs/api/full (GET /games, /expansions,
/blueprints/export?expansion_id=, /marketplace/products?expansion_id=). The parsing is tolerant
because the documentation could not be read when this was written (site under maintenance).
Standard library only.
"""
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://api.cardtrader.com/api/v2"
UA = "Holotheca-prices/0.1 (+https://github.com/Maeco96/holotheca)"
PAUSE = 0.25  # seconds between calls: well under the documented limits

# CardTrader condition names, best first. The app's Cardmarket-style grades map onto them
# (web/prices.js CT_CONDITION): MT Mint, NM Near Mint, EX Slightly Played, GD Moderately Played,
# LP Played, PL Heavily Played, PO Poor.
CONDITIONS = ["Mint", "Near Mint", "Slightly Played", "Moderately Played", "Played", "Heavily Played", "Poor"]


class Api:
    def __init__(self, token: str):
        self.token = token
        self.calls = 0

    def get(self, path: str, retries: int = 3):
        url = API + path
        for attempt in range(retries):
            request = urllib.request.Request(url, headers={"Authorization": f"Bearer {self.token}", "User-Agent": UA,
                                                           "Accept": "application/json"})
            try:
                time.sleep(PAUSE)
                self.calls += 1
                with urllib.request.urlopen(request, timeout=60) as response:
                    return json.loads(response.read())
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt + 1 < retries:
                    time.sleep(10 * (attempt + 1))
                    continue
                raise
        return None


# ---------- parsing helpers (tolerant) ----------

def as_list(data):
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("array", "data", "items", "results"):
            if isinstance(data.get(key), list):
                return data[key]
    return []


def price_cents(product: dict) -> tuple[int | None, str | None]:
    price = product.get("price")
    if isinstance(price, dict):
        cents = price.get("cents")
        currency = price.get("currency") or price.get("currency_symbol")
    else:
        cents = product.get("price_cents")
        currency = product.get("price_currency")
    try:
        return (int(cents) if cents is not None else None), (str(currency).upper() if currency else None)
    except (TypeError, ValueError):
        return None, None


def offer_key(product: dict) -> tuple[str, str, int, int] | None:
    """(language, condition, reverse, first edition) of an offer, or None for graded or unknown ones."""
    if product.get("graded"):
        return None
    props = product.get("properties_hash") or product.get("properties") or {}
    if not isinstance(props, dict):
        return None
    language = next((str(v).lower() for k, v in props.items() if k.endswith("language") and v), None)
    condition = props.get("condition")
    if not language or condition not in CONDITIONS:
        return None
    reverse = int(any(bool(v) for k, v in props.items() if k.endswith("reverse") and isinstance(v, bool)))
    first = int(any(bool(v) for k, v in props.items() if "first_edition" in k and isinstance(v, bool)))
    return language, condition, reverse, first


def summarize(products: list[dict]) -> dict[tuple, list[int]]:
    """Lowest price (EUR cents) and count of offers for each offer key."""
    out: dict[tuple, list[int]] = {}
    for product in products:
        key = offer_key(product)
        cents, currency = price_cents(product)
        if key is None or cents is None or cents <= 0 or (currency and currency not in ("EUR", "€")):
            continue
        quantity = int(product.get("quantity") or 1)
        entry = out.get(key)
        if entry is None:
            out[key] = [cents, quantity]
        else:
            entry[0] = min(entry[0], cents)
            entry[1] += quantity
    return out


# ---------- collect ----------

def pokemon_game_id(api: Api) -> int:
    for game in as_list(api.get("/games")):
        name = str(game.get("name") or game.get("display_name") or "").lower()
        if name.startswith("pok"):
            return int(game["id"])
    raise SystemExit("Pokémon not found in CardTrader /games")


def collect(api: Api, limit: int | None = None) -> dict:
    game = pokemon_game_id(api)
    expansions = [e for e in as_list(api.get("/expansions")) if int(e.get("game_id") or 0) == game]
    if limit:
        expansions = expansions[:limit]
    cards = {}
    for number, expansion in enumerate(expansions, 1):
        exp_id = int(expansion["id"])
        try:
            blueprints = as_list(api.get(f"/blueprints/export?expansion_id={exp_id}"))
            offers = api.get(f"/marketplace/products?expansion_id={exp_id}") or {}
        except urllib.error.HTTPError as e:
            print(f"  expansion {exp_id}: HTTP {e.code}", file=sys.stderr)
            continue
        for blueprint in blueprints:
            cm_ids = blueprint.get("card_market_ids") or ([blueprint["card_market_id"]] if blueprint.get("card_market_id") else [])
            products = offers.get(str(blueprint.get("id"))) if isinstance(offers, dict) else None
            summary = summarize(products or [])
            cards[str(blueprint["id"])] = {
                "cm": [int(x) for x in cm_ids if x],
                "tcg": blueprint.get("tcg_player_id"),
                "name": blueprint.get("name"),
                "expansion": exp_id,
                "offers": [[*key, *value] for key, value in sorted(summary.items())],
            }
        if number % 50 == 0:
            print(f"  {number}/{len(expansions)} expansions, {api.calls} calls", file=sys.stderr)
    return {"schema": 1, "source": "cardtrader", "day": dt.date.today().isoformat(),
            "conditions": CONDITIONS, "blueprints": cards}


# ---------- phone ----------

def phone(collected: dict, wanted: set[int]) -> dict:
    """Keyed by Cardmarket id: {"b": blueprint id, "o": [[lang, condition index, reverse, first, cents, count]]}."""
    out: dict[str, dict] = {}
    for blueprint_id, card in collected.get("blueprints", {}).items():
        for cm in card.get("cm", []):
            if wanted and cm not in wanted:
                continue
            entry = out.setdefault(str(cm), {"b": int(blueprint_id), "o": []})
            for language, condition, reverse, first, cents, count in card.get("offers", []):
                entry["o"].append([language, CONDITIONS.index(condition), reverse, first, cents, count])
    return {"schema": 1, "source": "cardtrader", "day": collected.get("day"), "conditions": CONDITIONS, "p": out}


def load_json(path: Path):
    data = path.read_bytes()
    if path.suffix == ".gz":
        data = gzip.decompress(data)
    return json.loads(data)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p_collect = sub.add_parser("collect")
    p_collect.add_argument("--out", type=Path, required=True)
    p_collect.add_argument("--limit", type=int, help="only the first N expansions (smoke test)")
    p_phone = sub.add_parser("phone")
    p_phone.add_argument("--collected", type=Path, required=True)
    p_phone.add_argument("--index", type=Path, required=True, help="web/data/scan-index.json")
    p_phone.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)

    if args.command == "collect":
        token = os.environ.get("CARDTRADER_TOKEN", "").strip()
        if not token:
            print("CARDTRADER_TOKEN is not set: nothing collected")
            return 0
        api = Api(token)
        data = collect(api, args.limit)
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_bytes(gzip.compress(json.dumps(data, separators=(",", ":")).encode(), mtime=0))
        with_offers = sum(1 for c in data["blueprints"].values() if c["offers"])
        print(f"{len(data['blueprints'])} blueprints, {with_offers} with offers, {api.calls} API calls")
        return 0

    index = load_json(args.index)
    wanted = {int(r[7]) for r in index.get("cards", []) if len(r) > 7 and r[7]}
    data = phone(load_json(args.collected), wanted)
    args.out.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False))
    print(f"cardtrader.json: {len(data['p'])} cards")
    return 0


if __name__ == "__main__":
    sys.exit(main())
