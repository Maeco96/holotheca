#!/usr/bin/env python3
"""Pack the visual index for the phone: one int8 vector per card, optionally projected.

The vector of a card is made of the parts named by --method ("full", "art" or "full+art"),
optionally projected on the --dims main directions of the catalogue (PCA), normalised, then
stored as int8 with one float scale per card. The page repeats the same steps on the photo
(web/visual.js), using the mean and the projection stored in the JSON file.

Output: <out>.json {keys, dim, method, mean?, basis?} and <out>.bin (int8 [n, dim] then float32 [n]).

Usage: python3 etl/visual/phone_index.py build/visual --method full+art --dims 256 --out web/data/visual-index
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np


def load(directory: Path) -> tuple[dict, dict[str, np.ndarray]]:
    meta = json.loads((directory / "keys.json").read_text(encoding="utf-8"))
    dim = meta["dim"]
    parts = {name: np.fromfile(directory / f"{name}.f16", dtype=np.float16).reshape(-1, dim).astype(np.float32) for name in ("full", "art")}
    return meta, parts


def vectors(parts: dict[str, np.ndarray], method: str) -> np.ndarray:
    return np.concatenate([parts[name] for name in method.split("+")], axis=1)


def fit(x: np.ndarray, dims: int) -> tuple[np.ndarray, np.ndarray]:
    mean = x.mean(axis=0)
    _, _, vt = np.linalg.svd(x - mean, full_matrices=False)
    return mean, vt[:dims]


def project(x: np.ndarray, mean: np.ndarray | None, basis: np.ndarray | None) -> np.ndarray:
    if basis is not None:
        x = (x - mean) @ basis.T
    return x / np.maximum(np.linalg.norm(x, axis=1, keepdims=True), 1e-9)


def quantize(x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    scale = np.maximum(np.abs(x).max(axis=1), 1e-9) / 127.0
    return np.round(x / scale[:, None]).astype(np.int8), scale.astype(np.float32)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("index", type=Path)
    ap.add_argument("--method", default="full+art")
    ap.add_argument("--dims", type=int, default=0, help="PCA dimensions, 0 = keep all")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    meta, parts = load(args.index)
    x = vectors(parts, args.method)
    mean = basis = None
    if args.dims:
        mean, basis = fit(x, args.dims)
    q, scale = quantize(project(x, mean, basis))
    args.out.parent.mkdir(parents=True, exist_ok=True)
    head = {"keys": meta["keys"], "dim": int(q.shape[1]), "method": args.method, "model": meta.get("model"), "built_at": meta.get("built_at")}
    if basis is not None:
        head["mean"] = [round(float(v), 6) for v in mean]
        head["basis"] = [round(float(v), 6) for v in basis.flatten()]
    args.out.with_suffix(".json").write_text(json.dumps(head, separators=(",", ":")), encoding="utf-8")
    with open(args.out.with_suffix(".bin"), "wb") as f:
        f.write(q.tobytes())
        f.write(scale.tobytes())
    print(f"{len(meta['keys'])} cards x {q.shape[1]} -> {args.out}.bin {(q.nbytes + scale.nbytes) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
