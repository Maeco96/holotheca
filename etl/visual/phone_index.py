#!/usr/bin/env python3
"""Pack the visual index for the phone: one int8 vector per card, optionally projected.

The vector of a card is made of the parts named by --method ("full", "art" or "full+art"),
optionally projected on the --dims main directions of the catalogue (PCA), normalised, then
stored as int8 with one float scale per card. The page repeats the same steps on the photo
(web/visual.js), using the mean and the projection stored in the JSON file.

Output: <out>.json {keys, dim, bits, method, mean?, basis?} and <out>.bin: with --bits 8, int8 [n, dim]
then float32 scales [n]; with --bits 1, the sign of every number packed as bits, [n, dim / 8] bytes
(compared by counting equal bits; measured on real photos as good as int8 for the artwork).

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


def part(parts: dict[str, np.ndarray], name: str) -> np.ndarray:
    """A named piece of the stored vectors: "full" and "art" (class token and mean of the
    patches), or only their class token ("fullcls", "artcls")."""
    if name.endswith("cls"):
        x = parts[name[:-3]]
        return x[:, : x.shape[1] // 2]
    return parts[name]


def vectors(parts: dict[str, np.ndarray], method: str) -> np.ndarray:
    return np.concatenate([part(parts, name) for name in method.split("+")], axis=1)


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
    ap.add_argument("--bits", type=int, choices=(1, 8), default=1)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    meta, parts = load(args.index)
    x = vectors(parts, args.method)
    mean = basis = None
    if args.dims:
        mean, basis = fit(x, args.dims)
    x = project(x, mean, basis)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    head = {"keys": meta["keys"], "dim": int(x.shape[1]), "bits": args.bits, "method": args.method, "model": meta.get("model"), "built_at": meta.get("built_at")}
    if basis is not None:
        head["mean"] = [round(float(v), 6) for v in mean]
        head["basis"] = [round(float(v), 6) for v in basis.flatten()]
    if args.bits == 1:
        payload = np.packbits(x > 0, axis=1).tobytes()
    else:
        q, scale = quantize(x)
        payload = q.tobytes() + scale.tobytes()
    args.out.with_suffix(".json").write_text(json.dumps(head, separators=(",", ":")), encoding="utf-8")
    args.out.with_suffix(".bin").write_bytes(payload)
    print(f"{len(meta['keys'])} cards x {x.shape[1]} at {args.bits} bit -> {args.out}.bin {len(payload) / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
