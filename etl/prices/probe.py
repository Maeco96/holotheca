#!/usr/bin/env python3
"""Asks the price sources what they serve, before a price collector is built on them.

For each URL prints status, headers that matter (type, size, CORS, caching, last change) and
the start of the body; for JSON it also prints the top-level shape and one sample record.
Runs from GitHub Actions because these hosts are not reachable from every build environment.
"""
import gzip
import json
import urllib.error
import urllib.request

UA = "Holotheca-price-check/0.1 (+https://github.com/Maeco96/holotheca)"
ORIGIN = "https://maeco96.github.io"

URLS = [
    # Cardmarket: files published for users (price guide and product list), game 6 = Pokémon
    "https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json",
    "https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json",
    "https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_6.json",
    # TCGdex: prices embedded in the card response (does the phone get CORS?)
    "https://api.tcgdex.net/v2/en/cards/swsh3-136",
    "https://api.tcgdex.net/v2/it/cards/sv02-001",
    "https://api.tcgdex.net/v2/ja/cards/SV2a-006",
    # TCGCSV: TCGplayer prices, category 3 = Pokémon
    "https://tcgcsv.com/tcgplayer/3/groups",
    "https://tcgcsv.com/last-updated.txt",
]

HEADERS = ("Content-Type", "Content-Length", "Content-Encoding", "Last-Modified", "Cache-Control",
           "Access-Control-Allow-Origin", "ETag")


def shape(obj, depth=0):
    if isinstance(obj, dict):
        keys = list(obj)[:15]
        print("  " * depth + f"dict keys={keys}")
        for k in keys[:6]:
            v = obj[k]
            if isinstance(v, (dict, list)):
                print("  " * depth + f"- {k}:")
                shape(v, depth + 1)
            else:
                print("  " * depth + f"- {k}: {str(v)[:80]}")
    elif isinstance(obj, list):
        print("  " * depth + f"list len={len(obj)}")
        if obj:
            shape(obj[0], depth + 1)


def main():
    for url in URLS:
        print("=" * 100)
        print(url)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Origin": ORIGIN,
                                                   "Accept-Encoding": "gzip"})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                status, hdr, body = r.status, r.headers, r.read(80_000_000)
        except urllib.error.HTTPError as e:
            status, hdr, body = e.code, e.headers, e.read(5000)
        except Exception as e:  # noqa: BLE001
            print("  ERROR", e)
            continue
        print("  status", status, "bytes", len(body))
        for h in HEADERS:
            if hdr.get(h):
                print(f"  {h}: {hdr.get(h)}")
        if hdr.get("Content-Encoding") == "gzip":
            body = gzip.decompress(body)
        try:
            data = json.loads(body)
        except Exception:  # noqa: BLE001
            print(body[:600].decode("utf-8", "replace"))
            continue
        shape(data)
        if isinstance(data, dict) and "pricing" in data:
            print("  pricing:", json.dumps(data["pricing"])[:1500])
        for key in ("priceGuides", "products"):
            if isinstance(data, dict) and isinstance(data.get(key), list):
                items = data[key]
                print(f"  {key}: {len(items)} records; createdAt={data.get('createdAt')}")
                print("  sample:", json.dumps(items[:3])[:1500])
                if key == "priceGuides":
                    with_price = sum(1 for p in items if p.get("trend") or p.get("avg"))
                    print(f"  with trend or avg: {with_price}")


if __name__ == "__main__":
    main()
