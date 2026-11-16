// Phase 0 test page for the PWA route: camera, install, offline and an OCR read test.
// Nothing is stored or uploaded; the captured frame stays in memory on the device.
const VERSION = "0.5.0";
const $ = (id) => document.getElementById(id);

// Card size in mm; the guide frame uses the same ratio.
const CARD_RATIO = 63 / 88;

// Where to look on the card, as fractions of the card rectangle inside the guide frame.
// Names sit top-left; the collector number and set code sit on the bottom strip.
const NUMBER_WHITELIST = "0123456789/ABCDEFGHIJKLMNOPQRSTUVWXYZ-";
const REGIONS = {
  // Name and HP sit on the top line on every era; they are read separately so the card edge
  // and the energy symbol do not disturb the name.
  name: { x: 0.08, y: 0.015, w: 0.55, h: 0.10, psm: "7", whitelist: "" },
  hp: { x: 0.55, y: 0.015, w: 0.45, h: 0.10, psm: "7", whitelist: "0123456789HP " },
};
// The number sits bottom-left on modern cards and bottom-right on older ones, on a thin line
// between other text. Narrow overlapping windows are read one by one, the first NNN/NNN wins.
const NUMBER_REGIONS = [];
for (let y = 0.86; y < 0.955; y += 0.0125) {
  for (const x of [0.0, 0.15, 0.3, 0.45, 0.6, 0.7]) {
    const key = `n${y.toFixed(4)}_${x}`;
    REGIONS[key] = { x, y, w: 0.3, h: 0.035, psm: "7", whitelist: NUMBER_WHITELIST };
    NUMBER_REGIONS.push(key);
  }
}

$("version").textContent = VERSION;
$("standalone").textContent =
  window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches
    ? "yes"
    : "no (open the Share menu > Add to Home Screen)";

function showError(message) {
  const el = $("error");
  el.textContent = message;
  el.hidden = false;
}

// Offline support: the service worker caches the app shell and the OCR files.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => { $("offline").textContent = "app shell yes; OCR files after the first read"; })
    .catch((e) => { $("offline").textContent = "no (" + e.message + ")"; });
} else {
  $("offline").textContent = "not supported";
}

// Persistent storage: iOS may clear web storage under pressure, so keep exports.
(async () => {
  try {
    const persisted = navigator.storage && navigator.storage.persisted
      ? await navigator.storage.persisted() : null;
    $("storage").textContent =
      persisted === null ? "unknown" : persisted ? "persistent" : "not guaranteed persistent (keep backups)";
  } catch (e) {
    $("storage").textContent = "unknown";
  }
})();

// ---------- Camera ----------

let stream = null;

async function startCamera() {
  $("start").disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 3840 },
        height: { ideal: 2160 },
      },
    });
    const video = $("video");
    video.srcObject = stream;
    await video.play();
    const track = stream.getVideoTracks()[0];
    const s = track.getSettings();
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    const focus = caps.focusMode ? caps.focusMode.join(",") : "not exposed";
    $("camera").textContent = `${s.width}x${s.height}, focus modes: ${focus}`;
    $("start").textContent = "Camera running";
    $("read").disabled = false;
  } catch (e) {
    $("camera").textContent = "failed";
    showError(`${e.name}: ${e.message}`);
    $("start").disabled = false;
  }
}

// ---------- Capture ----------

/** Guide frame rectangle in video pixel coordinates (accounts for object-fit: cover). */
function frameRectInVideo() {
  const video = $("video");
  const vr = video.getBoundingClientRect();
  const fr = $("frame").getBoundingClientRect();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(vr.width / vw, vr.height / vh);
  const offsetX = (vr.width - vw * scale) / 2;
  const offsetY = (vr.height - vh * scale) / 2;
  const x = Math.max(0, (fr.left - vr.left - offsetX) / scale);
  const y = Math.max(0, (fr.top - vr.top - offsetY) / scale);
  const w = Math.min(vw - x, fr.width / scale);
  const h = Math.min(vh - y, fr.height / scale);
  return { x, y, w, h };
}

function captureCard() {
  const video = $("video");
  const r = frameRectInVideo();
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(r.w);
  canvas.height = Math.round(r.h);
  canvas.getContext("2d").drawImage(video, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cropRegion(card, region) {
  const x = Math.round(card.width * region.x);
  const y = Math.round(card.height * region.y);
  const w = Math.round(card.width * region.w);
  const h = Math.round(card.height * region.h);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(card, x, y, w, h, 0, 0, w, h);
  return canvas;
}

/** Black/white by comparing each pixel with the mean of its neighbourhood (copes with glare gradients). */
function adaptiveThreshold(d, w, h) {
  const radius = Math.max(8, Math.round(h / 3));
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += d[(y * w + x) * 4];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row;
    }
  }
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1]
        - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      out[y * w + x] = d[(y * w + x) * 4] < mean * 0.9 ? 0 : 255;
    }
  }
  for (let i = 0; i < out.length; i++) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = out[i];
}

/** Grayscale, upscale small strips and stretch contrast between the 2nd and 98th percentile. */
function preprocess(source, minHeight = 140, binarize = false) {
  const scale = Math.max(1, minHeight / source.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = image.data;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const gray = ((d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000) | 0;
    d[i] = gray;
    histogram[gray]++;
  }
  const total = canvas.width * canvas.height;
  let low = 0;
  let high = 255;
  let seen = 0;
  for (let v = 0; v < 256; v++) {
    seen += histogram[v];
    if (seen >= total * 0.02) { low = v; break; }
  }
  seen = 0;
  for (let v = 255; v >= 0; v--) {
    seen += histogram[v];
    if (seen >= total * 0.02) { high = v; break; }
  }
  const span = Math.max(1, high - low);
  for (let i = 0; i < d.length; i += 4) {
    const gray = Math.max(0, Math.min(255, (((d[i] - low) * 255) / span) | 0));
    d[i] = d[i + 1] = d[i + 2] = gray;
    d[i + 3] = 255;
  }
  if (binarize) adaptiveThreshold(d, canvas.width, canvas.height);
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// ---------- OCR ----------

let workerPromise = null;

function absolute(path) {
  return new URL(path, location.href).href;
}

function getWorker() {
  if (typeof Tesseract === "undefined") {
    throw new Error("OCR library not loaded");
  }
  if (!workerPromise) {
    workerPromise = Tesseract.createWorker("eng", 1, {
      workerPath: absolute("vendor/tesseract/worker.min.js"),
      corePath: absolute("vendor/tesseract/core"),
      langPath: absolute("vendor/tesseract/tessdata"),
      workerBlobURL: false,
      cacheMethod: "none",
      gzip: true,
      logger: (m) => {
        if (m.status && m.status !== "recognizing text") {
          $("ocrStatus").textContent = `${m.status} ${Math.round((m.progress || 0) * 100)}%`;
        }
      },
    }).catch((e) => { workerPromise = null; throw e; });
  }
  return workerPromise;
}

/** Reads one region. Returns the raw text, confidence, time and the parsed number if any. */
async function readCanvas(canvas, regionName, binarize = false) {
  const region = REGIONS[regionName];
  const worker = await getWorker();
  await worker.setParameters({
    tessedit_pageseg_mode: region.psm,
    tessedit_char_whitelist: region.whitelist,
  });
  const prepared = preprocess(canvas, 140, binarize);
  const t0 = performance.now();
  const { data } = await worker.recognize(prepared);
  const ms = Math.round(performance.now() - t0);
  const text = data.text.replace(/\s+/g, " ").trim();
  const match = text.match(/(\d{1,3})\s*\/\s*(\d{1,3})/);
  return {
    text,
    confidence: Math.round(data.confidence),
    ms,
    number: match ? `${match[1]}/${match[2]}` : null,
    prepared,
  };
}

function draw(canvasId, source) {
  const target = $(canvasId);
  target.width = source.width;
  target.height = source.height;
  target.getContext("2d").drawImage(source, 0, 0);
}

/** Draws the OCR strips on the captured card so a wrong crop is visible at once. */
function outlineRegions() {
  const canvas = $("cardCanvas");
  const ctx = canvas.getContext("2d");
  ctx.lineWidth = Math.max(4, canvas.width / 250);
  const boxes = [
    ["#00e0ff", REGIONS.name],
    ["#ff4dd2", REGIONS.hp],
    ["#7dff7d", { x: 0, y: 0.84, w: 1, h: 0.16 }],
  ];
  for (const [color, r] of boxes) {
    ctx.strokeStyle = color;
    ctx.strokeRect(r.x * canvas.width, r.y * canvas.height, r.w * canvas.width, r.h * canvas.height);
  }
}

async function captureAndRead() {
  $("read").disabled = true;
  $("error").hidden = true;
  try {
    const card = captureCard();
    draw("cardCanvas", card);
    $("cardMeta").textContent =
      `Card area captured: ${card.width}x${card.height} px (about ${(card.width / 63).toFixed(1)} px/mm across the card)`;

    $("ocrStatus").textContent = "Reading…";
    outlineRegions();

    // Name and HP: grayscale and black/white attempts, keep the more confident one.
    const best = async (regionName) => {
      const crop = cropRegion(card, REGIONS[regionName]);
      const tries = [await readCanvas(crop, regionName, false), await readCanvas(crop, regionName, true)];
      return tries.reduce((top, t) => (t.confidence > top.confidence ? t : top));
    };
    const name = await best("name");
    const hpRead = await best("hp");
    draw("nameCanvas", name.prepared);
    const hp = (hpRead.text.match(/(\d{2,3})/) || [])[1];
    const nameOnly = name.text.replace(/[^\p{L}\p{N}' .:-]+/gu, " ").replace(/\s+/g, " ").trim();
    $("nameOut").textContent = `name: ${nameOnly || "(nothing read)"}\nHP: ${hp || "(nothing read)"}  [${hpRead.text || "-"}]`;
    $("nameOut").style.whiteSpace = "pre-wrap";
    $("nameMeta").textContent = `confidence name ${name.confidence}% · HP ${hpRead.confidence}%`;

    // Number: each strip, grayscale then black/white, stop at the first NNN/NNN.
    const attempts = [];
    let found = null;
    for (const regionName of NUMBER_REGIONS) {
      const crop = cropRegion(card, REGIONS[regionName]);
      for (const binarize of [false, true]) {
        const r = await readCanvas(crop, regionName, binarize);
        if (r.text) attempts.push(`${regionName.slice(1)}${binarize ? " bw" : ""}: ${r.text}`);
        if (r.number && !found) found = { ...r, regionName };
        if (found) break;
      }
      if (found) break;
    }
    const shown = found || { prepared: preprocess(cropRegion(card, REGIONS[NUMBER_REGIONS[0]])), confidence: 0, ms: 0 };
    draw("numberCanvas", shown.prepared);
    $("numberOut").innerHTML = "";
    const line = document.createElement("div");
    line.textContent = `${attempts.length} reads with text; last: \n` + attempts.slice(-10).join("\n");
    line.style.whiteSpace = "pre-wrap";
    $("numberOut").appendChild(line);
    if (found) {
      const parsed = document.createElement("div");
      parsed.className = "ok";
      parsed.textContent = `collector number found: ${found.number} (${found.regionName})`;
      $("numberOut").appendChild(parsed);
    }
    $("numberMeta").textContent = found ? `confidence ${found.confidence}%` : "no collector number found";
    $("ocrStatus").textContent = "Done. Compare the text above with the card.";
  } catch (e) {
    $("ocrStatus").textContent = "Failed";
    showError(`${e.name}: ${e.message}`);
  } finally {
    $("read").disabled = false;
  }
}

$("start").addEventListener("click", startCamera);
$("read").addEventListener("click", captureAndRead);

// Hook used by automated checks.
window.scriniumTest = { readCanvas, preprocess, REGIONS, NUMBER_REGIONS, CARD_RATIO };
