// Phase 0 test page for the PWA route: camera, install, offline and an OCR read test.
// Nothing is stored or uploaded; the captured frame stays in memory on the device.
const VERSION = "0.4.0";
const $ = (id) => document.getElementById(id);

// Card size in mm; the guide frame uses the same ratio.
const CARD_RATIO = 63 / 88;

// Where to look on the card, as fractions of the card rectangle inside the guide frame.
// Names sit top-left; the collector number and set code sit on the bottom strip.
const NUMBER_WHITELIST = "0123456789/ABCDEFGHIJKLMNOPQRSTUVWXYZ-";
const REGIONS = {
  // Name and HP share the top strip on every era; it is cut at the full card width.
  name: { x: 0.0, y: 0.0, w: 1.0, h: 0.14, psm: "7", whitelist: "" },
};
// The number sits bottom-left on modern cards and bottom-right on older ones, on a thin line
// between other text. Thin overlapping strips (left and right halves) are read one by one and
// the first NNN/NNN wins.
const NUMBER_REGIONS = [];
for (let y = 0.84; y < 0.96; y += 0.015) {
  for (const x of [0.0, 0.45]) {
    const key = `n${y.toFixed(3)}_${x}`;
    REGIONS[key] = { x, y, w: 0.55, h: 0.045, psm: "7", whitelist: NUMBER_WHITELIST };
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

/** Grayscale, upscale small strips and stretch contrast between the 2nd and 98th percentile. */
function preprocess(source, minHeight = 120, binarize = false) {
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
    const out = binarize ? (gray > 127 ? 255 : 0) : gray;
    d[i] = d[i + 1] = d[i + 2] = out;
    d[i + 3] = 255;
  }
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
  const prepared = preprocess(canvas, 120, binarize);
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

    // Name: grayscale and black/white attempts, keep the more confident one.
    const nameCrop = cropRegion(card, REGIONS.name);
    const nameTries = [await readCanvas(nameCrop, "name", false), await readCanvas(nameCrop, "name", true)];
    const name = nameTries.reduce((best, t) => (t.confidence > best.confidence ? t : best));
    draw("nameCanvas", name.prepared);
    const hp = (name.text.match(/HP\s*(\d{2,3})/i) || name.text.match(/(\d{2,3})\s*HP/i) || [])[1];
    const nameOnly = name.text.replace(/\s*(HP\s*)?\d{2,3}.*$/i, "").replace(/[^\p{L}\p{N}' .:-]+$/u, "").trim();
    $("nameOut").textContent = `name: ${nameOnly || name.text || "(nothing read)"}${hp ? `\nHP: ${hp}` : ""}`;
    $("nameOut").style.whiteSpace = "pre-wrap";
    $("nameMeta").textContent =
      `confidence ${name.confidence}% · ${nameTries.map((t) => t.ms).join("+")} ms`;

    // Number: each strip, grayscale then black/white, stop at the first NNN/NNN.
    const attempts = [];
    let found = null;
    for (const regionName of NUMBER_REGIONS) {
      const crop = cropRegion(card, REGIONS[regionName]);
      for (const binarize of [false, true]) {
        const r = await readCanvas(crop, regionName, binarize);
        attempts.push(`${regionName.slice(1)}${binarize ? " bw" : ""}: ${r.text || "-"}`);
        if (r.number && !found) found = { ...r, regionName };
        if (found) break;
      }
      if (found) break;
    }
    const shown = found || { prepared: preprocess(cropRegion(card, REGIONS[NUMBER_REGIONS[0]])), confidence: 0, ms: 0 };
    draw("numberCanvas", shown.prepared);
    $("numberOut").innerHTML = "";
    const line = document.createElement("div");
    line.textContent = attempts.join("\n");
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
