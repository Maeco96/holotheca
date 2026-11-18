// Visual fallback of the scanner: compares the photo with a picture of every catalogue card.
// The image model (DINOv2 small, int8, web/vendor/visual) turns a picture into a vector; the
// visual index (data/visual-index.*, built by etl/visual in GitHub Actions) holds the vector of
// one reference image per card. Preparation repeats etl/visual/common.py: keep them in step.
const HolothecaVisual = (() => {
  "use strict";

  const SIZE = 224;
  const MEAN = [0.485, 0.456, 0.406];
  const STD = [0.229, 0.224, 0.225];
  const ART = [0.08, 0.10, 0.92, 0.52];
  const FRAME_MARGIN = 0.03;

  let session = null;
  let index = null; // { keys, dim, rows: Int8Array, scales: Float32Array, pos: Map }
  let loading = null;

  function canvasOf(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }

  function cut(source, x, y, w, h) {
    const c = canvasOf(w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(source, x, y, w, h, 0, 0, c.width, c.height);
    return c;
  }

  function trimCapture(photo) {
    const share = FRAME_MARGIN / (1 + 2 * FRAME_MARGIN);
    return cut(photo, share * photo.width, share * photo.height, photo.width * (1 - 2 * share), photo.height * (1 - 2 * share));
  }

  /** Tightens a capture to the card edges (strongest brightness jump near each side). */
  function findCard(photo) {
    const w = 256;
    const h = Math.round((256 * photo.height) / photo.width);
    const scaled = canvasOf(w, h);
    const sctx = scaled.getContext("2d", { willReadFrequently: true });
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(photo, 0, 0, w, h);
    const d = sctx.getImageData(0, 0, w, h).data;
    const cols = new Float32Array(w);
    const rows = new Float32Array(h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        cols[x] += g / h;
        rows[y] += g / w;
      }
    }
    const edge = (profile, start, stop, step) => {
      let best = -Infinity;
      let at = null;
      for (let i = start; step > 0 ? i < stop : i > stop; i += step) {
        const j = i + step;
        if (j < 0 || j >= profile.length) continue;
        const diff = profile[j] - profile[i];
        if (diff > best) { best = diff; at = j; }
      }
      return best > 12 ? at : null;
    };
    const bw = Math.floor(w * 0.12);
    const bh = Math.floor(h * 0.12);
    const left = edge(cols, 0, bw, 1);
    const right = edge(cols, w - 1, w - 1 - bw, -1);
    const top = edge(rows, 0, bh, 1);
    const bottom = edge(rows, h - 1, h - 1 - bh, -1);
    if ([left, right, top, bottom].includes(null)) return trimCapture(photo);
    const sx = photo.width / w;
    const sy = photo.height / h;
    const box = [left * sx, top * sy, (right + 1) * sx, (bottom + 1) * sy];
    if (box[2] - box[0] < 0.75 * photo.width || box[3] - box[1] < 0.75 * photo.height) return trimCapture(photo);
    return cut(photo, box[0], box[1], box[2] - box[0], box[3] - box[1]);
  }

  /** Model input for one region of the card: squashed to 224x224, ImageNet normalisation. */
  function tensorInto(out, offset, card, region) {
    const [l, t, r, b] = region;
    const x = l * card.width;
    const y = t * card.height;
    const square = cut(card, x, y, (r - l) * card.width, (b - t) * card.height);
    const scaled = canvasOf(SIZE, SIZE);
    const ctx = scaled.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(square, 0, 0, SIZE, SIZE);
    const d = ctx.getImageData(0, 0, SIZE, SIZE).data;
    const plane = SIZE * SIZE;
    for (let i = 0; i < plane; i++) {
      for (let c = 0; c < 3; c++) out[offset + c * plane + i] = (d[i * 4 + c] / 255 - MEAN[c]) / STD[c];
    }
  }

  /** Loads the model and the index once. `ort` comes from the reader bundle. */
  function load(ort, absolute) {
    if (!loading) {
      loading = (async () => {
        const [meta, rows] = await Promise.all([
          fetch(absolute("data/visual-index.json")).then((r) => { if (!r.ok) throw new Error(`indice visivo: HTTP ${r.status}`); return r.json(); }),
          fetch(absolute("data/visual-index.bin")).then((r) => { if (!r.ok) throw new Error(`indice visivo: HTTP ${r.status}`); return r.arrayBuffer(); }),
        ]);
        const n = meta.keys.length;
        const dim = meta.dim;
        index = {
          keys: meta.keys, dim, method: meta.method,
          rows: new Int8Array(rows, 0, n * dim),
          scales: new Float32Array(rows.slice(n * dim, n * dim + n * 4)),
          pos: new Map(meta.keys.map((k, i) => [k, i])),
          mean: meta.mean ? Float32Array.from(meta.mean) : null,
          basis: meta.basis ? Float32Array.from(meta.basis) : null, // [dim x source dim], row-major
        };
        session = await ort.InferenceSession.create(absolute("vendor/visual/dinov2s-int8.onnx"), { executionProviders: ["wasm"] });
        return true;
      })().catch((e) => { loading = null; throw e; });
    }
    return loading;
  }

  /** Query vector of a photo in the space of the index. */
  async function embed(ort, photo) {
    const card = findCard(photo);
    const plane = 3 * SIZE * SIZE;
    const input = new Float32Array(2 * plane);
    tensorInto(input, 0, card, [0, 0, 1, 1]);
    tensorInto(input, plane, card, ART);
    const result = await session.run({ pixels: new ort.Tensor("float32", input, [2, 3, SIZE, SIZE]) });
    const out = result.embedding.data;
    const half = out.length / 2;
    const quarter = half / 2;
    // Each half is [class token | mean of patches]; "fullcls" and "artcls" are the class tokens alone.
    const parts = {
      full: out.subarray(0, half), art: out.subarray(half),
      fullcls: out.subarray(0, quarter), artcls: out.subarray(half, half + quarter),
    };
    // The index says which parts make its vector (for example "full+art"), then an optional
    // projection to fewer dimensions.
    const pieces = index.method.split("+").map((name) => parts[name]);
    let vec = new Float32Array(pieces.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of pieces) { vec.set(p, o); o += p.length; }
    if (index.basis) {
      const src = vec.length;
      const projected = new Float32Array(index.dim);
      for (let r = 0; r < index.dim; r++) {
        let s = 0;
        for (let c = 0; c < src; c++) s += (vec[c] - index.mean[c]) * index.basis[r * src + c];
        projected[r] = s;
      }
      vec = projected;
    }
    let norm = 0;
    for (const v of vec) norm += v * v;
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < vec.length; i++) vec[i] /= norm;
    return { vec, card };
  }

  function similarity(vec, i) {
    const { rows, dim, scales } = index;
    let s = 0;
    const base = i * dim;
    for (let d = 0; d < dim; d++) s += vec[d] * rows[base + d];
    return s * scales[i];
  }

  /** The k most similar cards: [{ key, similarity }]. */
  function search(vec, k = 10) {
    const n = index.keys.length;
    const best = [];
    for (let i = 0; i < n; i++) {
      const s = similarity(vec, i);
      if (best.length < k || s > best[best.length - 1].similarity) {
        best.push({ i, similarity: s });
        best.sort((a, b) => b.similarity - a.similarity);
        if (best.length > k) best.pop();
      }
    }
    return best.map((b) => ({ key: index.keys[b.i], similarity: b.similarity }));
  }

  /** Similarity of the photo to given cards (by key); null for cards the index lacks. */
  function similarityOf(vec, key) {
    const i = index.pos.get(key);
    return i === undefined ? null : similarity(vec, i);
  }

  return { load, embed, search, similarityOf, findCard, ready: () => Boolean(session && index) };
})();
