# Vendored OCR files

Self-hosted so the OCR test works without a CDN and offline after the first visit.

| File | Package | Version | Licence |
| --- | --- | --- | --- |
| `tesseract.min.js`, `worker.min.js` | [tesseract.js](https://www.npmjs.com/package/tesseract.js) | 5.1.1 | Apache-2.0 |
| `core/tesseract-core-simd-lstm.wasm.js` | [tesseract.js-core](https://www.npmjs.com/package/tesseract.js-core) | 5.1.1 | Apache-2.0 |
| `tessdata/eng.traineddata.gz` | [@tesseract.js-data/eng](https://www.npmjs.com/package/@tesseract.js-data/eng) (`4.0.0_best_int`) | 1.0.0 | Apache-2.0 (Tesseract trained data) |

Only the SIMD + LSTM core is included: every iPhone Safari that can run this page supports WebAssembly SIMD.
