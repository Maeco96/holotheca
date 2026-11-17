#!/usr/bin/env python3
"""Tells the language printed on card scans, so a scan from a wiki or a site is only used as the
image of the language it really shows (a wiki may illustrate an Italian page with an English scan).

Each image is read with Tesseract and the words printed on every card are counted
(weakness, resistance, retreat... in each language), the same list as web/recognize.js.
The image is kept in memory only.

Usage:
  python3 etl/sources/scan_language.py URL [URL ...]     prints "<lang or ?>  <hits>  <url>"
  python3 etl/sources/scan_language.py --json IN.json --out OUT.json
        IN: {"<key>": {"<lang>": "<url>"}}; OUT adds {"<key>": {"<lang>": {"url", "read"}}}
Needs: tesseract-ocr with the eng, ita, fra, deu, spa, por data, and Pillow.
"""
import argparse
import io
import json
import re
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.request

UA = "Holotheca-catalogue/0.1 (+https://github.com/Maeco96/holotheca; personal collection app)"

LANGUAGE_WORDS = {
    "it": ["debolezza", "resistenza", "ritirata", "allenatore", "sievolveda", "evolveda", "energiabase", "costodiritirata"],
    "en": ["weakness", "resistance", "retreat", "trainer", "evolvesfrom", "basicpokemon", "basicenergy", "retreatcost"],
    "fr": ["faiblesse", "retraite", "dresseur", "evolutionde", "energiedebase", "coutderetraite"],
    "de": ["schwache", "resistenz", "ruckzug", "entwickeltsichaus", "basisenergie", "ruckzugskosten"],
    "es": ["debilidad", "retirada", "entrenador", "evolucionade", "energiabasica", "costederetirada"],
    "pt": ["fraqueza", "recuo", "treinador", "evoluide", "energiabasica", "custoderecuo"],
}


def normalize(text):
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(c for c in text if not unicodedata.combining(c)).lower()
    return re.sub(r"[^\w]+", "", text)


def fetch(url, referer=None):
    headers = {"User-Agent": UA}
    if referer:
        headers["Referer"] = referer
    with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=40) as r:
        return r.read()


def ocr(data):
    from PIL import Image  # noqa: PLC0415 - only needed here

    img = Image.open(io.BytesIO(data)).convert("L")
    if img.width < 1000:  # small scans read better enlarged
        scale = 1000 / img.width
        img = img.resize((1000, int(img.height * scale)))
    with tempfile.NamedTemporaryFile(suffix=".png") as f:
        img.save(f.name)
        out = subprocess.run(
            ["tesseract", f.name, "-", "-l", "eng+ita+fra+deu+spa+por", "--psm", "11"],
            capture_output=True, text=True, timeout=120,
        )
    return out.stdout


def language_of(text):
    key = normalize(text)
    hits = {lang: sum(word in key for word in words) for lang, words in LANGUAGE_WORDS.items()}
    best = max(hits, key=hits.get)
    ranked = sorted(hits.values(), reverse=True)
    if ranked[0] == 0 or ranked[0] == ranked[1]:
        return None, hits
    return best, hits


def read(url, referer=None):
    try:
        return language_of(ocr(fetch(url, referer)))
    except Exception as e:  # noqa: BLE001 - report and go on
        return None, {"error": str(e)[:120]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="*")
    ap.add_argument("--json")
    ap.add_argument("--out")
    ap.add_argument("--rate", type=float, default=1.0)
    args = ap.parse_args()

    if args.json:
        with open(args.json, encoding="utf-8") as f:
            todo = json.load(f)
        out = {}
        for key, by_lang in todo.items():
            for lang, url in by_lang.items():
                found, hits = read(url)
                out.setdefault(key, {})[lang] = {"url": url, "read": found, "hits": hits}
                print(f"{key} {lang}: read {found or '?'} {hits}", flush=True)
                time.sleep(1 / args.rate)
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=1)
        return 0
    for url in args.urls:
        found, hits = read(url)
        print(f"{found or '?':3} {hits}  {url}", flush=True)
        time.sleep(1 / args.rate)
    return 0


if __name__ == "__main__":
    sys.exit(main())
