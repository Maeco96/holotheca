#!/bin/sh
# Rebuilds web/vendor/ppocr from the pinned npm packages. Run: cd tools/ppocr && npm install && npm run build
set -eu
out=../../web/vendor/ppocr
mkdir -p "$out/models"
aliases=""
for m in path fs fs/promises module worker_threads url os; do
  aliases="$aliases --alias:$m=./empty.js --alias:node:$m=./empty.js"
done
# The wasm-only runtime keeps the bundle small: no WebGPU or WebGL backends.
npx esbuild entry.js --bundle --minify --format=iife --log-level=warning \
  --alias:onnxruntime-web=onnxruntime-web/wasm $aliases --outfile="$out/ppocr.js"
cp node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs "$out/"
models=node_modules/@gutenye/ocr-models/assets
cp "$models/ch_PP-OCRv4_det_infer.onnx" "$models/ch_PP-OCRv4_rec_infer.onnx" "$models/ppocr_keys_v1.txt" "$out/models/"
ls -la "$out" "$out/models"
