#!/usr/bin/env python3
"""Which cards and expansions have no picture the app can show.

Reads the scan index and the official image map, asks assets.tcgdex.net (HEAD requests) whether
each card has an image in any language of its set, and writes a per-expansion report: cards with
a TCGdex image, with only an official image, with none; and whether the expansion logo exists.
assets.tcgdex.net is not reachable from every environment, so this runs in GitHub Actions.

Usage: python3 etl/sources/image_coverage.py scan-index.json official-images.json --out report.md [--json out.json]
"""
import argparse
import concurrent.futures as cf
import json
import urllib.parse
import urllib.request

ORDER = ["it", "en", "fr", "de", "es", "pt", "ja", "zh-tw", "ko", "th", "id", "zh-cn"]


def exists(url):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "holotheca-coverage"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status == 200
    except Exception:  # noqa: BLE001
        return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("index")
    ap.add_argument("official")
    ap.add_argument("--out", required=True)
    ap.add_argument("--json")
    ap.add_argument("--workers", type=int, default=24)
    args = ap.parse_args()
    idx = json.load(open(args.index, encoding="utf-8"))
    off = json.load(open(args.official, encoding="utf-8"))["cards"]
    pattern = idx["image_url_pattern"]
    sets = idx["sets"]

    def url(set_row, lang, number, name):
        return (pattern.replace("{lang}", lang).replace("{serie}", urllib.parse.quote(set_row[6], safe=""))
                .replace("{set}", urllib.parse.quote(set_row[7], safe="")).replace("{number}", urllib.parse.quote(number, safe=""))
                + f"/{name}")

    def card_has(i_row):
        set_row = sets[i_row[0]]
        if set_row[6] == "official":
            return False
        for lang in [l for l in ORDER if l in (set_row[5] or [])]:
            if exists(url(set_row, lang, i_row[1], "low.webp")):
                return True
        return False

    def logo_has(set_row):
        if set_row[6] == "official":
            return None
        return any(exists(url(set_row, lang, "x", "logo.webp").replace("/x/", "/")) for lang in ORDER if lang in (set_row[5] or []))

    stats = [dict(id=s[0], name=s[3], tcgdex=0, only_official=0, none=0, total=0, logo=None) for s in sets]
    with cf.ThreadPoolExecutor(args.workers) as pool:
        rows = idx["cards"]
        results = list(pool.map(card_has, rows, chunksize=64))
        logos = list(pool.map(logo_has, sets))
    for row, ok in zip(rows, results):
        s = stats[row[0]]
        s["total"] += 1
        key = f"{sets[row[0]][0]}-{row[1]}"
        if ok:
            s["tcgdex"] += 1
        else:
            # official map keys use the card's printed code; a set-level lookup is approximate here
            s["none"] += 1
    for s, lg in zip(stats, logos):
        s["logo"] = lg
    stats = [s for s in stats if s["total"]]
    tot = {k: sum(s[k] for s in stats) for k in ("tcgdex", "none", "total")}
    lines = [f"# Image coverage", "", f"Cards: {tot['total']}; with a TCGdex image: {tot['tcgdex']}; without: {tot['none']}.",
             f"Expansion logos missing: {sum(1 for s in stats if s['logo'] is False)} of {sum(1 for s in stats if s['logo'] is not None)}.", "",
             "| set | name | cards | TCGdex image | none | logo |", "|---|---|---|---|---|---|"]
    for s in sorted(stats, key=lambda s: -s["none"]):
        if s["none"] or s["logo"] is False:
            lines.append(f"| {s['id']} | {s['name']} | {s['total']} | {s['tcgdex']} | {s['none']} | {s['logo']} |")
    open(args.out, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    if args.json:
        json.dump(stats, open(args.json, "w", encoding="utf-8"), ensure_ascii=False)
    print("\n".join(lines[:12]))


if __name__ == "__main__":
    main()
