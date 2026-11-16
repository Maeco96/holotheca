# Vendored text reader

Self-hosted so the scanner works without a CDN and offline after the first read.
Rebuild with `cd tools/ppocr && npm install && npm run build` (versions are pinned there).

| File | Source | Version | Licence |
| --- | --- | --- | --- |
| `ppocr.js` | bundle of [@gutenye/ocr-browser](https://www.npmjs.com/package/@gutenye/ocr-browser) (PaddleOCR pipeline), [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) (wasm backend), [@techstark/opencv-js](https://www.npmjs.com/package/@techstark/opencv-js), js-clipper | 1.4.9 / 1.31.1 | MIT / MIT / Apache-2.0 / BSL-1.0 |
| `ort-wasm-simd-threaded.wasm`, `.mjs` | [onnxruntime-web](https://www.npmjs.com/package/onnxruntime-web) | 1.31.1 | MIT |
| `models/ch_PP-OCRv4_det_infer.onnx`, `models/ch_PP-OCRv4_rec_infer.onnx`, `models/ppocr_keys_v1.txt` | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) PP-OCRv4 models, as packaged in [@gutenye/ocr-models](https://www.npmjs.com/package/@gutenye/ocr-models) | 1.4.2 | Apache-2.0 |

About 40 MB in total. The models run on the device; no image leaves the phone.
