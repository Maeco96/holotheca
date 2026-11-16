// Bundled into web/vendor/ppocr/ppocr.js. Exposes the OCR class and the ONNX runtime settings.
import Ocr from "@gutenye/ocr-browser";
import * as ort from "onnxruntime-web";

window.ScriniumOcr = { Ocr, ort };
