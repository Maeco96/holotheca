#!/usr/bin/env python3
"""Build the visual index of the catalogue: one image per card, two vectors per image.

For every card of the scan index this downloads one reference image (TCGdex first, English
before the other languages because the artwork is the same; the official site when TCGdex has
none), and stores for the whole card and for its artwork window the model vector
(export_model.py) and a 256-bit difference hash. Images are only read in memory, never written.

A previous index can be passed with --previous: cards whose image address did not change keep
their vectors, so a weekly run only downloads new cards.

Output directory:
  keys.json   {"model": ..., "keys": [card key], "urls": [image address]}
  full.f16    float16 [n, dim]   vectors of the whole card
  art.f16     float16 [n, dim]   vectors of the artwork window
  dhash.bin   uint8   [n, 2, 32] difference hashes (whole card, artwork)

Usage: python3 etl/visual/build_index.py scan-index.json official-images.json \
         --model web/vendor/visual/dinov2s-int8.onnx --out build/visual [--previous old/] [--sets REGEX]
"""
from __future__ import annotations

import argparse
import io
import json
import queue
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import dhash, regions, tensor  # noqa: E402

USER_AGENT = "holotheca-visual-index/1.0 (personal card catalogue)"
LANG_ORDER = ["en", "it", "fr", "de", "es", "pt", "ja", "zh-tw", "ko", "th", "id", "zh-cn"]
OFFICIAL_REFERER = {"ja": "https://www.pokemon-card.com/", "ko": "https://pokemoncard.co.kr/", "zh-tw": "https://asia.pokemon-card.com/"}


def card_images(index: dict, official: dict) -> list[tuple[str, list[tuple[str, str]]]]:
    """[(card key, [(image address, referer)])] in the order the images are tried."""
    pattern = index["image_url_pattern"]
    sets = index["sets"]
    prefix = official.get("prefix", {})
    out = []
    for row in index["cards"]:
        s = sets[row[0]]
        key = f"{s[0]}-{row[1]}"
        urls = []
        if pattern and s[6] and s[6] != "official":
            for lang in [l for l in LANG_ORDER if l in (s[5] or [])]:
                urls.append((pattern.replace("{lang}", lang).replace("{serie}", urllib.parse.quote(s[6], safe=""))
                             .replace("{set}", urllib.parse.quote(s[7], safe="")).replace("{number}", urllib.parse.quote(row[1], safe=""))
                             + "/low.webp", ""))
        for lang, path in (official.get("cards", {}).get(key) or {}).items():
            if lang == "it":
                continue  # wiki scans of vintage Italian cards: the English TCGdex image has the same art
            url = path if re.match(r"^https?:", path) else prefix.get(lang, "") + path
            urls.append((url, OFFICIAL_REFERER.get(lang, "")))
        out.append((key, urls))
    return out


class Fetcher:
    """Downloads images: TCGdex in parallel, every other host one request per second."""

    def __init__(self, official_budget: int):
        self.official_budget = official_budget
        self.official_used = 0
        self.lock = threading.Lock()
        self.last_slow = 0.0

    def get(self, url: str, referer: str) -> bytes | None:
        slow = "tcgdex.net" not in url
        if slow:
            with self.lock:
                if self.official_used >= self.official_budget:
                    return None
                self.official_used += 1
                wait = self.last_slow + 1.0 - time.time()
                if wait > 0:
                    time.sleep(wait)
                self.last_slow = time.time()
        headers = {"User-Agent": USER_AGENT}
        if referer:
            headers["Referer"] = referer
        for attempt in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
                    return r.read()
            except urllib.error.HTTPError as e:
                if e.code in (403, 404, 410):
                    return None
            except Exception:  # noqa: BLE001
                pass
            time.sleep(2 * (attempt + 1))
        return None

    def first(self, urls: list[tuple[str, str]]) -> tuple[str, Image.Image] | None:
        for url, referer in urls:
            data = self.get(url, referer)
            if not data:
                continue
            try:
                image = Image.open(io.BytesIO(data))
                image.load()
                return url, image
            except Exception:  # noqa: BLE001
                continue
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("index", type=Path)
    ap.add_argument("official", type=Path)
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--previous", type=Path)
    ap.add_argument("--sets", help="only sets whose id matches this regular expression")
    ap.add_argument("--official-budget", type=int, default=0, help="most requests to the official sites in this run")
    ap.add_argument("--workers", type=int, default=16)
    ap.add_argument("--batch", type=int, default=32)
    args = ap.parse_args()

    index = json.loads(args.index.read_text(encoding="utf-8"))
    official = json.loads(args.official.read_text(encoding="utf-8")) if args.official.exists() else {}
    cards = card_images(index, official)
    if args.sets:
        rx = re.compile(args.sets)
        cards = [c for c in cards if rx.search(c[0].rsplit("-", 1)[0])]

    previous: dict[str, tuple[str, np.ndarray, np.ndarray, np.ndarray]] = {}
    if args.previous and (args.previous / "keys.json").exists():
        meta = json.loads((args.previous / "keys.json").read_text(encoding="utf-8"))
        dim = meta["dim"]
        full = np.fromfile(args.previous / "full.f16", dtype=np.float16).reshape(-1, dim)
        art = np.fromfile(args.previous / "art.f16", dtype=np.float16).reshape(-1, dim)
        hashes = np.fromfile(args.previous / "dhash.bin", dtype=np.uint8).reshape(-1, 2, 32)
        for i, (key, url) in enumerate(zip(meta["keys"], meta["urls"])):
            previous[key] = (url, full[i], art[i], hashes[i])
        print(f"previous index: {len(previous)} cards")

    session = ort.InferenceSession(str(args.model), providers=["CPUExecutionProvider"])
    dim = session.get_outputs()[0].shape[1]
    fetcher = Fetcher(args.official_budget)
    keys, urls, full_rows, art_rows, hash_rows = [], [], [], [], []
    todo = []
    for key, candidates in cards:
        old = previous.get(key)
        if old and old[0] in {u for u, _ in candidates}:
            keys.append(key); urls.append(old[0]); full_rows.append(old[1]); art_rows.append(old[2]); hash_rows.append(old[3])
        elif candidates:
            todo.append((key, candidates))
    print(f"{len(cards)} cards, {len(keys)} kept from the previous index, {len(todo)} to fetch")

    ready: queue.Queue = queue.Queue(maxsize=256)
    missing = []

    def work(item):
        key, candidates = item
        got = fetcher.first(candidates)
        if not got:
            missing.append(key)
            return
        url, image = got
        parts = regions(image)
        ready.put((key, url, tensor(parts["full"]), tensor(parts["art"]),
                   np.frombuffer(dhash(parts["full"]) + dhash(parts["art"]), dtype=np.uint8).reshape(2, 32)))

    def produce():
        with ThreadPoolExecutor(args.workers) as pool:
            list(pool.map(work, todo))
        ready.put(None)

    threading.Thread(target=produce, daemon=True).start()
    started = time.time()
    done = 0
    batch = []

    def flush():
        nonlocal done
        if not batch:
            return
        pixels = np.stack([b[2] for b in batch] + [b[3] for b in batch])
        vectors = session.run(None, {"pixels": pixels})[0].astype(np.float16)
        n = len(batch)
        for i, b in enumerate(batch):
            keys.append(b[0]); urls.append(b[1]); full_rows.append(vectors[i]); art_rows.append(vectors[n + i]); hash_rows.append(b[4])
        done += n
        batch.clear()
        if done % 1024 < n:
            rate = done / max(1e-6, time.time() - started)
            print(f"{done}/{len(todo)} embedded, {rate:.1f}/s, {len(missing)} without image", flush=True)

    while True:
        item = ready.get()
        if item is None:
            break
        batch.append(item)
        if len(batch) >= args.batch:
            flush()
    flush()

    args.out.mkdir(parents=True, exist_ok=True)
    order = np.argsort(np.array(keys, dtype=object), kind="stable") if keys else []
    (args.out / "keys.json").write_text(json.dumps({
        "model": args.model.name, "dim": dim, "built_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "keys": [keys[i] for i in order], "urls": [urls[i] for i in order], "missing": sorted(missing),
    }, ensure_ascii=False), encoding="utf-8")
    np.stack([full_rows[i] for i in order]).astype(np.float16).tofile(args.out / "full.f16")
    np.stack([art_rows[i] for i in order]).astype(np.float16).tofile(args.out / "art.f16")
    np.stack([hash_rows[i] for i in order]).astype(np.uint8).tofile(args.out / "dhash.bin")
    print(f"index: {len(keys)} cards, {len(missing)} without an image, official requests {fetcher.official_used}, {time.time() - started:.0f} s")


if __name__ == "__main__":
    main()
