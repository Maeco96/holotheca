#!/usr/bin/env python3
"""Measure the visual index on labelled photos (embed_photos.py output).

For each way of cutting the photo and each way of comparing (model vector of the whole card,
of the artwork, both; difference hash) this reports where the right card ranks among all the
cards of the index. Cards that share the right card's image exactly (reprints with the same
artwork, such as basic Energy) count as right, because no picture can tell them apart.

Usage: python3 etl/visual/evaluate.py build/visual etl/visual/probe/photos.json --out report.md
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

POPCOUNT = np.array([bin(i).count("1") for i in range(256)], dtype=np.uint8)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("index", type=Path)
    ap.add_argument("photos", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    meta = json.loads((args.index / "keys.json").read_text(encoding="utf-8"))
    dim = meta["dim"]
    keys = meta["keys"]
    pos = {k: i for i, k in enumerate(keys)}
    full = np.fromfile(args.index / "full.f16", dtype=np.float16).reshape(-1, dim).astype(np.float32)
    art = np.fromfile(args.index / "art.f16", dtype=np.float16).reshape(-1, dim).astype(np.float32)
    hashes = np.fromfile(args.index / "dhash.bin", dtype=np.uint8).reshape(-1, 2, 32)
    half = dim // 2
    photos = json.loads(args.photos.read_text(encoding="utf-8"))["photos"]

    def same_image(i: int) -> set[int]:
        """Cards whose stored vectors equal card i's (identical image)."""
        d = np.abs(full - full[i]).max(axis=1)
        return set(np.nonzero(d < 1e-3)[0].tolist())

    methods = {
        "full cls": lambda v: full[:, :half] @ np.array(v["full"][:half]),
        "full mean": lambda v: full[:, half:] @ np.array(v["full"][half:]),
        "full both": lambda v: full @ np.array(v["full"]),
        "art both": lambda v: art @ np.array(v["art"]),
        "full+art": lambda v: full @ np.array(v["full"]) + art @ np.array(v["art"]),
        "dhash full": lambda v: -POPCOUNT[hashes[:, 0] ^ np.frombuffer(bytes.fromhex(v["dhash"][0]), dtype=np.uint8)].sum(axis=1).astype(np.float32),
        "dhash art": lambda v: -POPCOUNT[hashes[:, 1] ^ np.frombuffer(bytes.fromhex(v["dhash"][1]), dtype=np.uint8)].sum(axis=1).astype(np.float32),
    }
    lines = [f"# Visual index probe", "", f"Index: {len(keys)} cards ({meta.get('model')}, built {meta.get('built_at')}); "
             f"{len(meta.get('missing', []))} cards without an image. Photos: {len(photos)}.", ""]
    variants = sorted({name for p in photos for name in p["variants"]})
    summary = []
    detail = []
    for variant in variants:
        for method, score in methods.items():
            ranks = []
            for p in photos:
                if p["label"] not in pos:
                    ranks.append(None)
                    continue
                s = score(p["variants"][variant])
                truth = same_image(pos[p["label"]])
                best_truth = max(s[i] for i in truth)
                rank = int((s > best_truth).sum()) + 1
                order = np.argsort(-s)[:3]
                gap = float(s[order[0]] - s[order[1]])
                ranks.append(rank)
                detail.append(f"| {variant} | {method} | {p['id']} | {p['label']} | {rank} | {keys[order[0]]} {s[order[0]]:.3f} | {keys[order[1]]} {s[order[1]]:.3f} | {gap:.3f} |")
            known = [r for r in ranks if r is not None]
            summary.append(f"| {variant} | {method} | {sum(r == 1 for r in known)}/{len(known)} | {sum(r <= 5 for r in known)}/{len(known)} | {sum(r <= 20 for r in known)}/{len(known)} | {', '.join(str(r) for r in ranks)} |")
    lines += ["| cut | compare | top-1 | top-5 | top-20 | ranks |", "|---|---|---|---|---|---|", *summary, "",
              "| cut | compare | photo | right card | rank | first | second | gap |", "|---|---|---|---|---|---|---|---|", *detail, ""]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines[:5 + len(summary) + 3]))


if __name__ == "__main__":
    main()
