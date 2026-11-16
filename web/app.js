// Holotheca app shell: views, navigation and the scan flow.
// Reading runs on the device; the collection stays in the browser's storage (see store.js).
const VERSION = "0.8.1";
const $ = (id) => document.getElementById(id);

const VARIANT_LABELS = { normal: "Normale", holo: "Holo", reverse: "Reverse holo", metal: "Metallo", lenticular: "Lenticolare" };
const LANG_LABELS = {
  it: "Italiano", en: "Inglese", fr: "Francese", de: "Tedesco", es: "Spagnolo", pt: "Portoghese",
  "pt-br": "Portoghese (BR)", ja: "Giapponese", ko: "Coreano", "zh-tw": "Cinese trad.", "zh-cn": "Cinese sempl.",
  th: "Thai", id: "Indonesiano", nl: "Olandese", pl: "Polacco", ru: "Russo",
};
const CONDITIONS = ["MT", "NM", "EX", "GD", "LP", "PL", "PO"];
const EVIDENCE_LABELS = {
  name: "nome", "name~": "nome (simile)", "number/total": "numero", "number/total~": "numero (ricostruito)",
  "number/total~~": "numero (incerto)", number: "numero", total: "totale espansione", "total~": "totale (incerto)",
  hp: "PS", "set code": "codice espansione", illustrator: "illustratore",
};

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

function absolute(path) {
  return new URL(path, document.baseURI).href;
}

function euro(value) {
  return value.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}

function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

/** Card artwork that tries each image address in turn and falls back to the card name. */
function art(card, { big = false, quality = "low" } = {}) {
  const box = el("div", { class: big ? "art big" : "art" });
  const placeholder = el("div", { class: "ph", text: card ? card.name : "?" });
  box.appendChild(placeholder);
  if (!card) return box;
  const urls = Catalogue.imageUrls(card, quality);
  let attempt = 0;
  if (!urls.length) return box;
  // The image sits in the box from the start, transparent until loaded: a lazy image that is
  // not in the document is never fetched, which left every card on its placeholder up to 0.8.0.
  const img = el("img", { alt: card.name, loading: "lazy", decoding: "async", class: "loading" });
  img.addEventListener("load", () => { img.classList.remove("loading"); placeholder.remove(); });
  img.addEventListener("error", () => {
    attempt += 1;
    if (attempt < urls.length) img.src = urls[attempt];
  });
  img.src = urls[0];
  box.appendChild(img);
  return box;
}

function cardLine(card) {
  const total = card.set.official ? `/${card.set.official}` : "";
  return `${card.set.name} · ${card.number}${total}`;
}

// ---------- Navigation ----------

const VIEWS = { scrigno: "view-scrigno", scan: "view-scan", search: "view-search", more: "view-more", card: "view-card", guide: "view-guide" };
const ROUTES = { scrigno: "scrigno", scan: "scan", cerca: "search", altro: "more", carta: "card", guida: "guide" };
let cameraWanted = false;

function route() {
  const [, name = "scrigno", ...rest] = location.hash.split("/");
  const view = ROUTES[name] || "scrigno";
  const argument = decodeURIComponent(rest.join("/"));
  for (const [key, id] of Object.entries(VIEWS)) $(id).hidden = key !== view;
  document.querySelectorAll(".tabbar a").forEach((a) => a.classList.toggle("on", a.dataset.tab === (view === "guide" ? "more" : view)));
  const isCard = view === "card" || view === "guide";
  if (view === "guide") $("title").textContent = "Guida";
  $("back").hidden = !isCard;
  $("wordmark").hidden = isCard;
  $("title").hidden = !isCard;
  $("error") && ($("error").hidden = true);

  if (view !== "scan" && Camera.running()) Camera.stop();
  if (view === "scrigno") renderCollection();
  if (view === "scan") enterScan();
  if (view === "search") $("searchInput").focus({ preventScroll: true });
  if (view === "more") renderMore();
  if (view === "card") renderCard(argument);
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
$("back").addEventListener("click", () => (history.length > 1 ? history.back() : (location.hash = "#/scrigno")));

// ---------- Scrigno ----------

let selectedBinder = null;

async function renderCollection() {
  await Catalogue.load();
  const stats = Store.stats(selectedBinder);
  $("statTotal").textContent = stats.total;
  $("statDistinct").textContent = stats.distinct;
  $("statSpent").textContent = stats.spent ? euro(stats.spent) : "–";

  const chips = $("binderChips");
  chips.innerHTML = "";
  const chip = (label, id) =>
    el("button", { class: selectedBinder === id ? "chip on" : "chip", text: label, onclick: () => { selectedBinder = id; renderCollection(); } });
  chips.appendChild(chip("Tutte", null));
  for (const binder of Store.binders()) chips.appendChild(chip(binder.name, binder.id));

  const byCard = new Map();
  for (const copy of Store.copies(selectedBinder)) {
    byCard.set(copy.card_source_id, (byCard.get(copy.card_source_id) || 0) + copy.quantity);
  }
  const grid = $("collectionGrid");
  grid.innerHTML = "";
  const keys = [...byCard.keys()].reverse(); // newest additions first
  for (const key of keys) {
    const card = Catalogue.cardByKey(key);
    grid.appendChild(
      el("button", { class: "tile", onclick: () => { location.hash = `#/carta/${encodeURIComponent(key)}`; } },
        art(card),
        byCard.get(key) > 1 ? el("span", { class: "qty", text: String(byCard.get(key)) }) : null,
        el("div", { class: "cap", text: card ? card.name : key }))
    );
  }
  $("collectionEmpty").hidden = keys.length > 0;
}

// ---------- Scan ----------

let enginePromise = null;
let currentLogId = null; // scan-log entry of the reading on screen

function scanError(message) {
  $("scanError").textContent = message;
  $("scanError").hidden = !message;
}

Camera.bind({
  video: $("video"), frame: $("frame"), lens: $("lens"), zoom: $("zoom"),
  zoomValue: $("zoomVal"), zoomRow: $("zoomRow"), torch: $("torch"), onError: scanError,
});

async function startCamera() {
  scanError("");
  $("startCamera").hidden = true;
  try {
    await Camera.start();
    cameraWanted = true;
    $("shutter").disabled = false;
    $("camPanel").hidden = false;
    $("cameraInfo").textContent = Camera.describe();
  } catch (e) {
    $("startCamera").hidden = false;
    $("shutter").disabled = true;
    scanError(e.name === "NotAllowedError" ? "Permesso fotocamera negato: abilitalo nelle impostazioni di Safari." : `${e.name}: ${e.message}`);
  }
}

function enterScan() {
  // Once the owner has started the camera, coming back to this tab restarts it.
  if (cameraWanted && !Camera.running()) startCamera();
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const node = el("script", { src });
    node.onload = resolve;
    node.onerror = () => reject(new Error(`impossibile caricare ${src}`));
    document.head.appendChild(node);
  });
}

/** Loads the reader (about 40 MB, once; cached for offline use afterwards). */
function getEngine() {
  if (!enginePromise) {
    enginePromise = (async () => {
      $("scanStatus").textContent = "Carico il lettore (circa 40 MB la prima volta)…";
      await loadScript(absolute("vendor/ppocr/ppocr.js"));
      const { Ocr, ort } = window.HolothecaOcr;
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

/** Reads every text line on the card image and ranks catalogue cards against it. */
async function recognizeCanvas(canvas) {
  const [engine, index] = await Promise.all([getEngine(), Catalogue.load()]);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const t0 = performance.now();
  const result = await engine.detect({ data: image.data, width: image.width, height: image.height });
  const readMs = Math.round(performance.now() - t0);
  const width = result.resizedImageWidth || canvas.width;
  const height = result.resizedImageHeight || canvas.height;
  const reading = HolothecaRecognize.parse(result.texts, width, height);
  const candidates = index ? HolothecaRecognize.match(index, reading, 5) : [];
  return { reading, candidates, readMs, matchMs: 0, catalogue: Boolean(index) };
}

function showScan(canvas, outcome) {
  const { reading, candidates } = outcome;
  const best = candidates[0];
  const second = candidates[1];
  const confident = best && best.score >= 0.75 && (!second || best.score - second.score >= 0.15);
  $("verdict").textContent = !outcome.catalogue
    ? "Catalogo non disponibile"
    : !best ? "Carta non riconosciuta" : confident ? "Trovata" : "Quale di queste?";

  // The card in focus is shown large with its official image, so it can be compared with
  // the photo below; tapping another candidate brings that one into focus.
  let focus = 0;
  const openCard = (card) => { ScanLog.choose(currentLogId, card.key); location.hash = `#/carta/${encodeURIComponent(card.key)}`; };
  const percentOf = (candidate) => Math.round(candidate.score * 100);
  const evidenceOf = (candidate) => `Letto: ${candidate.evidence.map((e) => EVIDENCE_LABELS[e] || e).join(", ") || "nulla"}`;
  const shownOf = (candidate) => {
    const card = Catalogue.card(candidate.cardIndex);
    return { card, shown: { ...card, name: candidate.name || card.name } };
  };

  function render() {
    const hero = $("scanHero");
    const list = $("candidates");
    hero.innerHTML = "";
    list.innerHTML = "";
    if (!best) {
      hero.appendChild(el("p", { class: "muted", text: "Riprova con più luce e la carta ben dentro la cornice, oppure cercala per nome." }));
      $("othersTitle").hidden = true;
      return;
    }
    const top = candidates[focus];
    const { card, shown } = shownOf(top);
    const percent = percentOf(top);
    hero.appendChild(
      el("div", { class: "hero" },
        art(shown, { big: true, quality: "high" }),
        el("div", {},
          el("div", { class: "t", text: shown.name }),
          el("div", { class: "s", text: cardLine(card) }),
          el("div", { class: "s", text: evidenceOf(top) })),
        el("span", { class: percent >= 75 ? "badge good" : "badge warn", text: `${percent}%` }),
        el("button", { class: "btn primary", text: "È questa: apri la scheda", onclick: () => openCard(card) }))
    );
    candidates.forEach((candidate, i) => {
      if (i === focus) return;
      const other = shownOf(candidate);
      const p = percentOf(candidate);
      list.appendChild(
        el("button", { class: "item", onclick: () => { focus = i; render(); $("scanHero").scrollIntoView({ behavior: "smooth", block: "start" }); } },
          art(other.shown),
          el("div", { class: "grow" },
            el("div", { class: "t", text: other.shown.name }),
            el("div", { class: "s", text: cardLine(other.card) }),
            el("div", { class: "s", text: evidenceOf(candidate) })),
          el("span", { class: p >= 75 ? "badge good" : "badge warn", text: `${p}%` }))
      );
    });
    $("othersTitle").hidden = candidates.length < 2;
  }
  render();

  // The owner's photo, as read, under the official image.
  const photo = $("photoCanvas");
  photo.width = canvas.width;
  photo.height = canvas.height;
  photo.getContext("2d").drawImage(canvas, 0, 0);

  $("scanResult").hidden = false;
  $("noneRight").hidden = !ScanLog.enabled();
  $("noneRight").disabled = false;
  $("noneRight").textContent = "Nessuna è quella giusta";

  // Details for troubleshooting: the photo with the text boxes and what was read.
  const target = $("cardCanvas");
  target.width = canvas.width;
  target.height = canvas.height;
  const ctx = target.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  ctx.lineWidth = Math.max(2, canvas.width / 400);
  ctx.strokeStyle = "#d6aa5a";
  for (const line of reading.lines) {
    ctx.strokeRect(line.x * canvas.width, line.y * canvas.height, line.w * canvas.width, line.h * canvas.height);
  }
  $("readingOut").textContent =
    `${canvas.width}x${canvas.height} px, nitidezza ${canvas.sharpness ?? "n/d"}, lettura ${outcome.readMs} ms\n` +
    `PS: ${reading.hp ?? "-"}   numero: ${reading.numbers.map((n) => `${n.number}/${n.total}`).join(", ") || "-"}\n\n` +
    reading.lines.map((line) => `${line.text}  (${Math.round(line.confidence * 100)}%)`).join("\n");
  $("readPanel").hidden = false;
}

async function captureAndRead() {
  const shutter = $("shutter");
  shutter.disabled = true;
  shutter.classList.add("busy");
  scanError("");
  try {
    $("scanStatus").textContent = "Scatto…";
    const card = await Camera.captureSharpest();
    $("scanStatus").textContent = "Leggo la carta…";
    const outcome = await recognizeCanvas(card);
    showScan(card, outcome);
    currentLogId = await ScanLog.record(card, logEntry(card, outcome));
    $("scanStatus").textContent = currentLogId === null && ScanLog.enabled()
      ? `Lettura non salvata nel registro: ${ScanLog.lastError() || "errore sconosciuto"}`
      : "Confronta con la tua foto, poi apri la carta giusta.";
    $("scanResult").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    $("scanStatus").textContent = "Lettura non riuscita.";
    scanError(`${e.name}: ${e.message}`);
  } finally {
    shutter.disabled = !Camera.running();
    shutter.classList.remove("busy");
  }
}

/** What the log keeps about one reading, besides the photo. */
function logEntry(canvas, outcome) {
  const { reading, candidates } = outcome;
  const round = (n) => Math.round(n * 10000) / 10000;
  return {
    version: VERSION,
    camera: Camera.describe(),
    width: canvas.width,
    height: canvas.height,
    source_width: canvas.sourceWidth ?? null,
    sharpness: canvas.sharpness ?? null,
    read_ms: outcome.readMs,
    lines: reading.lines.map((l) => ({ text: l.text, confidence: round(l.confidence), x: round(l.x), y: round(l.y), w: round(l.w), h: round(l.h) })),
    parsed: {
      hp: reading.hp ?? null,
      numbers: reading.numbers,
      names: reading.nameCandidates.map((c) => c.text),
      bottom: reading.bottomText ?? null,
    },
    candidates: candidates.map((c) => ({ key: `${c.setId}-${c.number}`, name: c.name, score: round(c.score), evidence: c.evidence })),
  };
}

$("noneRight").addEventListener("click", () => {
  ScanLog.choose(currentLogId, "none");
  $("noneRight").disabled = true;
  $("noneRight").textContent = "Segnato nel registro";
});

$("startCamera").addEventListener("click", startCamera);
$("shutter").addEventListener("click", captureAndRead);

// ---------- Search ----------

let searchTimer = null;

async function runSearch() {
  await Catalogue.load();
  const text = $("searchInput").value.trim();
  const results = Catalogue.search(text);
  const list = $("searchResults");
  list.innerHTML = "";
  $("searchInfo").textContent = !Catalogue.prepared()
    ? "Catalogo non disponibile: serve la rete al primo avvio."
    : text.length < 2 ? "Cerca in tutte le lingue del catalogo."
    : results.length ? `${results.length}${results.length === 60 ? "+" : ""} carte, le più recenti per prime`
    : "Nessuna carta trovata.";
  for (const card of results) {
    list.appendChild(
      el("button", { class: "item", onclick: () => { location.hash = `#/carta/${encodeURIComponent(card.key)}`; } },
        art(card),
        el("div", { class: "grow" },
          el("div", { class: "t", text: card.name }),
          el("div", { class: "s", text: cardLine(card) }),
          card.rarity ? el("div", { class: "s", text: card.rarity }) : null))
    );
  }
}

$("searchInput").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 180);
});

// ---------- Card page ----------

function select(options, value) {
  const node = el("select");
  for (const [optionValue, label] of options) node.add(new Option(label, optionValue));
  if (value !== undefined && value !== null) node.value = value;
  return node;
}

function ownedPanel(card) {
  const copies = Store.copiesOf(card.key);
  const panel = el("div", { class: "panel" });
  if (!copies.length) {
    panel.appendChild(el("div", { class: "muted", text: "Non è ancora nel tuo scrigno." }));
    return panel;
  }
  const binderName = (id) => (Store.binders().find((b) => b.id === id) || {}).name;
  for (const copy of copies) {
    const details = [
      VARIANT_LABELS[copy.variant_type] || copy.variant_type,
      LANG_LABELS[copy.lang] || copy.lang,
      copy.condition,
      binderName(copy.binder_id),
      copy.purchase_price != null ? euro(copy.purchase_price) : null,
    ].filter(Boolean).join(" · ");
    panel.appendChild(
      el("div", { class: "copy" },
        el("div", { class: "grow" }, el("div", { text: details }), copy.notes ? el("div", { class: "s muted small", text: copy.notes }) : null),
        el("div", { class: "stepper" },
          el("button", { text: "−", "aria-label": "Togli una copia", onclick: () => { Store.changeQuantity(copy.id, -1); renderCard(card.key); } }),
          el("b", { text: String(copy.quantity) }),
          el("button", { text: "+", "aria-label": "Aggiungi una copia", onclick: () => { Store.changeQuantity(copy.id, 1); renderCard(card.key); } })))
    );
  }
  return panel;
}

function addPanel(card) {
  const kinds = [...new Set([...card.variants, "normal", "holo", "reverse"])];
  const variant = select(kinds.map((k) => [k, VARIANT_LABELS[k] || k]), card.variants[0] || "normal");
  const langs = card.set.langs.length ? card.set.langs : ["it", "en"];
  const lang = select(langs.map((l) => [l, LANG_LABELS[l] || l]), langs.includes("it") ? "it" : langs[0]);
  const condition = select([["", "Non indicata"], ...CONDITIONS.map((c) => [c, c])], "NM");
  const binder = select([["", "Nessuno"], ...Store.binders().map((b) => [String(b.id), b.name])], selectedBinder ? String(selectedBinder) : "");
  const price = el("input", { type: "number", inputmode: "decimal", min: "0", step: "0.01", placeholder: "facoltativo" });
  const notes = el("input", { type: "text", maxlength: "200", placeholder: "facoltative" });
  const variantHint = card.variants.length
    ? card.variantsInferred ? "Variante dedotta dalla rarità: controlla la carta." : "Controlla la variante sulla carta."
    : "Il catalogo non indica le varianti di questa carta: scegli tu.";

  const add = () => {
    const paid = price.value === "" ? null : Number(price.value);
    Store.addCopy({
      card_source_id: card.key,
      lang: lang.value,
      variant_type: variant.value,
      variant_confirmed: true, // the owner chose it on this form
      condition: condition.value || null,
      binder_id: binder.value ? Number(binder.value) : null,
      quantity: 1,
      purchase_price: Number.isFinite(paid) ? paid : null,
      purchase_date: paid == null ? null : new Date().toISOString().slice(0, 10),
      notes: notes.value.trim() || null,
    });
    renderCard(card.key);
  };

  return el("div", { class: "panel" },
    el("div", { class: "fields" },
      el("label", { class: "field" }, "Variante", variant),
      el("label", { class: "field" }, "Lingua", lang),
      el("label", { class: "field" }, "Condizione", condition),
      el("label", { class: "field" }, "Raccoglitore", binder),
      el("label", { class: "field" }, "Prezzo pagato (€)", price),
      el("label", { class: "field" }, "Note", notes)),
    el("p", { class: "muted small", text: variantHint }),
    el("button", { class: "btn primary block", text: "Aggiungi allo scrigno", onclick: add }));
}

async function renderCard(key) {
  await Catalogue.load();
  const view = $("view-card");
  view.innerHTML = "";
  const card = Catalogue.cardByKey(key);
  $("title").textContent = card ? card.name : "Carta";
  if (!card) {
    view.appendChild(el("div", { class: "panel muted", text: "Carta non trovata nel catalogo." }));
    return;
  }
  const others = card.names.filter((name) => name !== card.name);
  const attributes = [
    ["Espansione", card.set.code ? `${card.set.name} (${card.set.code})` : card.set.name],
    ["Numero", card.set.official ? `${card.number}/${card.set.official}` : card.number],
    ["Rarità", card.rarity],
    ["PS", card.hp],
    ["Tipo di carta", card.category],
    ["Illustratore", card.illustrator],
    ["Uscita", formatDate(card.set.releaseDate)],
  ].filter(([, value]) => value);

  view.append(
    el("div", { class: "cardhead" },
      art(card, { big: true, quality: "high" }),
      el("h2", { text: card.name }),
      el("div", { class: "muted", text: cardLine(card) }),
      others.length ? el("div", { class: "muted small", text: others.slice(0, 6).join(" · ") }) : null),
    el("h2", { text: "Nel tuo scrigno" }),
    ownedPanel(card),
    el("h2", { text: "Aggiungi una copia" }),
    addPanel(card),
    el("h2", { text: "Prezzi e acquisto" }),
    el("div", { class: "links" },
      Catalogue.links(card).map((link) =>
        el("a", { class: "btn", href: link.url, target: "_blank", rel: "noopener", text: link.exact ? link.label : `${link.label} (ricerca)` }))),
    el("h2", { text: "Dati della carta" }),
    el("div", { class: "attrs" },
      attributes.map(([label, value]) => el("div", { class: "attr" }, el("span", { text: label }), el("span", { text: String(value) }))))
  );
}

// ---------- More ----------

function renderMore() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  $("tabWarning").hidden = standalone;
  const list = $("binderList");
  list.innerHTML = "";
  const binders = Store.binders();
  if (!binders.length) list.appendChild(el("div", { class: "muted small", text: "Nessun raccoglitore: le carte stanno tutte nello scrigno." }));
  for (const binder of binders) {
    const count = Store.stats(binder.id).total;
    list.appendChild(
      el("div", { class: "row" },
        el("div", { class: "grow", text: `${binder.name} (${count})` }),
        el("button", { class: "btn ghost", text: "Elimina", onclick: () => {
          if (confirm(`Eliminare "${binder.name}"? Le carte restano nello scrigno.`)) { Store.removeBinder(binder.id); renderMore(); }
        } }))
    );
  }
  const info = Catalogue.info();
  if (info) $("catalogueInfo").textContent = `${info.cards.toLocaleString("it-IT")} carte, ${info.sets} espansioni`;
  $("cameraInfo").textContent = Camera.describe();
  $("logToggle").checked = ScanLog.enabled();
  ScanLog.count().then((n) => { $("logInfo").textContent = n ? `${n} letture registrate.` : "Nessuna lettura registrata."; });
}

async function shareOrDownload(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file], title: "Holotheca" });
    return;
  }
  const link = el("a", { href: URL.createObjectURL(file), download: file.name });
  document.body.appendChild(link);
  link.click();
  link.remove();
}

$("logToggle").addEventListener("change", (event) => ScanLog.setEnabled(event.target.checked));
$("logExport").addEventListener("click", async () => {
  try {
    if (!(await ScanLog.count())) {
      $("logInfo").textContent = ScanLog.enabled()
        ? "Il registro è vuoto: fai qualche lettura. Se resta vuoto, apri l'app dalla schermata Home e non da una scheda privata di Safari."
        : "Il registro è vuoto: accendi \"Registra ogni lettura\" e fai qualche lettura.";
      return;
    }
    $("logInfo").textContent = "Preparo il file…";
    const file = await ScanLog.exportFile({ version: VERSION, catalogue: Catalogue.info(), user_agent: navigator.userAgent });
    await shareOrDownload(file);
    $("logInfo").textContent = `Esportato ${file.name} (${(file.size / 1048576).toFixed(1)} MB).`;
  } catch (e) {
    $("logInfo").textContent = e.name === "AbortError" ? "Esportazione annullata." : `Esportazione non riuscita: ${e.message}`;
  }
});
$("logClear").addEventListener("click", async () => {
  if (!confirm("Cancellare tutte le letture registrate?")) return;
  await ScanLog.clear();
  renderMore();
});

$("binderAdd").addEventListener("click", () => {
  const name = $("binderName").value.trim();
  if (!name) return;
  Store.addBinder(name);
  $("binderName").value = "";
  renderMore();
});

$("exportBtn").addEventListener("click", async () => {
  const name = `holotheca-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([Store.exportJson()], name, { type: "application/json" });
  try {
    await shareOrDownload(file);
    $("backupInfo").textContent = `Esportato ${name}.`;
  } catch (e) {
    if (e.name !== "AbortError") $("backupInfo").textContent = `Esportazione non riuscita: ${e.message}`;
  }
});

$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  const current = Store.stats().total;
  if (current && !confirm(`Sostituire le ${current} carte dello scrigno con il contenuto del file?`)) return;
  try {
    const stats = Store.importJson(await file.text());
    $("backupInfo").textContent = `Importate ${stats.total} carte.`;
    renderMore();
  } catch (e) {
    $("backupInfo").textContent = `Importazione non riuscita: ${e.message}`;
  }
});

// ---------- Start ----------

$("version").textContent = VERSION;
$("standalone").textContent =
  window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches
    ? "sì" : "no (Condividi > Aggiungi a Home)";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("sw.js")
    .then(() => navigator.serviceWorker.ready)
    .then(() => { $("offline").textContent = "sì, dopo la prima lettura"; })
    .catch((e) => { $("offline").textContent = `no (${e.message})`; });
} else {
  $("offline").textContent = "non supportato";
}

// Ask the browser to keep the collection; iOS may still clear rarely used sites, hence the export.
(async () => {
  try {
    const storage = navigator.storage;
    let persisted = storage && storage.persisted ? await storage.persisted() : null;
    if (persisted === false && storage.persist) persisted = await storage.persist();
    $("storage").textContent = persisted === null ? "stato non noto" : persisted ? "protetti" : "non protetti: esporta spesso";
  } catch (e) {
    $("storage").textContent = "stato non noto";
  }
})();

Catalogue.load().then(() => {
  const info = Catalogue.info();
  if (info) $("catalogueInfo").textContent = `${info.cards.toLocaleString("it-IT")} carte, ${info.sets} espansioni`;
});

// Hook used by automated checks.
window.holothecaTest = {
  recognizeCanvas, showScan,
  log: async (canvas, outcome) => { currentLogId = await ScanLog.record(canvas, logEntry(canvas, outcome)); },
};

route();
