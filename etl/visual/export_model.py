#!/usr/bin/env python3
"""Export the image model used by the visual fallback of the scanner to ONNX.

The model is DINOv2 small (facebook/dinov2-small, Apache-2.0): a 22M-parameter vision
transformer whose features are good at telling one picture from another (instance retrieval).
It is exported once with a fixed 224x224 input, quantized to int8 so the phone downloads about
a quarter of the weights, and its output is one L2-normalised vector per image: the class token
concatenated with the mean of the patch tokens.

Needs torch, transformers, onnx and onnxruntime; run in GitHub Actions (Hugging Face is not
reachable from every environment).

Usage: python3 etl/visual/export_model.py --out web/vendor/visual/dinov2s-int8.onnx
"""
import argparse
import os
from pathlib import Path

import torch
from transformers import Dinov2Model

MODEL = "facebook/dinov2-small"
REVISION = os.environ.get("DINOV2_REVISION", "main")


class Embedder(torch.nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, pixels):
        hidden = self.model(pixel_values=pixels).last_hidden_state  # [B, 1+256, 384]
        cls = hidden[:, 0]
        patches = hidden[:, 1:].mean(dim=1)
        cls = cls / cls.norm(dim=1, keepdim=True)
        patches = patches / patches.norm(dim=1, keepdim=True)
        return torch.cat([cls, patches], dim=1)  # [B, 768]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--fp32", type=Path, help="also keep the float model here")
    args = ap.parse_args()
    model = Dinov2Model.from_pretrained(MODEL, revision=REVISION).eval()
    wrapper = Embedder(model).eval()
    fp32 = args.fp32 or args.out.with_suffix(".fp32.onnx")
    fp32.parent.mkdir(parents=True, exist_ok=True)
    dummy = torch.zeros(1, 3, 224, 224)
    torch.onnx.export(
        wrapper, dummy, str(fp32), input_names=["pixels"], output_names=["embedding"],
        dynamic_axes={"pixels": {0: "batch"}, "embedding": {0: "batch"}}, opset_version=17, dynamo=False,
    )
    from onnxruntime.quantization import QuantType, quantize_dynamic
    args.out.parent.mkdir(parents=True, exist_ok=True)
    quantize_dynamic(str(fp32), str(args.out), weight_type=QuantType.QUInt8)
    print(f"{fp32}: {fp32.stat().st_size / 1e6:.1f} MB; {args.out}: {args.out.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
