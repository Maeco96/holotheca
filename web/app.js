// Phase 0 test page for the PWA route. No card data is read or stored.
const VERSION = "0.1.0";
const $ = (id) => document.getElementById(id);

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

// Offline support: the service worker caches the app shell.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => { $("offline").textContent = "yes, works without network after one visit"; })
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
  } catch (e) {
    $("camera").textContent = "failed";
    showError(`${e.name}: ${e.message}`);
    $("start").disabled = false;
  }
}

$("start").addEventListener("click", startCamera);
