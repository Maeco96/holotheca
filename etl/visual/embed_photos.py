#!/usr/bin/env python3
"""Vectors of labelled phone photos, to measure the visual index without the photos.

Reads a scan log exported from the app (Altro > Registro delle letture) and writes, for every
reading with a known card, the model vectors and hashes of the photo cut in two ways: the
guide frame (trim) and the card edges found in the picture (find). The output holds numbers
only, no pixels, so it can sit in the repository; the log itself must not.

Usage: python3 etl/visual/embed_photos.py holotheca-letture.json --model dinov2s-int8.onnx \
         --out etl/visual/probe/photos.json [--labels labels.json]
"""
from __future__ import annotations

import argparse
import base64
import io
import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import dhash, find_card, regions, tensor, trim_capture  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("log", type=Path)
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--labels", type=Path, help='{"reading id": "card key" or "skip"}')
    args = ap.parse_args()
    log = json.loads(args.log.read_text(encoding="utf-8"))
    labels = json.loads(args.labels.read_text(encoding="utf-8")) if args.labels else {}
    session = ort.InferenceSession(str(args.model), providers=["CPUExecutionProvider"])
    out = []
    for r in log["readings"]:
        label = labels.get(str(r["id"]), r.get("chosen"))
        if not label or label in ("none", "skip") or not r.get("photo"):
            continue
        photo = Image.open(io.BytesIO(base64.b64decode(r["photo"].split(",", 1)[1]))).convert("RGB")
        entry = {"id": str(r["id"]), "label": label, "variants": {}}
        for name, cut in (("trim", trim_capture(photo)), ("find", find_card(photo))):
            parts = regions(cut)
            vec = session.run(None, {"pixels": np.stack([tensor(parts["full"]), tensor(parts["art"])])})[0]
            entry["variants"][name] = {
                "full": [round(float(v), 5) for v in vec[0]], "art": [round(float(v), 5) for v in vec[1]],
                "dhash": [dhash(parts["full"]).hex(), dhash(parts["art"]).hex()],
            }
        out.append(entry)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({"model": args.model.name, "photos": out}), encoding="utf-8")
    print(f"{len(out)} labelled photos -> {args.out}")


if __name__ == "__main__":
    main()
