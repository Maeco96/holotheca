// Holotheca app shell: views, navigation and the scan flow.
// Reading runs on the device; the collection stays in the browser's storage (see store.js).
const VERSION = "0.16.0";
const $ = (id) => document.getElementById(id);

const VARIANT_LABELS = { normal: "Normale", holo: "Holo", reverse: "Reverse holo", metal: "Metallo", lenticular: "Lenticolare" };
// Printing details from the catalogue; anything not listed is shown as the catalogue writes it.
const SUBTYPE_LABELS = {
  shadowless: "Shadowless", unlimited: "Unlimited", "1999-2000-copyright": "copyright 1999-2000",
  "no-rarity": "senza simbolo rarità", "no-e-reader": "senza e-Reader", "missing-expansion-symbol": "senza simbolo espansione",
  "blue-border": "bordo blu", "japanese-back": "retro giapponese",
};
const STAMP_LABELS = {
  "1st-edition": "1ª edizione", "set-logo": "timbro logo espansione", staff: "Staff", "pre-release": "Prerelease",
  "w-promo": "timbro W", "30th-anniversary": "timbro 30° anniversario", "25th-celebration": "timbro 25° anniversario",
  "player-rewards-program": "Player Rewards", "professor-program": "Professor Program", winner: "Winner",
  "pokemon-center": "Pokémon Center", mcdonalds: "McDonald's", snowflake: "fiocco di neve",
};
const FOIL_LABELS = {
  cosmos: "foil cosmos", pokeball: "foil Poké Ball", masterball: "foil Master Ball", energy: "foil energia",
  "cracked-ice": "foil cracked ice", rainbow: "foil arcobaleno", gold: "foil oro", league: "foil lega", galaxy: "foil galaxy",
};
const MAIN_LANGS = ["it", "en", "fr", "de", "es", "pt", "ja", "ko", "zh-tw", "zh-cn", "th", "id"];

/** A printing in words: "Normale · 1ª edizione", "Holo · Shadowless". Takes a parsed variant. */
function variantLabel(v) {
  const plain = (slug) => String(slug).replace(/-/g, " ");
  return [
    VARIANT_LABELS[v.type] || v.type,
    v.subtype ? SUBTYPE_LABELS[v.subtype] || plain(v.subtype) : null,
    ...(v.stamps || []).map((s) => STAMP_LABELS[s] || `timbro ${plain(s)}`),
    v.foil ? FOIL_LABELS[v.foil] || `foil ${plain(v.foil)}` : null,
    v.size ? (v.size === "jumbo" ? "Jumbo" : plain(v.size)) : null,
  ].filter(Boolean).join(" · ");
}

/** The printing stored on an owned copy, as a parsed variant. */
function copyVariant(copy) {
  return {
    type: copy.variant_type || "normal", subtype: copy.variant_subtype || null,
    stamps: copy.variant_stamps ? String(copy.variant_stamps).split(",") : [],
    foil: copy.variant_foil || null, size: copy.variant_size || null,
  };
}
const LANG_LABELS = {
  it: "Italiano", en: "Inglese", fr: "Francese", de: "Tedesco", es: "Spagnolo", pt: "Portoghese",
  "pt-br": "Portoghese (BR)", ja: "Giapponese", ko: "Coreano", "zh-tw": "Cinese trad.", "zh-cn": "Cinese sempl.",
  th: "Thai", id: "Indonesiano", nl: "Olandese", pl: "Polacco", ru: "Russo",
};
const CONDITIONS = ["MT", "NM", "EX", "GD", "LP", "PL", "PO"];
const EVIDENCE_LABELS = {
  name: "nome", "name~": "nome (simile)", "number/total": "numero", "number/total~": "numero (ricostruito)",
  "number/total~~": "numero (incerto)", number: "numero", total: "totale espansione", "total~": "totale (incerto)",
  hp: "PS", "set code": "codice espansione", illustrator: "illustratore", image: "immagine",
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

function shortDate(iso) {
  if (!iso) return "";
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "2-digit" });
}

/** A signed euro difference, "+1,20 €" or "−0,80 €". */
function signedEuro(value) {
  return (value >= 0 ? "+" : "−") + euro(Math.abs(value));
}

function today() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Reads a euro amount typed by the owner ("12,50" or "12.50"); empty gives null, nonsense undefined. */
function parseEuro(text) {
  const clean = String(text || "").trim().replace(/[€\s]/g, "").replace(",", ".");
  if (!clean) return null;
  const value = Number(clean);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : undefined;
}

/**
 * A small line chart as inline SVG. `series` is [{ points: [[x, y], ...], cls }], x in ms.
 * Shows the lowest and highest value and the first and last date; nothing else.
 */
function lineChart(series, { height = 120, money = true } = {}) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return null;
  const width = 320;
  const pad = { l: 4, r: 4, t: 16, b: 20 };
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y0 === y1) { y0 *= 0.9; y1 = y1 * 1.1 || 1; }
  const sx = (x) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (width - pad.l - pad.r);
  const sy = (y) => pad.t + (1 - (y - y0) / (y1 - y0)) * (height - pad.t - pad.b);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("class", "chart");
  svg.setAttribute("role", "img");
  const add = (tag, attrs, text) => {
    const node = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text) node.textContent = text;
    svg.appendChild(node);
    return node;
  };
  for (const y of [y0, y1]) add("line", { x1: pad.l, x2: width - pad.r, y1: sy(y), y2: sy(y), class: "grid" });
  for (const s of series) {
    if (s.points.length < 2) continue;
    add("polyline", { points: s.points.map(([x, y]) => `${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join(" "), class: `line ${s.cls || ""}` });
  }
  const label = (v) => (money ? euro(v) : String(v));
  // Value labels sit just above their line on the left; dates sit below the chart.
  add("text", { x: pad.l, y: sy(y1) - 4, class: "lbl" }, label(y1));
  add("text", { x: pad.l, y: sy(y0) - 4, class: "lbl" }, label(y0));
  const day = (ms) => new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
  add("text", { x: pad.l, y: height - 3, class: "lbl" }, day(x0));
  add("text", { x: width - pad.r, y: height - 3, "text-anchor": "end", class: "lbl" }, day(x1));
  return svg;
}

const BASIS_LABELS = { trend: "trend", avg30: "media 30 giorni", avg7: "media 7 giorni" };

function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
}

/** Card artwork that tries each image address in turn and falls back to the card name. */
function art(card, { big = false, quality = "low", lang = null, onImage = null } = {}) {
  const box = el("div", { class: big ? "art big" : "art" });
  const placeholder = el("div", { class: "ph", text: card ? card.name : "?" });
  box.appendChild(placeholder);
  if (!card) return box;
  const images = Catalogue.images(card, quality, lang);
  const urls = images.map((image) => image.url);
  let attempt = 0;
  if (!urls.length) { if (onImage) onImage(null); return box; }
  // The image sits in the box from the start, transparent until loaded: a lazy image that is
  // not in the document is never fetched, which left every card on its placeholder up to 0.8.0.
  const img = el("img", { alt: card.name, loading: "lazy", decoding: "async", class: "loading" });
  img.addEventListener("load", () => {
    img.classList.remove("loading");
    placeholder.remove();
    if (onImage) onImage(images[attempt].lang, images[attempt]);
  });
  img.addEventListener("error", () => {
    attempt += 1;
    if (attempt < urls.length) img.src = urls[attempt];
    else if (onImage) onImage(null);
  });
  img.src = urls[0];
  box.appendChild(img);
  return box;
}

/**
 * A line under a large card image saying what the picture is: the catalogue has one image per
 * card and language, so it can show another printing (a 1st edition stamp, a different foil)
 * or another language than the copy in hand.
 */
function imageNote(card, wantedLang) {
  const note = el("div", { class: "muted small imgnote", text: "Carico l'immagine…" });
  const several = card.variants.length > 1 || card.variants.some((token) => token.includes(":"));
  const onImage = (lang, image = null) => {
    if (!lang) {
      note.textContent = "Il catalogo non ha un'immagine di questa carta: confrontala con i dati qui sotto.";
      return;
    }
    const language = (LANG_LABELS[lang] || lang).toLowerCase();
    const other = wantedLang && wantedLang !== lang ? ` (manca quella in ${(LANG_LABELS[wantedLang] || wantedLang).toLowerCase()})` : "";
    const source = image && typeof image.official === "string" ? `, ${image.official.includes("wiki") ? "dalla wiki" : "dal sito ufficiale"} ${image.official}` : "";
    note.textContent = `Immagine di riferimento in ${language}${other}${source}.` +
      (several ? " Può mostrare un'altra versione, per esempio con il timbro 1ª edizione: la versione la scegli tu." : "");
  };
  return { note, onImage };
}

// What the last scan read about the copy in hand, used to prefill the card page.
let scanContext = null; // { key, lang }

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
  if (view === "search") renderSearch(argument.split("/")[0] || "");
  if (view === "more") renderMore();
  if (view === "card") renderCard(argument);
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
$("back").addEventListener("click", () => (history.length > 1 ? history.back() : (location.hash = "#/scrigno")));

// ---------- Scrigno ----------

let selectedBinder = null;

/**
 * Value of the collection (or of one binder) at today's prices: { value, priced, unpriced, cost,
 * costed } where `cost` is what was paid for the copies that have both a price paid and a value,
 * so a gain compares like with like.
 */
function collectionValue(binderId) {
  let value = 0, priced = 0, unpriced = 0, cost = 0, costed = 0;
  const count = (unit, quantity, paid) => {
    if (!unit) { unpriced += quantity; return; }
    value += unit.value * quantity;
    priced += quantity;
    if (paid != null) { cost += paid * quantity; costed += unit.value * quantity; }
  };
  for (const copy of Store.copies(binderId)) {
    count(Prices.copyUnit(copy, Catalogue.cardByKey(copy.card_source_id)), copy.quantity, copy.purchase_price);
  }
  for (const item of Store.sealed(binderId)) count(Prices.sealedUnit(item), item.quantity, item.purchase_price);
  return { value: Math.round(value * 100) / 100, priced, unpriced, cost, costed };
}

function renderValuePanel(stats) {
  const panel = $("valuePanel");
  panel.innerHTML = "";
  const info = Prices.info();
  if (!info) {
    panel.appendChild(el("p", { class: "muted small", style: "margin:0", text: "Prezzi non disponibili: servono la rete e un aggiornamento dell'app." }));
    return;
  }
  const lines = [];
  if (stats.costed) {
    const gain = stats.costed - stats.cost;
    lines.push(el("div", { class: "row" },
      el("span", { class: "grow muted small", text: "Carte con prezzo pagato: valgono" }),
      el("b", { class: gain >= 0 ? "up" : "down", text: `${euro(stats.costed)} (${signedEuro(gain)})` })));
  }
  if (stats.unpriced) lines.push(el("div", { class: "muted small", text: `${stats.unpriced} senza prezzo: gradate senza valore indicato o carte che Cardmarket non quota.` }));
  const history = Store.valueHistory().filter((r) => r.value != null);
  const chart = selectedBinder === null && history.length >= 2
    ? lineChart([
      { points: history.map((r) => [Date.parse(r.day), r.value]), cls: "main" },
      { points: history.filter((r) => r.spent).map((r) => [Date.parse(r.day), r.spent]), cls: "alt" },
    ])
    : null;
  panel.append(
    ...lines,
    chart,
    chart ? el("div", { class: "legend small muted" }, el("span", { class: "key main" }), "valore ", el("span", { class: "key alt" }), "spesi") : null,
    el("p", { class: "muted small", style: "margin:6px 0 0", text:
      `Trend Cardmarket del ${shortDate(info.day)}, per copie non gradate in qualunque condizione.` +
      (selectedBinder === null && history.length < 2 ? " L'andamento compare dal secondo giorno di prezzi." : "") }));
}

async function renderCollection() {
  await Promise.all([Catalogue.load(), Prices.load()]);
  const stats = Store.stats(selectedBinder);
  const worth = collectionValue(selectedBinder);
  $("statTotal").textContent = stats.total;
  $("statDistinct").textContent = stats.distinct;
  $("statSpent").textContent = stats.spent ? euro(stats.spent) : "–";
  $("statValue").textContent = Prices.info() && worth.priced ? euro(worth.value) : "–";
  if (Prices.info() && selectedBinder === null && (worth.priced || stats.spent)) {
    Store.recordValue({ day: Prices.info().day, value: worth.value, spent: stats.spent, priced: worth.priced, unpriced: worth.unpriced });
  }
  renderValuePanel(worth);

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
  renderSealedList();
  $("collectionEmpty").hidden = keys.length > 0 || Store.sealed(selectedBinder).length > 0;
}

// Sealed products: picked from Cardmarket's product list, kept in Store.sealed().
function renderSealedList() {
  const list = $("sealedList");
  list.innerHTML = "";
  const items = Store.sealed(selectedBinder);
  $("sealedHead").hidden = !items.length;
  for (const item of items) {
    const unit = Prices.sealedUnit(item);
    const details = [
      item.product_type,
      unit ? `${euro(unit.value)}${unit.source === "manual" ? " (tuo)" : ""}` : "senza prezzo",
      item.purchase_price != null ? `pagato ${euro(item.purchase_price)}` : null,
    ].filter(Boolean).join(" · ");
    list.appendChild(el("div", { class: "copy" },
      el("div", { class: "grow" }, el("div", { text: item.name }), el("div", { class: "muted small", text: details })),
      el("button", { class: "btn ghost small", text: "Valore", onclick: () => askValue(item.manual_value, (v) => { Store.setSealedValue(item.id, v); renderCollection(); }) }),
      el("div", { class: "stepper" },
        el("button", { text: "−", "aria-label": "Togli uno", onclick: () => { Store.changeSealedQuantity(item.id, -1); renderCollection(); } }),
        el("b", { text: String(item.quantity) }),
        el("button", { text: "+", "aria-label": "Aggiungi uno", onclick: () => { Store.changeSealedQuantity(item.id, 1); renderCollection(); } }))));
  }
}

/** Asks for a value in euro; empty clears it (back to the price guide). */
function askValue(current, done) {
  const answer = prompt("Valore in euro (vuoto = usa il prezzo Cardmarket)", current != null ? String(current).replace(".", ",") : "");
  if (answer === null) return;
  const value = parseEuro(answer);
  if (value === undefined) { alert("Scrivi un importo, per esempio 12,50."); return; }
  done(value);
}

let sealedChoice = null;

function renderSealedPicker() {
  const box = $("sealedResults");
  box.innerHTML = "";
  if (!Prices.info()) {
    box.appendChild(el("p", { class: "muted small", text: "L'elenco dei sigillati arriva con i prezzi: serve la rete." }));
    return;
  }
  if (sealedChoice) {
    const item = sealedChoice;
    const p = Prices.forProduct(item.id);
    const head = p && Prices.headline(p.normal);
    const price = el("input", { type: "text", inputmode: "decimal", placeholder: "facoltativo" });
    const date = el("input", { type: "date", value: today() });
    const binder = select([["", "Nessuno"], ...Store.binders().map((b) => [String(b.id), b.name])], selectedBinder ? String(selectedBinder) : "");
    const lang = select([["", "Non indicata"], ...MAIN_LANGS.map((l) => [l, LANG_LABELS[l] || l])], "");
    const add = () => {
      const paid = parseEuro(price.value);
      if (paid === undefined) { alert("Prezzo pagato: scrivi un importo, per esempio 12,50."); return; }
      Store.addSealed({
        cardmarket_id: item.id, name: item.name, product_type: item.category.replace(/^Pokémon\s*/, ""),
        lang: lang.value || null, binder_id: binder.value ? Number(binder.value) : null,
        purchase_price: paid, purchase_date: paid == null ? null : date.value || null,
      });
      sealedChoice = null;
      $("sealedSearch").value = "";
      $("sealedPicker").hidden = true;
      renderCollection();
    };
    box.append(el("div", { class: "panel" },
      el("b", { text: item.name }),
      el("div", { class: "muted small", text: [item.category, head ? `trend ${euro(head.value)}` : "senza prezzo"].join(" · ") }),
      el("div", { class: "fields" },
        el("label", { class: "field" }, "Lingua", lang),
        el("label", { class: "field" }, "Raccoglitore", binder),
        el("label", { class: "field" }, "Prezzo pagato (€)", price),
        el("label", { class: "field" }, "Data d'acquisto", date)),
      el("div", { class: "row" },
        el("button", { class: "btn ghost", text: "Indietro", onclick: () => { sealedChoice = null; renderSealedPicker(); } }),
        el("button", { class: "btn primary grow", text: "Aggiungi allo scrigno", onclick: add }))));
    return;
  }
  const text = $("sealedSearch").value.trim();
  if (text.length < 2) {
    box.appendChild(el("p", { class: "muted small", text: "Scrivi il nome in inglese come su Cardmarket, per esempio: evolving skies booster box." }));
    return;
  }
  const found = Prices.searchSealed(text);
  if (!found.length) box.appendChild(el("p", { class: "muted small", text: "Nessun prodotto trovato." }));
  for (const item of found) {
    const p = Prices.forProduct(item.id);
    const head = p && Prices.headline(p.normal);
    box.appendChild(el("button", { class: "item", onclick: () => { sealedChoice = item; renderSealedPicker(); } },
      el("div", { class: "grow" }, el("div", { text: item.name }), el("div", { class: "muted small", text: item.category })),
      el("b", { text: head ? euro(head.value) : "–" })));
  }
}

$("sealedOpen").addEventListener("click", async () => {
  $("sealedPicker").hidden = !$("sealedPicker").hidden;
  sealedChoice = null;
  await Prices.load();
  renderSealedPicker();
  if (!$("sealedPicker").hidden) $("sealedSearch").focus();
});
$("sealedSearch").addEventListener("input", () => { sealedChoice = null; renderSealedPicker(); });

// ---------- Scan ----------

let enginePromise = null;
let currentLogId = null; // scan-log entry of the reading on screen

function scanError(message) {
  $("scanError").textContent = message;
  $("scanError").hidden = !message;
}

Camera.bind({
  video: $("video"), frame: $("frame"), lens: $("lens"), zoomRow: $("zoomRow"), torch: $("torch"),
  onError: scanError, onLost: () => recoverCamera(),
});

/**
 * Brings a frozen preview back: iOS stops the camera when the app leaves the screen, and the
 * picture then stays on its last frame. Runs when the app becomes visible again, when the
 * camera reports that it stopped, and before every reading.
 */
let recovering = null;
function recoverCamera() {
  if (!cameraWanted || document.hidden || $("view-scan").hidden || Camera.healthy()) return Promise.resolve();
  if (!recovering) {
    $("scanStatus").textContent = "Riavvio la fotocamera…";
    recovering = startCamera().finally(() => { recovering = null; });
  }
  return recovering;
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) setTimeout(recoverCamera, 300); });
window.addEventListener("pageshow", () => setTimeout(recoverCamera, 300));

async function startCamera() {
  scanError("");
  $("startCamera").hidden = true;
  try {
    await Camera.start();
    cameraWanted = true;
    $("shutter").disabled = false;
    $("scanStatus").textContent = "Inquadra la carta e tocca il pulsante.";
    $("cameraInfo").textContent = Camera.describe();
  } catch (e) {
    $("startCamera").hidden = false;
    $("shutter").disabled = true;
    scanError(e.name === "NotAllowedError" ? "Permesso fotocamera negato: abilitalo nelle impostazioni di Safari." : `${e.name}: ${e.message}`);
  }
}

function enterScan() {
  Catalogue.load().then(() => Pile.render());
  // Once the owner has started the camera, coming back to this tab restarts it.
  if (cameraWanted && !Camera.healthy()) startCamera();
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
  let candidates = index ? HolothecaRecognize.match(index, reading, 5) : [];
  let visual = null;
  if (index && !isConfident(candidates)) {
    try {
      visual = await compareImage(canvas, candidates);
      candidates = visual.candidates;
    } catch (e) {
      visual = { error: `${e.name}: ${e.message}` };
    }
  }
  return { reading, candidates, readMs, matchMs: 0, catalogue: Boolean(index), visual };
}

// Visual fallback. A similarity (share of equal sign bits of the artwork vectors, as -1..1)
// maps to a score between these: below VISUAL_LOW a picture says nothing, at VISUAL_HIGH it is
// as good as a full text match. Measured on the first scan log (docs/visual/probe.md): the right
// card scored about 0.57-0.76, the best wrong card 0.48-0.66 (cosine 0.78-0.93 and 0.68-0.86).
const VISUAL_LOW = 0.45;
const VISUAL_HIGH = 0.75;
const visualScore = (similarity) => Math.max(0, Math.min(1, (similarity - VISUAL_LOW) / (VISUAL_HIGH - VISUAL_LOW)));

/**
 * When the text is not enough, compares the photo with the picture of every card: text
 * candidates get the picture as extra evidence, and the most similar pictures join the list.
 */
async function compareImage(canvas, candidates) {
  const { ort } = window.HolothecaOcr;
  if (!HolothecaVisual.ready()) $("scanStatus").textContent = "Carico il confronto per immagine (circa 30 MB la prima volta)…";
  await HolothecaVisual.load(ort, absolute);
  $("scanStatus").textContent = "Confronto l'immagine con il catalogo…";
  const t0 = performance.now();
  const query = await HolothecaVisual.embed(ort, canvas);
  const top = HolothecaVisual.search(query, 8);
  const byKey = new Map();
  for (const c of candidates) {
    const key = `${c.setId}-${c.number}`;
    const similarity = HolothecaVisual.similarityOf(query, key);
    const v = similarity === null ? 0 : visualScore(similarity);
    byKey.set(key, { ...c, similarity, score: Math.min(1, c.score * 0.6 + v * 0.4 + (v > 0.5 ? 0.1 : 0)), evidence: v > 0.5 ? [...c.evidence, "image"] : c.evidence });
  }
  for (const t of top) {
    if (byKey.has(t.key)) continue;
    const card = Catalogue.cardByKey(t.key);
    if (!card) continue;
    byKey.set(t.key, {
      cardIndex: card.index, score: visualScore(t.similarity) * 0.9, similarity: t.similarity, evidence: ["image"],
      setId: card.set.id, setCode: card.set.code, setName: card.set.name, official: card.set.official,
      number: card.number, hp: card.hp, name: card.name, names: card.names,
    });
  }
  const merged = [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, 6);
  return {
    candidates: merged, ms: Math.round(performance.now() - t0),
    top: top.map((t) => ({ key: t.key, similarity: Math.round(t.similarity * 1000) / 1000 })),
  };
}

/** The first candidate is clearly right: a high score and well ahead of the second. */
function isConfident(candidates) {
  const [best, second] = candidates;
  return Boolean(best && best.score >= 0.75 && (!second || best.score - second.score >= 0.15));
}

function showScan(canvas, outcome) {
  const { reading, candidates } = outcome;
  const best = candidates[0];
  const confident = isConfident(candidates);
  $("verdict").textContent = !outcome.catalogue
    ? "Catalogo non disponibile"
    : !best ? "Carta non riconosciuta" : confident ? "Trovata" : "Quale di queste?";

  // The card in focus is shown large with its official image, so it can be compared with
  // the photo below; tapping another candidate brings that one into focus.
  let focus = 0;
  const readLang = reading.language || null;
  const openCard = (card) => {
    ScanLog.choose(currentLogId, card.key);
    scanContext = { key: card.key, lang: readLang };
    location.hash = `#/carta/${encodeURIComponent(card.key)}`;
  };
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
    const { note, onImage } = imageNote(card, readLang);
    hero.appendChild(
      el("div", { class: "hero" },
        art(shown, { big: true, quality: "high", lang: readLang, onImage }),
        note,
        el("div", {},
          el("div", { class: "t", text: shown.name }),
          el("div", { class: "s", text: cardLine(card) }),
          el("div", { class: "s", text: evidenceOf(top) }),
          readLang ? el("div", { class: "s", text: `Lingua letta: ${LANG_LABELS[readLang] || readLang}` }) : null),
        el("span", { class: percent >= 75 ? "badge good" : "badge warn", text: `${percent}%` }),
        el("button", { class: "btn primary", text: "È questa: apri la scheda", onclick: () => openCard(card) }),
        el("button", { class: "btn ghost", text: Pile.has(card.key) ? "Già nella pila" : "Metti nella pila",
          onclick: (event) => { ScanLog.choose(currentLogId, card.key); Pile.add(card.key, readLang); event.target.textContent = "Nella pila"; event.target.disabled = true; } }))
    );
    candidates.forEach((candidate, i) => {
      if (i === focus) return;
      const other = shownOf(candidate);
      const p = percentOf(candidate);
      list.appendChild(
        el("button", { class: "item", onclick: () => { focus = i; render(); $("scanHero").scrollIntoView({ behavior: "smooth", block: "start" }); } },
          art(other.shown, { lang: readLang }),
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
    `${canvas.width}x${canvas.height} px, nitidezza ${canvas.sharpness ?? "n/d"}, lettura ${outcome.readMs} ms` +
    (outcome.visual ? outcome.visual.error ? `, immagine: ${outcome.visual.error}` : `, immagine ${outcome.visual.ms} ms` : "") + "\n" +
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
    await recoverCamera();
    $("scanStatus").textContent = "Scatto…";
    const card = await Camera.captureSharpest();
    $("scanStatus").textContent = "Leggo la carta…";
    const outcome = await recognizeCanvas(card);
    showScan(card, outcome);
    currentLogId = await ScanLog.record(card, logEntry(card, outcome));
    const continuous = $("continuous").checked;
    if (continuous && isConfident(outcome.candidates)) {
      // Continuous scanning: a sure reading goes straight to the pile and the camera stays
      // in view for the next card. The variant is still chosen by hand in the pile.
      const best = Catalogue.card(outcome.candidates[0].cardIndex);
      ScanLog.choose(currentLogId, best.key);
      Pile.add(best.key, outcome.reading.language || null);
      $("scanStatus").textContent = `Nella pila: ${outcome.candidates[0].name || best.name} (${cardLine(best)}). Inquadra la prossima.`;
      $("scanResult").hidden = true;
      $("readPanel").hidden = true;
      if (navigator.vibrate) navigator.vibrate(40);
    } else {
      $("scanStatus").textContent = currentLogId === null && ScanLog.enabled()
        ? `Lettura non salvata nel registro: ${ScanLog.lastError() || "errore sconosciuto"}`
        : continuous ? "Non sono sicuro: scegli la carta giusta e mettila nella pila." : "Confronta con la tua foto, poi apri la carta giusta.";
      $("scanResult").scrollIntoView({ behavior: "smooth", block: "start" });
    }
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
    visual: outcome.visual ? { ms: outcome.visual.ms ?? null, top: outcome.visual.top || [], error: outcome.visual.error || null } : null,
  };
}

// ---------- Scan pile ----------
// Cards read one after the other wait here; the owner picks variant and language for each
// (the variant is never preselected), sets condition and binder once, and adds them together.
const Pile = (() => {
  const KEY = "scrinium-pile";
  let items = []; // [{ key, lang, variant }]
  try { items = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { items = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) { /* private browsing */ } };
  const condition = select([["", "Non indicata"], ...CONDITIONS.map((c) => [c, c])], "NM");
  let binder = null;

  function add(key, lang) {
    items.unshift({ key, lang: lang || null, variant: null });
    save();
    render();
  }

  function render() {
    const panel = $("pilePanel");
    panel.hidden = !items.length;
    if (!items.length) return;
    $("pileTitle").textContent = items.length === 1 ? "Pila: 1 carta" : `Pila: ${items.length} carte`;
    const list = $("pileList");
    list.innerHTML = "";
    items.forEach((item, i) => {
      const card = Catalogue.cardByKey(item.key);
      if (!card) return;
      const known = card.variants.map(Catalogue.parseVariant);
      const types = new Set(known.map((v) => v.type));
      const options = [...known, ...["normal", "holo", "reverse"].filter((t) => !types.has(t)).map(Catalogue.parseVariant)];
      const variant = select([["", "Scegli la variante…"], ...options.map((v) => [v.token, variantLabel(v)])], item.variant || "");
      variant.addEventListener("change", () => { item.variant = variant.value || null; save(); render(); });
      const langs = [...new Set([...MAIN_LANGS, ...card.set.langs])];
      const lang = select(langs.map((l) => [l, LANG_LABELS[l] || l]), item.lang || (card.set.langs.includes("it") || !card.set.langs.length ? "it" : card.set.langs[0]));
      item.lang = lang.value;
      lang.addEventListener("change", () => { item.lang = lang.value; save(); });
      list.appendChild(el("div", { class: item.variant ? "item" : "item need" },
        el("a", { href: `#/carta/${encodeURIComponent(card.key)}` }, art(card, { lang: item.lang })),
        el("div", { class: "grow" },
          el("div", { class: "t", text: card.name }),
          el("div", { class: "s", text: cardLine(card) }),
          variant, lang),
        el("button", { class: "x", text: "×", "aria-label": "Togli dalla pila", onclick: () => { items.splice(i, 1); save(); render(); } })));
    });
    save();
    const binderSelect = select([["", "Nessuno"], ...Store.binders().map((b) => [String(b.id), b.name])], binder ?? (selectedBinder ? String(selectedBinder) : ""));
    binderSelect.addEventListener("change", () => { binder = binderSelect.value; });
    binder = binderSelect.value;
    const fields = $("pileFields");
    fields.innerHTML = "";
    fields.append(el("label", { class: "field" }, "Condizione (tutte)", condition), el("label", { class: "field" }, "Raccoglitore", binderSelect));
    const missing = items.filter((item) => !item.variant).length;
    $("pileHint").textContent = missing
      ? `Scegli la variante di ${missing === 1 ? "1 carta" : `${missing} carte`} guardando la carta (timbro 1ª edizione, holo, reverse): lo scanner non la decide.`
      : "Controlla lingua e variante, poi aggiungi.";
    $("pileAdd").disabled = Boolean(missing);
    $("pileAdd").textContent = items.length === 1 ? "Aggiungi 1 carta allo scrigno" : `Aggiungi ${items.length} carte allo scrigno`;
  }

  function commit() {
    if (items.some((item) => !item.variant)) return;
    for (const item of items) {
      const v = Catalogue.parseVariant(item.variant);
      Store.addCopy({
        card_source_id: item.key, lang: item.lang,
        variant_type: v.type, variant_subtype: v.subtype, variant_stamps: v.stamps.join(",") || null,
        variant_foil: v.foil, variant_size: v.size,
        variant_confirmed: true, // chosen by the owner in the pile
        condition: condition.value || null, binder_id: binder ? Number(binder) : null, quantity: 1,
      });
    }
    const n = items.length;
    items = [];
    save();
    render();
    $("scanStatus").textContent = n === 1 ? "1 carta aggiunta allo scrigno." : `${n} carte aggiunte allo scrigno.`;
  }

  function clear() {
    items = [];
    save();
    render();
  }

  return { add, render, commit, clear, has: (key) => items.some((item) => item.key === key), size: () => items.length };
})();

$("pileAdd").addEventListener("click", () => Pile.commit());
$("pileClear").addEventListener("click", () => {
  if (Pile.size() && window.confirm("Svuoto la pila? Le carte non aggiunte si perdono.")) Pile.clear();
});

$("noneRight").addEventListener("click", () => {
  ScanLog.choose(currentLogId, "none");
  $("noneRight").disabled = true;
  $("noneRight").textContent = "Segnato nel registro";
});

$("startCamera").addEventListener("click", startCamera);
$("shutter").addEventListener("click", captureAndRead);

// ---------- Search ----------
// The search view is a browser of expansions (tiles with the logo, the date and how many cards
// you own), an expansion page with every card of it, and the name/number search on top.

let searchTimer = null;
let searchLang = "";      // language filter ("" = all)
let setFilter = "all";    // on the expansion page: all | have | missing

function ownedBySet() {
  const perSet = new Map();
  const seen = new Set();
  for (const copy of Store.copies()) {
    if (seen.has(copy.card_source_id)) continue;
    seen.add(copy.card_source_id);
    const card = Catalogue.cardByKey(copy.card_source_id);
    if (card) perSet.set(card.set.id, (perSet.get(card.set.id) || 0) + 1);
  }
  return perSet;
}

/** The logo of an expansion, falling back to its code when no logo can be loaded. */
function setLogo(set, lang) {
  const box = el("div", { class: "logo" });
  const fallback = el("span", { class: "code", text: set.code });
  box.appendChild(fallback);
  // The logo first; when the source has none, the picture of the first cards of the expansion.
  let urls = Catalogue.setLogos(set, lang || null);
  let cover = false;
  let attempt = 0;
  const img = el("img", { alt: set.name, loading: "lazy", decoding: "async", class: "loading" });
  const useCover = () => {
    if (cover) return false;
    cover = true;
    urls = Catalogue.coverImages(set, lang || null);
    attempt = 0;
    if (!urls.length) return false;
    box.classList.add("cover");
    img.src = urls[0];
    return true;
  };
  img.addEventListener("load", () => { img.classList.remove("loading"); fallback.remove(); });
  img.addEventListener("error", () => {
    attempt += 1;
    if (attempt < urls.length) img.src = urls[attempt];
    else useCover();
  });
  box.appendChild(img);
  if (urls.length) img.src = urls[0];
  else if (!useCover()) img.remove();
  return box;
}

function monthYear(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("it-IT", { month: "short", year: "numeric" });
}

function setTile(set, owned) {
  const have = owned.get(set.id) || 0;
  return el("button", { class: "settile", onclick: () => { setFilter = "all"; location.hash = `#/cerca/${encodeURIComponent(set.id)}`; } },
    el("div", { class: "top" }, setLogo(set, searchLang), set.releaseDate ? el("span", { class: "date", text: `${set.series === "official" ? "≈ " : ""}${monthYear(set.releaseDate)}` }) : null),
    el("div", { class: "nm", text: set.name }),
    el("div", { class: "meta" },
      el("span", { text: `${set.code ? `${set.code} · ` : ""}${set.cards} carte` }),
      have ? el("b", { text: `${have}/${set.cards}` }) : null),
    have ? el("div", { class: "bar" }, el("i", { style: `width:${Math.min(100, Math.round((have / set.cards) * 100))}%` })) : null);
}

function fillLangChips() {
  const row = $("searchLangs");
  const order = ["it", "en", "ja", "ko", "zh-tw", "zh-cn", "fr", "de", "es", "pt"];
  const rank = (code) => (order.includes(code) ? order.indexOf(code) : order.length);
  const langs = [...new Set(Catalogue.sets().flatMap((set) => set.langs))]
    .sort((a, b) => rank(a) - rank(b) || (LANG_LABELS[a] || a).localeCompare(LANG_LABELS[b] || b, "it"));
  row.innerHTML = "";
  const chip = (label, value) =>
    el("button", { class: searchLang === value ? "chip on" : "chip", text: label,
      onclick: () => { searchLang = value; fillLangChips(); renderSearch(); } });
  row.appendChild(chip("Tutte le lingue", ""));
  for (const code of langs) row.appendChild(chip(LANG_LABELS[code] || code, code));
}

function renderSetGrid(body, owned) {
  const sets = Catalogue.sets().filter((set) => !searchLang || set.langs.includes(searchLang));
  body.appendChild(el("p", { class: "muted small", text: `${sets.length} espansioni, le più recenti per prime. Tocca un'espansione per vedere tutte le sue carte.` }));
  let year = null;
  let grid = null;
  for (const set of sets) {
    const y = set.releaseDate ? set.releaseDate.slice(0, 4) : "Senza data";
    if (y !== year) {
      year = y;
      body.appendChild(el("h2", { class: "yearhead", text: y }));
      grid = el("div", { class: "setgrid" });
      body.appendChild(grid);
    }
    grid.appendChild(setTile(set, owned));
  }
}

function renderSetPage(body, setId, owned) {
  const set = Catalogue.sets().find((candidate) => candidate.id === setId);
  if (!set) { body.appendChild(el("p", { class: "muted", text: "Espansione non trovata." })); return; }
  const cards = Catalogue.cardsOfSet(setId);
  const keys = new Set(Store.copies().map((copy) => copy.card_source_id));
  const have = cards.filter((card) => keys.has(card.key)).length;
  const lang = searchLang && set.langs.includes(searchLang) ? searchLang : null;

  body.appendChild(el("div", { class: "sethead" },
    el("button", { class: "chip", text: "‹ Espansioni", onclick: () => { location.hash = "#/cerca"; } }),
    setLogo(set, lang),
    el("h2", { text: set.name }),
    el("div", { class: "muted small", text: [set.code, set.releaseDate ? `${set.series === "official" ? "circa " : ""}${formatDate(set.releaseDate)}` : "",  `${cards.length} carte`,
      set.langs.map((code) => LANG_LABELS[code] || code).join(", ")].filter(Boolean).join(" · ") }),
    el("div", { class: "progress" },
      el("div", { class: "bar big" }, el("i", { style: `width:${cards.length ? Math.round((have / cards.length) * 100) : 0}%` })),
      el("span", { class: "small", text: have ? `Ne hai ${have} su ${cards.length}` : "Non ne hai ancora nessuna" }))));

  const row = el("div", { class: "chiprow" });
  for (const [value, label] of [["all", `Tutte (${cards.length})`], ["have", `Le ho (${have})`], ["missing", `Mi mancano (${cards.length - have})`]]) {
    row.appendChild(el("button", { class: setFilter === value ? "chip on" : "chip", text: label,
      onclick: () => { setFilter = value; renderSearch(); } }));
  }
  body.appendChild(row);

  const grid = el("div", { class: "grid cardgrid" });
  for (const card of cards) {
    const owns = keys.has(card.key);
    if ((setFilter === "have" && !owns) || (setFilter === "missing" && owns)) continue;
    grid.appendChild(
      el("button", { class: owns ? "tile" : "tile missing", onclick: () => { location.hash = `#/carta/${encodeURIComponent(card.key)}`; } },
        art(card, { lang }),
        owns ? el("span", { class: "qty", text: "✓" }) : null,
        el("div", { class: "cap", text: `${card.number} ${Catalogue.nameIn(card, lang)}` })));
  }
  body.appendChild(grid);
  if (!grid.children.length) body.appendChild(el("p", { class: "muted", text: "Nessuna carta in questo elenco." }));
}

function renderTextResults(body, text, owned) {
  const lower = text.toLowerCase();
  const sets = Catalogue.sets().filter((set) => (!searchLang || set.langs.includes(searchLang)) &&
    (set.name.toLowerCase().includes(lower) || set.code.toLowerCase() === lower)).slice(0, 12);
  if (sets.length) {
    body.appendChild(el("h2", { text: "Espansioni" }));
    body.appendChild(el("div", { class: "setstrip" }, sets.map((set) => setTile(set, owned))));
  }
  const results = Catalogue.search(text, 60, { lang: searchLang });
  body.appendChild(el("h2", { text: "Carte" }));
  body.appendChild(el("p", { class: "muted small", text: results.length
    ? `${results.length}${results.length === 60 ? "+" : ""} carte, le più recenti per prime`
    : "Nessuna carta trovata." }));
  const list = el("div", { class: "list" });
  for (const card of results) {
    list.appendChild(
      el("button", { class: "item", onclick: () => { location.hash = `#/carta/${encodeURIComponent(card.key)}`; } },
        art(card, { lang: searchLang || null }),
        el("div", { class: "grow" },
          el("div", { class: "t", text: Catalogue.nameIn(card, searchLang || null) }),
          el("div", { class: "s", text: cardLine(card) }),
          card.rarity ? el("div", { class: "s", text: card.rarity }) : null)));
  }
  body.appendChild(list);
}

async function renderSearch(setId = null) {
  await Catalogue.load();
  const body = $("searchBody");
  body.innerHTML = "";
  if (!Catalogue.prepared()) {
    body.appendChild(el("p", { class: "muted", text: "Catalogo non disponibile: serve la rete al primo avvio." }));
    return;
  }
  const argument = setId !== null ? setId : decodeURIComponent((location.hash.split("/")[2] || ""));
  if ($("searchLangs").children.length === 0) fillLangChips();
  const owned = ownedBySet();
  const text = $("searchInput").value.trim();
  $("searchLangs").hidden = Boolean(argument) && !text;
  if (text.length >= 2) renderTextResults(body, text, owned);
  else if (argument) renderSetPage(body, argument, owned);
  else renderSetGrid(body, owned);
}

$("searchInput").addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderSearch, 180);
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
      variantLabel(copyVariant(copy)),
      LANG_LABELS[copy.lang] || copy.lang,
      copy.grade_company ? `${copy.grade_company} ${copy.grade || ""}`.trim() : copy.condition,
      binderName(copy.binder_id),
    ].filter(Boolean).join(" · ");
    const unit = Prices.copyUnit(copy, card);
    const money = [
      unit ? `vale ${euro(unit.value)}${unit.source === "manual" ? " (tuo)" : unit.approx ? " (prezzo normale)" : ""}` : "senza prezzo",
      copy.purchase_price != null ? `pagata ${euro(copy.purchase_price)}${copy.purchase_date ? ` il ${shortDate(copy.purchase_date)}` : ""}` : null,
    ].filter(Boolean).join(" · ");
    const gain = unit && copy.purchase_price != null ? unit.value - copy.purchase_price : null;
    panel.appendChild(
      el("div", { class: "copy" },
        el("div", { class: "grow" },
          el("div", { text: details }),
          el("div", { class: "small" }, el("span", { class: "muted", text: money }),
            gain !== null ? el("span", { class: gain >= 0 ? "up" : "down", text: ` ${signedEuro(gain)}` }) : null),
          copy.notes ? el("div", { class: "s muted small", text: copy.notes }) : null),
        el("button", { class: "btn ghost small", text: "Valore", onclick: () => askValue(copy.manual_value, (v) => { Store.setCopyValue(copy.id, v); renderCard(card.key); }) }),
        el("div", { class: "stepper" },
          el("button", { text: "−", "aria-label": "Togli una copia", onclick: () => { Store.changeQuantity(copy.id, -1); renderCard(card.key); } }),
          el("b", { text: String(copy.quantity) }),
          el("button", { text: "+", "aria-label": "Aggiungi una copia", onclick: () => { Store.changeQuantity(copy.id, 1); renderCard(card.key); } })))
    );
  }
  return panel;
}

function addPanel(card, onLang) {
  // Every printing the catalogue lists for this card, then the plain types it does not list,
  // because the catalogue is incomplete. The first printing without a stamp is preselected:
  // a stamp such as 1st edition is never assumed.
  const known = card.variants.map(Catalogue.parseVariant);
  const types = new Set(known.map((v) => v.type));
  const extra = ["normal", "holo", "reverse"].filter((t) => !types.has(t)).map(Catalogue.parseVariant);
  const options = [...known, ...extra];
  const preselected = known.find((v) => !v.stamps.length) || known[0] || options[0];
  const variant = select(options.map((v) => [v.token, variantLabel(v)]), preselected.token);
  // The catalogue's language list for a set is incomplete (many older Italian sets are missing),
  // so the main languages are always offered. A language read by the scanner comes first.
  const langs = [...new Set([...MAIN_LANGS, ...card.set.langs])];
  const scanned = scanContext && scanContext.key === card.key ? scanContext.lang : null;
  const lang = select(langs.map((l) => [l, LANG_LABELS[l] || l]), scanned || (card.set.langs.includes("it") || !card.set.langs.length ? "it" : card.set.langs[0]));
  lang.addEventListener("change", () => onLang && onLang(lang.value));
  if (onLang) onLang(lang.value);
  const condition = select([["", "Non indicata"], ...CONDITIONS.map((c) => [c, c])], "NM");
  const binder = select([["", "Nessuno"], ...Store.binders().map((b) => [String(b.id), b.name])], selectedBinder ? String(selectedBinder) : "");
  const price = el("input", { type: "text", inputmode: "decimal", placeholder: "facoltativo" });
  const date = el("input", { type: "date", value: today() });
  // Graded copies: company and grade from the slab, and a value typed by the owner, because
  // there is no free source of graded prices.
  const gradeCompany = select([["", "No"], ...["PSA", "BGS", "CGC", "TAG", "ACE", "SGC", "GRAAD", "Altro"].map((c) => [c, c])], "");
  const grade = el("input", { type: "text", inputmode: "decimal", maxlength: "12", placeholder: "es. 9" });
  const manual = el("input", { type: "text", inputmode: "decimal", placeholder: "facoltativo" });
  const gradeFields = el("div", { class: "fields", hidden: true },
    el("label", { class: "field" }, "Voto", grade),
    el("label", { class: "field" }, "Valore (€)", manual));
  gradeCompany.addEventListener("change", () => {
    gradeFields.hidden = !gradeCompany.value;
    condition.disabled = Boolean(gradeCompany.value);
  });
  const notes = el("input", { type: "text", maxlength: "200", placeholder: "facoltative" });
  const variantHint = (card.variants.length
    ? card.variantsInferred ? "Variante dedotta dalla rarità: controlla la carta." : "Variante e versione non le decide lo scanner: controllale sulla carta (timbro 1ª edizione, holo, reverse)."
    : "Il catalogo non indica le varianti di questa carta: scegli tu.") +
    (scanned ? ` Lingua letta dalla scansione: ${LANG_LABELS[scanned] || scanned}.` : "");

  const chosen = () => Catalogue.parseVariant(variant.value);
  const add = () => {
    const paid = parseEuro(price.value);
    const value = parseEuro(manual.value);
    if (paid === undefined || value === undefined) { alert("Scrivi gli importi come 12,50."); return; }
    Store.addCopy({
      card_source_id: card.key,
      lang: lang.value,
      variant_type: chosen().type,
      variant_subtype: chosen().subtype,
      variant_stamps: chosen().stamps.join(",") || null,
      variant_foil: chosen().foil,
      variant_size: chosen().size,
      variant_confirmed: true, // the owner chose it on this form
      condition: gradeCompany.value ? null : condition.value || null,
      binder_id: binder.value ? Number(binder.value) : null,
      quantity: 1,
      purchase_price: paid,
      purchase_date: paid == null ? null : date.value || null,
      grade_company: gradeCompany.value || null,
      grade: gradeCompany.value ? grade.value.trim() || null : null,
      manual_value: gradeCompany.value ? value : null,
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
      el("label", { class: "field" }, "Data d'acquisto", date),
      el("label", { class: "field" }, "Gradata", gradeCompany),
      el("label", { class: "field" }, "Note", notes)),
    gradeFields,
    el("p", { class: "muted small", text: variantHint }),
    el("button", { class: "btn primary block", text: "Aggiungi allo scrigno", onclick: add }));
}

/**
 * The price panel of a card page: Cardmarket figures from the daily guide, a chart of the trend
 * over time, and TCGplayer (dollars) from TCGdex when the phone is online.
 */
function pricePanel(card) {
  const panel = el("div", { class: "panel prices" });
  const p = Prices.forCard(card);
  const row = (label, side) => {
    if (!side) return null;
    const head = Prices.headline(side);
    if (!head) return null;
    const extra = [side.avg30 ? `30 gg ${euro(side.avg30)}` : null, side.low ? `da ${euro(side.low)}` : null].filter(Boolean).join(" · ");
    return el("div", { class: "pricerow" },
      el("span", { class: "grow", text: label }),
      el("span", { class: "muted small", text: extra }),
      el("b", { text: euro(head.value) }));
  };
  if (p) {
    panel.append(
      el("div", { class: "muted small", text: `Cardmarket, trend del ${shortDate(p.day)}` }),
      row("Normale", p.normal),
      row("Reverse holo", p.reverse));
  } else if (!Prices.info()) {
    panel.appendChild(el("div", { class: "muted small", text: "Prezzi Cardmarket non disponibili: serve la rete." }));
  } else {
    panel.appendChild(el("div", { class: "muted small", text: card.cardmarketId
      ? "Cardmarket non quota questa carta nella guida prezzi."
      : "Il catalogo non conosce il codice Cardmarket di questa carta." }));
  }
  const chartBox = el("div");
  panel.appendChild(chartBox);
  if (p) {
    Prices.history(card.cardmarketId).then((points) => {
      const series = [
        { points: points.filter((q) => q.normal).map((q) => [Date.parse(q.date), q.normal]), cls: "main" },
        { points: points.filter((q) => q.reverse).map((q) => [Date.parse(q.date), q.reverse]), cls: "alt" },
      ];
      const chart = lineChart(series);
      if (chart) {
        chartBox.append(chart, el("div", { class: "legend small muted" }, el("span", { class: "key main" }), "normale ", el("span", { class: "key alt" }), "reverse"));
      } else {
        chartBox.appendChild(el("div", { class: "muted small", text: "L'andamento compare dal secondo giorno di prezzi." }));
      }
    });
  }
  const liveBox = el("div");
  panel.appendChild(liveBox);
  Prices.fromTcgdex(card).then((pricing) => {
    const tcg = pricing && pricing.tcgplayer;
    if (tcg) {
      const usd = (v) => v.toLocaleString("it-IT", { style: "currency", currency: "USD" });
      const names = { normal: "Normale", holofoil: "Holo", "reverse-holofoil": "Reverse holo", "1stEditionHolofoil": "1ª ed. holo", "1stEditionNormal": "1ª ed.", unlimitedHolofoil: "Unlimited holo" };
      const rows = Object.entries(tcg)
        .filter(([, v]) => v && typeof v === "object" && (v.marketPrice || v.midPrice))
        .map(([kind, v]) => el("div", { class: "pricerow" },
          el("span", { class: "grow", text: names[kind] || kind }),
          el("span", { class: "muted small", text: v.lowPrice ? `da ${usd(v.lowPrice)}` : "" }),
          el("b", { text: usd(v.marketPrice || v.midPrice) })));
      if (rows.length) liveBox.append(el("div", { class: "muted small", style: "margin-top:10px", text: "TCGplayer (USA), market price via TCGdex" }), ...rows);
    }
    if (!p && pricing && pricing.cardmarket) {
      const cm = pricing.cardmarket;
      const side = (suffix) => ({ trend: cm["trend" + suffix] || null, avg30: cm["avg30" + suffix] || null, avg7: cm["avg7" + suffix] || null, low: cm["low" + suffix] || null });
      liveBox.prepend(el("div", { class: "muted small", text: "Cardmarket via TCGdex (non entra nel valore dello scrigno)" }),
        row("Normale", side("")) || el("span"), row("Reverse holo", side("-holo")) || el("span"));
    }
  });
  return panel;
}

async function renderCard(key) {
  await Promise.all([Catalogue.load(), Prices.load()]);
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

  const scannedLang = scanContext && scanContext.key === card.key ? scanContext.lang : null;
  const { note, onImage } = imageNote(card, scannedLang);
  // Shop links follow the language chosen in the form, so Cardmarket opens on that language.
  const linkBox = el("div", { class: "links" });
  const showLinks = (lang) => {
    linkBox.innerHTML = "";
    for (const link of Catalogue.links(card, lang)) {
      linkBox.appendChild(el("a", { class: "btn", href: link.url, target: "_blank", rel: "noopener", text: link.exact ? link.label : `${link.label} (ricerca)` }));
    }
  };

  view.append(
    el("div", { class: "cardhead" },
      art(card, { big: true, quality: "high", lang: scannedLang, onImage }),
      note,
      el("h2", { text: card.name }),
      el("div", { class: "muted", text: cardLine(card) }),
      others.length ? el("div", { class: "muted small", text: others.slice(0, 6).join(" · ") }) : null),
    el("h2", { text: "Nel tuo scrigno" }),
    ownedPanel(card),
    el("h2", { text: "Aggiungi una copia" }),
    addPanel(card, showLinks),
    el("h2", { text: "Prezzi" }),
    pricePanel(card),
    linkBox,
    el("p", { class: "muted small", text: "Cardmarket si apre filtrato sulla lingua scelta qui sopra." }),
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
  Prices.load().then(() => {
    const p = Prices.info();
    $("pricesInfo").textContent = p ? `Cardmarket del ${shortDate(p.day)}, ${p.products.toLocaleString("it-IT")} prodotti` : "non disponibili";
  });
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
