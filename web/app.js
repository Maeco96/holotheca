// Scanner test page: camera, text reading (PaddleOCR, on the phone) and catalogue matching.
// Nothing is stored or uploaded; the captured frame stays in memory on the device.
const VERSION = "0.7.0";
const $ = (id) => document.getElementById(id);

const OCR_MAX_WIDTH = 1280; // captured card is scaled down to this width before reading
const FRAME_MARGIN = 0.03; // extra area captured around the guide frame, as a share of its size

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

function absolute(path) {
  return new URL(path, document.baseURI).href;
}

// Offline support: the service worker caches the app shell, the OCR files and the card index.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => { $("offline").textContent = "app shell yes; OCR files and card index after the first read"; })
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
let track = null;
let torchOn = false;
let lensChosenByUser = false;

async function applyAdvanced(constraint) {
  try {
    await track.applyConstraints({ advanced: [constraint] });
    return true;
  } catch (e) {
    showError(`${Object.keys(constraint)[0]}: ${e.name} ${e.message}`);
    return false;
  }
}

/**
 * Picks the plain wide back camera when the phone lists several. The combined "dual" or
 * "triple" cameras switch lens on their own when the card is close, which changes the picture
 * mid-scan; ultra wide and telephoto are worse for a card at arm's length.
 */
function preferredLens(devices) {
  const back = devices.filter((d) => !/front|anteriore|frontale|facetime|user/i.test(d.label));
  const plain = back.filter(
    (d) => d.label && !/ultra|tele|dual|doppia|triple|tripla|wide|grandangol|macro|lidar|depth|profondit/i.test(d.label)
  );
  return plain.length === 1 ? plain[0] : null;
}

/** Shows only the controls this browser actually exposes for the running camera track. */
async function setupControls() {
  const caps = track.getCapabilities ? track.getCapabilities() : {};
  let s = track.getSettings();
  $("controls").hidden = false;

  if (caps.zoom && typeof caps.zoom.max === "number") {
    const z = $("zoom");
    z.min = caps.zoom.min; z.max = Math.min(caps.zoom.max, 6); z.step = caps.zoom.step || 0.1;
    // A little zoom lets the phone stay about 20 cm away, where the main lens focuses well.
    const wanted = Math.min(Math.max(2, caps.zoom.min), caps.zoom.max);
    if (!s.zoom || s.zoom < wanted) {
      await applyAdvanced({ zoom: wanted });
      s = track.getSettings();
    }
    z.value = s.zoom || wanted;
    $("zoomVal").textContent = Number(z.value).toFixed(1) + "x";
    $("zoomRow").hidden = false;
    z.oninput = async () => {
      $("zoomVal").textContent = Number(z.value).toFixed(1) + "x";
      await applyAdvanced({ zoom: Number(z.value) });
    };
  } else {
    $("zoomRow").hidden = true;
  }

  if (caps.focusMode && caps.focusMode.length) {
    const f = $("focus");
    f.innerHTML = "";
    for (const mode of caps.focusMode) f.add(new Option(mode, mode));
    if (caps.focusMode.includes("continuous") && s.focusMode !== "continuous") {
      await applyAdvanced({ focusMode: "continuous" });
    }
    f.value = track.getSettings().focusMode || caps.focusMode[0];
    f.onchange = () => applyAdvanced({ focusMode: f.value });
    $("focusRow").hidden = false;
  } else {
    $("focusRow").hidden = true;
  }

  if ("torch" in caps) {
    torchOn = false;
    $("torch").textContent = "Torch (flash light): off";
    $("torch").hidden = false;
    $("torch").onclick = async () => {
      if (await applyAdvanced({ torch: !torchOn })) {
        torchOn = !torchOn;
        $("torch").textContent = `Torch (flash light): ${torchOn ? "on" : "off"}`;
      }
    };
  } else {
    $("torch").hidden = true;
  }

  const exposed = Object.keys(caps).sort().join(", ") || "none";
  const zoom = s.zoom ? `, zoom ${Number(s.zoom).toFixed(1)}x` : "";
  $("camera").textContent =
    `${s.width}x${s.height}${zoom}, ${track.label || "camera"}; exposed controls: ${exposed}`;
}

async function openStream(deviceId) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  const video = {
    width: { ideal: 3840 },
    height: { ideal: 2160 },
    ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
  };
  stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
  const el = $("video");
  el.srcObject = stream;
  await el.play();
  track = stream.getVideoTracks()[0];
}

async function startCamera(deviceId) {
  $("start").disabled = true;
  $("error").hidden = true;
  try {
    await openStream(deviceId);
    // Labels and the full lens list only appear once the camera permission is granted.
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    if (!deviceId && !lensChosenByUser) {
      const better = preferredLens(devices);
      if (better && better.deviceId !== track.getSettings().deviceId) await openStream(better.deviceId);
    }
    const lens = $("lens");
    lens.innerHTML = "";
    for (const d of devices) lens.add(new Option(d.label || "camera", d.deviceId));
    lens.value = track.getSettings().deviceId || "";
    lens.onchange = () => { lensChosenByUser = true; startCamera(lens.value); };
    await setupControls();
    $("start").textContent = "Camera running";
    $("read").disabled = false;
  } catch (e) {
    $("camera").textContent = "failed";
    showError(`${e.name}: ${e.message}`);
    $("start").disabled = false;
  }
}

// ---------- Capture ----------

/** Guide frame rectangle (plus a small margin) in video pixels; accounts for object-fit: cover. */
function frameRectInVideo() {
  const video = $("video");
  const vr = video.getBoundingClientRect();
  const fr = $("frame").getBoundingClientRect();
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const scale = Math.max(vr.width / vw, vr.height / vh);
  const offsetX = (vr.width - vw * scale) / 2;
  const offsetY = (vr.height - vh * scale) / 2;
  const mx = fr.width * FRAME_MARGIN;
  const my = fr.height * FRAME_MARGIN;
  const x0 = Math.max(0, (fr.left - mx - vr.left - offsetX) / scale);
  const y0 = Math.max(0, (fr.top - my - vr.top - offsetY) / scale);
  const x1 = Math.min(vw, (fr.right + mx - vr.left - offsetX) / scale);
  const y1 = Math.min(vh, (fr.bottom + my - vr.top - offsetY) / scale);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

function grabFrame() {
  const video = $("video");
  const r = frameRectInVideo();
  const scale = Math.min(1, OCR_MAX_WIDTH / r.w);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(r.w * scale);
  canvas.height = Math.round(r.h * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(video, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
  canvas.sourceWidth = Math.round(r.w);
  return canvas;
}

/** Sharpness as the mean squared difference between neighbouring pixels of a small grey copy. */
function sharpness(canvas) {
  const w = 256;
  const h = Math.round((canvas.height / canvas.width) * w);
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  let sum = 0;
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      const g = d[i] + d[i + 1] + d[i + 2];
      const right = d[i + 4] + d[i + 5] + d[i + 6];
      const below = d[i + w * 4] + d[i + w * 4 + 1] + d[i + w * 4 + 2];
      sum += (g - right) * (g - right) + (g - below) * (g - below);
    }
  }
  return sum / (w * h);
}

/** Takes a few frames a moment apart and keeps the sharpest: hands shake and focus hunts. */
async function captureSharpest(count = 5, gapMs = 110) {
  let best = null;
  let bestScore = -1;
  for (let i = 0; i < count; i++) {
    const frame = grabFrame();
    const score = sharpness(frame);
    if (score > bestScore) { best = frame; bestScore = score; }
    if (i < count - 1) await new Promise((resolve) => setTimeout(resolve, gapMs));
  }
  best.sharpness = Math.round(bestScore);
  return best;
}

// ---------- Text reading and catalogue ----------

let enginePromise = null;
let indexPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = resolve;
    el.onerror = () => reject(new Error(`could not load ${src}`));
    document.head.appendChild(el);
  });
}

/** Loads the reader (about 40 MB, once; cached for offline use afterwards). */
function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      $("ocrStatus").textContent = "Loading the reader (about 40 MB the first time)…";
      await loadScript(absolute("vendor/ppocr/ppocr.js"));
      const { Ocr, ort } = window.ScriniumOcr;
      ort.env.wasm.wasmPaths = absolute("vendor/ppocr/");
      ort.env.wasm.numThreads = 1; // threads need cross-origin isolation, which GitHub Pages lacks
      return Ocr.create({
        models: {
          detectionPath: absolute("vendor/ppocr/models/ch_PP-OCRv4_det_infer.onnx"),
          recognitionPath: absolute("vendor/ppocr/models/ch_PP-OCRv4_rec_infer.onnx"),
          dictionaryPath: absolute("vendor/ppocr/models/ppocr_keys_v1.txt"),
        },
      });
    })().catch((e) => { enginePromise = null; throw e; });
  }
  return enginePromise;
}

/** Loads the card index built from the catalogue. Missing index: reading still works, matching does not. */
function getIndex() {
  if (!indexPromise) {
    indexPromise = fetch(absolute("data/scan-index.json"))
      .then((response) => {
        if (!response.ok) throw new Error(`card index: HTTP ${response.status}`);
        return response.json();
      })
      .then((raw) => {
        $("catalogue").textContent =
          `${raw.cards.length} cards, ${raw.sets.length} sets (TCGdex ${String(raw.tcgdex_revision || "?").slice(0, 8)})`;
        return ScriniumRecognize.prepareIndex(raw);
      })
      .catch((e) => {
        $("catalogue").textContent = `not available (${e.message})`;
        return null;
      });
  }
  return indexPromise;
}

/** Reads every text line on the card image and ranks catalogue cards against it. */
async function recognizeCanvas(canvas) {
  const [engine, index] = await Promise.all([getEngine(), getIndex()]);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const t0 = performance.now();
  const result = await engine.detect({ data: image.data, width: image.width, height: image.height });
  const readMs = Math.round(performance.now() - t0);
  const width = result.resizedImageWidth || canvas.width;
  const height = result.resizedImageHeight || canvas.height;
  const reading = ScriniumRecognize.parse(result.texts, width, height);
  const t1 = performance.now();
  const candidates = index ? ScriniumRecognize.match(index, reading, 5) : [];
  return { reading, candidates, readMs, matchMs: Math.round(performance.now() - t1), width, height };
}

// ---------- Result display ----------

function drawResult(canvas, outcome) {
  const target = $("cardCanvas");
  target.width = canvas.width;
  target.height = canvas.height;
  const ctx = target.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  ctx.lineWidth = Math.max(2, canvas.width / 400);
  ctx.strokeStyle = "#00e0ff";
  for (const line of outcome.reading.lines) {
    ctx.strokeRect(line.x * canvas.width, line.y * canvas.height, line.w * canvas.width, line.h * canvas.height);
  }
}

function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

function showOutcome(canvas, outcome) {
  drawResult(canvas, outcome);
  const { reading, candidates } = outcome;
  $("cardMeta").textContent =
    `Read at ${canvas.width}x${canvas.height} px (camera area ${canvas.sourceWidth || canvas.width} px wide, ` +
    `sharpness ${canvas.sharpness ?? "n/a"}) · reading ${outcome.readMs} ms · matching ${outcome.matchMs} ms`;

  const numbers = reading.numbers.map((n) => `${n.number}/${n.total}`).join(", ");
  const loose = reading.looseNumbers.join(", ");
  $("readingOut").textContent =
    `top lines: ${reading.nameCandidates.map((c) => c.text).join(" | ") || "(none)"}\n` +
    `HP: ${reading.hp ?? "(none)"}\n` +
    `number: ${numbers || "(none)"}${loose ? `  bare: ${loose}` : ""}\n` +
    `bottom text: ${reading.bottomText || "(none)"}`;

  const list = $("candidates");
  list.innerHTML = "";
  if (!candidates.length) {
    list.appendChild(element("li", "note", "No catalogue card matches this reading."));
  }
  candidates.forEach((c, i) => {
    const li = element("li", i === 0 ? "candidate best" : "candidate");
    li.appendChild(element("div", "title", `${c.name}  ·  ${c.number}/${c.official ?? "?"}`));
    li.appendChild(element("div", "meta",
      `${c.setName} (${c.setCode || c.setId})${c.hp ? ` · HP ${c.hp}` : ""} · score ${Math.round(c.score * 100)}%`));
    li.appendChild(element("div", "meta", `matched on: ${c.evidence.join(", ") || "nothing"}`));
    list.appendChild(li);
  });
  const best = candidates[0];
  const second = candidates[1];
  $("verdict").textContent = !best
    ? "Not recognised."
    : best.score >= 0.75 && (!second || best.score - second.score >= 0.15)
      ? "Confident match. Check it is the right card."
      : "Unsure: pick the right card from the list, or read again.";

  $("allLines").textContent = reading.lines
    .map((line) => `${line.text}  (${Math.round(line.confidence * 100)}%)`)
    .join("\n");
}

async function captureAndRead() {
  $("read").disabled = true;
  $("error").hidden = true;
  try {
    $("ocrStatus").textContent = "Capturing…";
    const card = await captureSharpest();
    $("ocrStatus").textContent = "Reading…";
    const outcome = await recognizeCanvas(card);
    showOutcome(card, outcome);
    $("ocrStatus").textContent = "Done.";
  } catch (e) {
    $("ocrStatus").textContent = "Failed";
    showError(`${e.name}: ${e.message}`);
  } finally {
    $("read").disabled = false;
  }
}

$("start").addEventListener("click", () => startCamera());
$("read").addEventListener("click", captureAndRead);

// Hook used by automated checks.
window.scriniumTest = { recognizeCanvas, showOutcome, preferredLens, sharpness };
