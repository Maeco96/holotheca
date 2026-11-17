#!/usr/bin/env python3
"""Italian card names and scans from Pokémon Central (wiki.pokemoncentral.it, CC BY-NC-SA 3.0).

TCGdex has Italian names only for Base Set and Base Set 2. This reads the article page of each
vintage set (a table "number | name | type | ...") and each card page (og:image = the scan), then
checks the language printed on the scan with Tesseract (scan_language.py), because a wiki page may
illustrate a card with a scan in another language. Only article pages are read (robots.txt forbids
the API and File: pages), one request per second. Stores facts and the image address, no images.

Usage: python3 etl/sources/wiki_it.py --out out/wiki-it.json [--set base3] [--no-ocr] [--budget MIN]
Output: {"<tcgdex set id>-<number>": {"name": it name, "image": url|None, "page": path,
         "read": language read on the scan, "total": "62"}}
"""
import argparse
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import scan_language  # noqa: E402

BASE = "https://wiki.pokemoncentral.it"
UA = scan_language.UA

# TCGdex set id -> candidate article titles on the wiki (first one that answers 200 wins)
SETS = {
    "base1": ["Set_Base_(GCC)", "Base_Set_(GCC)"],
    "base2": ["Giungla_(GCC)", "Jungle_(GCC)"],
    "base3": ["Fossil_(GCC)"],
    "base4": ["Set_Base_2_(GCC)", "Base_Set_2_(GCC)"],
    "base5": ["Team_Rocket_(GCC)", "Rocket_(GCC)"],
    "gym1": ["Gym_Heroes_(GCC)"],
    "gym2": ["Gym_Challenge_(GCC)"],
    "neo1": ["Neo_Genesis_(GCC)"],
    "neo2": ["Neo_Discovery_(GCC)"],
    "neo3": ["Neo_Revelation_(GCC)"],
    "neo4": ["Neo_Destiny_(GCC)"],
    "ecard1": ["Expedition_(GCC)"],
    "ecard2": ["Aquapolis_(GCC)"],
    "ecard3": ["Skyridge_(GCC)"],
}

ROW = re.compile(
    r'<tr>\s*<td[^>]*>\s*(\d+[A-Za-z]?)\s*/\s*(\d+)\s*</td>\s*'
    r'<td[^>]*>\s*<a href="(/[^"]+)"[^>]*>([^<]+)</a>', re.S)
OG_IMAGE = re.compile(r'<meta property="og:image" content="([^"]+)"')


def get(path):
    url = path if path.startswith("http") else BASE + path
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=40) as r:
            return r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def set_rows(page):
    seen = {}
    for num, total, href, name in ROW.findall(page):
        seen.setdefault(num, (total, urllib.parse.unquote(href), html.unescape(name).strip()))
    return seen


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--set", action="append", help="TCGdex set id (default: all known)")
    ap.add_argument("--no-ocr", action="store_true")
    ap.add_argument("--budget", type=float, default=300, help="minutes")
    ap.add_argument("--rate", type=float, default=1.0)
    args = ap.parse_args()

    out = {}
    if os.path.exists(args.out):
        with open(args.out, encoding="utf-8") as f:
            out = json.load(f)
    deadline = time.time() + args.budget * 60
    pause = 1 / args.rate

    for set_id in args.set or SETS:
        page = None
        for title in SETS[set_id]:
            page = get("/" + title)
            time.sleep(pause)
            if page:
                print(f"{set_id}: {title}", flush=True)
                break
        if not page:
            print(f"{set_id}: no article found among {SETS[set_id]}", flush=True)
            continue
        rows = set_rows(page)
        print(f"{set_id}: {len(rows)} rows", flush=True)
        total = next(iter(rows.values()))[0] if rows else "0"
        if total.isdigit():
            missing = [n for n in range(1, int(total) + 1) if str(n) not in rows and f"{n:02d}" not in rows]
            print(f"{set_id}: numbers not found in the table: {missing}", flush=True)
            # the table skips some rows (other markup): keep the numbers visible in the log
        for num, (total, href, name) in rows.items():
            key = f"{set_id}-{num.lstrip('0') or '0'}"
            if key in out and out[key].get("done"):
                continue
            if time.time() > deadline:
                print("budget reached", flush=True)
                break
            entry = {"name": name, "page": href, "total": total, "image": None, "read": None}
            try:
                card = get(href)
                m = OG_IMAGE.search(card or "")
                if m:
                    entry["image"] = m.group(1)
                    if not args.no_ocr:
                        entry["read"], _ = scan_language.read(entry["image"])
                    else:
                        entry["read"] = "?"
                entry["done"] = True
            except Exception as e:  # noqa: BLE001 - keep going
                print(f"  {key}: {e}", flush=True)
            out[key] = entry
            print(f"  {key} {name} read={entry['read']}", flush=True)
            time.sleep(pause)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1, sort_keys=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
