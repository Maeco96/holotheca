// Camera access for the scanner: picks a lens, exposes the controls the browser really offers,
// and returns the sharpest of a few frames cut to the guide frame.
const Camera = (() => {
  "use strict";

  const MAX_WIDTH = 1280; // captured card is scaled down to this width before reading
  const FRAME_MARGIN = 0.03; // extra area captured around the guide frame, as a share of its size

  let stream = null;
  let track = null;
  let torchOn = false;
  let lensChosenByUser = false;
  let els = null; // { video, frame, lens, zoomRow, torch, onError, onLost }
  const ZOOM_STEPS = [1, 1.5, 2, 3, 5];

  function bind(elements) {
    els = elements;
  }

  function running() {
    return Boolean(track && track.readyState === "live");
  }

  async function applyAdvanced(constraint) {
    try {
      await track.applyConstraints({ advanced: [constraint] });
      return true;
    } catch (e) {
      els.onError(`${Object.keys(constraint)[0]}: ${e.name} ${e.message}`);
      return false;
    }
  }

  /**
   * The plain wide back camera, when the phone lists exactly one. The combined "dual" or
   * "triple" cameras switch lens on their own when the card is close, which changes the
   * picture mid-scan; ultra wide and telephoto are worse for a card at arm's length.
   */
  function preferredLens(devices) {
    const back = devices.filter((d) => !/front|anteriore|frontale|facetime|user/i.test(d.label));
    const plain = back.filter(
      (d) => d.label && !/ultra|tele|dual|doppia|triple|tripla|wide|grandangol|macro|lidar|depth|profondit/i.test(d.label)
    );
    return plain.length === 1 ? plain[0] : null;
  }

  async function open(deviceId) {
    stop();
    const video = {
      width: { ideal: 3840 },
      height: { ideal: 2160 },
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
    };
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
    els.video.srcObject = stream;
    await els.video.play();
    track = stream.getVideoTracks()[0];
    // iOS ends or mutes the camera when the app goes to the background, a call comes in or
    // another app takes the camera; the preview then stays frozen on the last frame.
    const mine = track;
    const lost = () => setTimeout(() => { if (track === mine && els.onLost) els.onLost(); }, 500);
    mine.addEventListener("ended", lost);
    mine.addEventListener("mute", lost);
  }

  /** True when the preview really delivers frames: live, not muted, video playing. */
  function healthy() {
    return running() && !track.muted && !els.video.paused && els.video.readyState >= 2;
  }

  function stop() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    track = null;
    torchOn = false;
  }

  /** Shows only the controls this browser exposes for the running camera. */
  async function setupControls() {
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    let settings = track.getSettings();

    els.zoomRow.innerHTML = "";
    if (caps.zoom && typeof caps.zoom.max === "number") {
      const max = Math.min(caps.zoom.max, 6);
      // A little zoom lets the phone stay about 20 cm away, where the main lens focuses well.
      const wanted = Math.min(Math.max(2, caps.zoom.min), caps.zoom.max);
      if (!settings.zoom || settings.zoom < wanted) {
        await applyAdvanced({ zoom: wanted });
        settings = track.getSettings();
      }
      const current = settings.zoom || wanted;
      const steps = ZOOM_STEPS.filter((z) => z >= caps.zoom.min && z <= max);
      const mark = (value) => {
        for (const b of els.zoomRow.children) b.classList.toggle("on", Math.abs(Number(b.dataset.zoom) - value) < 0.05);
      };
      for (const step of steps) {
        const button = document.createElement("button");
        button.className = "cambtn";
        button.dataset.zoom = String(step);
        button.textContent = `${step}x`;
        button.setAttribute("aria-label", `Zoom ${step}x`);
        button.onclick = async () => { if (await applyAdvanced({ zoom: step })) mark(step); };
        els.zoomRow.appendChild(button);
      }
      mark(current);
      els.zoomRow.hidden = steps.length < 2;
    } else {
      els.zoomRow.hidden = true;
    }

    if (caps.focusMode && caps.focusMode.includes("continuous") && settings.focusMode !== "continuous") {
      await applyAdvanced({ focusMode: "continuous" });
    }

    if ("torch" in caps) {
      els.torch.hidden = false;
      els.torch.classList.remove("on");
      els.torch.onclick = async () => {
        if (await applyAdvanced({ torch: !torchOn })) {
          torchOn = !torchOn;
          els.torch.classList.toggle("on", torchOn);
        }
      };
    } else {
      els.torch.hidden = true;
    }
  }

  /** Starts the camera. Without a device id the app picks the lens itself. */
  async function start(deviceId) {
    await open(deviceId);
    // Labels and the full lens list only appear once the camera permission is granted.
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput");
    if (!deviceId && !lensChosenByUser) {
      const better = preferredLens(devices);
      if (better && better.deviceId !== track.getSettings().deviceId) await open(better.deviceId);
    }
    els.lens.innerHTML = "";
    for (const d of devices) els.lens.add(new Option(d.label || "Fotocamera", d.deviceId));
    els.lens.value = track.getSettings().deviceId || "";
    els.lens.hidden = devices.length < 2;
    els.lens.onchange = () => {
      lensChosenByUser = true;
      start(els.lens.value).catch((e) => els.onError(`${e.name}: ${e.message}`));
    };
    await setupControls();
  }

  /** What the running camera is and which controls the browser exposes, for the diagnostics page. */
  function describe() {
    if (!track) return "non avviata";
    const caps = track.getCapabilities ? track.getCapabilities() : {};
    const s = track.getSettings();
    const zoom = s.zoom ? `, zoom ${Number(s.zoom).toFixed(1)}x` : "";
    return `${s.width}x${s.height}${zoom}, ${track.label || "fotocamera"}; controlli: ${Object.keys(caps).sort().join(", ") || "nessuno"}`;
  }

  /** Guide frame rectangle (plus a small margin) in video pixels; accounts for object-fit: cover. */
  function frameRectInVideo() {
    const vr = els.video.getBoundingClientRect();
    const fr = els.frame.getBoundingClientRect();
    const vw = els.video.videoWidth;
    const vh = els.video.videoHeight;
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
    const r = frameRectInVideo();
    const scale = Math.min(1, MAX_WIDTH / r.w);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(r.w * scale);
    canvas.height = Math.round(r.h * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(els.video, r.x, r.y, r.w, r.h, 0, 0, canvas.width, canvas.height);
    canvas.sourceWidth = Math.round(r.w);
    return canvas;
  }

  /** Sharpness as the mean squared difference between neighbouring pixels of a small copy. */
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

  return { bind, start, stop, running, healthy, describe, captureSharpest, preferredLens, sharpness };
})();
