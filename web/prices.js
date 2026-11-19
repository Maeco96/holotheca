// Card and sealed product prices.
//
// - data/prices.json: today's Cardmarket price guide for the catalogue cards and the sealed
//   products, built at deploy by etl/prices/cardmarket_prices.py from the file Cardmarket
//   publishes for its users. Prices are euro cents; see FIELDS.
// - data/prices-h/NNN.json: the price history, one bucket per (product id % buckets).
// - TCGdex live (api.tcgdex.net, open, CORS allowed): asked only when a card page is opened, for
//   the TCGplayer price in dollars and as a fallback when the guide has no price for the card.
// Nothing about the collection is sent anywhere: the phone downloads whole files and looks up.
const Prices = (() => {
  "use strict";

  // Keep in step with FIELDS in etl/prices/cardmarket_prices.py.
  const FIELDS = ["trend", "avg30", "avg7", "low", "trend-holo", "avg30-holo", "avg7-holo", "low-holo"];
  const at = (name) => FIELDS.indexOf(name);
  let promise = null;
  let data = null;
  let ct = null; // data/cardtrader.json: offers by language and condition, keyed by Cardmarket id
  const histories = new Map(); // bucket -> promise
  const live = new Map(); // tcgdex id -> promise

  function absolute(path) {
    return new URL(path, document.baseURI).href;
  }

  /** Loads today's prices once. Resolves to the data, or null when this deployment has none. */
  function load() {
    if (!promise) {
      promise = fetch(absolute("data/prices.json"))
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((raw) => {
          data = raw;
          return fetch(absolute("data/cardtrader.json"))
            .then((response) => (response.ok ? response.json() : null))
            .catch(() => null)
            .then((offers) => { ct = offers && offers.p ? offers : null; return raw; });
        })
        .catch((e) => {
          promise = null;
          console.warn("prices not available:", e.message);
          return null;
        });
    }
    return promise;
  }

  function info() {
    return data ? {
      day: data.day, products: Object.keys(data.p).length, sealed: data.sealed.length,
      cardtrader: ct ? { day: ct.day, cards: Object.keys(ct.p).length } : null,
    } : null;
  }

  /** Cardmarket expansion id of a card, for a search narrowed to its expansion. */
  function cardmarketExpansion(card) {
    return data && data.x && card && card.cardmarketId ? data.x[String(card.cardmarketId)] || null : null;
  }

  // ---------- CardTrader: offers by language and condition ----------

  // App condition (Cardmarket grades) -> index in CardTrader's list, best first:
  // Mint, Near Mint, Slightly Played, Moderately Played, Played, Heavily Played, Poor.
  const CT_CONDITION = { MT: 0, NM: 1, EX: 2, GD: 3, LP: 4, PL: 5, PO: 6 };
  const CT_SHORT = ["M", "NM", "SP", "MP", "PL", "HP", "PO"];
  const CT_LANG = { jp: "ja", kr: "ko", tw: "zh-tw", "zh-hant": "zh-tw", cn: "zh-cn", "zh-hans": "zh-cn" };
  const ctLang = (code) => CT_LANG[code] || code;

  /** CardTrader data of a card: { blueprint, day, offers: [{lang, condition, reverse, first, price, count}] }. */
  function cardtrader(card) {
    if (!ct || !card || !card.cardmarketId) return null;
    const entry = ct.p[String(card.cardmarketId)];
    if (!entry) return null;
    return {
      blueprint: entry.b,
      day: ct.day,
      offers: entry.o.map(([lang, condition, reverse, first, cents, count]) => ({
        lang: ctLang(lang), condition, conditionLabel: CT_SHORT[condition] || "?", reverse: Boolean(reverse),
        first: Boolean(first), price: cents / 100, count,
      })),
    };
  }

  function blueprintOf(card) {
    const data = cardtrader(card);
    return data ? data.blueprint : null;
  }

  /**
   * The CardTrader offer that best matches a copy: same language, reverse and 1st edition; the
   * same condition when someone sells it, else the nearest one (better first). null when the
   * language has no offer at all.
   */
  function matchOffer(copy, card) {
    const data = cardtrader(card);
    if (!data) return null;
    const first = String(copy.variant_stamps || "").includes("1st-edition");
    const candidates = data.offers.filter((o) => o.lang === copy.lang && o.reverse === isReverse(copy) && o.first === first);
    if (!candidates.length) return null;
    const wanted = CT_CONDITION[copy.condition] ?? 1;
    candidates.sort((a, b) => (Math.abs(a.condition - wanted) - Math.abs(b.condition - wanted)) || (a.condition - b.condition) || (a.price - b.price));
    const best = candidates[0];
    return { ...best, exact: best.condition === wanted, day: data.day };
  }

  const euros = (value) => (value === null || value === undefined ? null : value / 100);

  /** Prices of a Cardmarket product as { normal: {trend, avg30, avg7, low}, reverse: {...}, day } in euro. */
  function forProduct(id) {
    if (!data || !id) return null;
    const row = data.p[String(id)];
    if (!row) return null;
    const pick = (suffix) => ({
      trend: euros(row[at("trend" + suffix)]),
      avg30: euros(row[at("avg30" + suffix)]),
      avg7: euros(row[at("avg7" + suffix)]),
      low: euros(row[at("low" + suffix)]),
    });
    const reverse = pick("-holo");
    return {
      id,
      day: data.day,
      normal: pick(""),
      reverse: Object.values(reverse).some((v) => v !== null) ? reverse : null,
    };
  }

  function forCard(card) {
    return card ? forProduct(card.cardmarketId) : null;
  }

  /** The figure used as value: the trend, else the 30-day average, else the 7-day one. */
  function headline(side) {
    if (!side) return null;
    for (const name of ["trend", "avg30", "avg7"]) if (side[name]) return { value: side[name], basis: name };
    return null;
  }

  function isReverse(copy) {
    return copy.variant_type === "reverse";
  }

  /**
   * Value of one unit of an owned copy, as { value, source, approx } or null when unknown.
   * A value typed by the owner wins (graded copies have no free price source). A reverse holo
   * takes the foil price; when the guide has none it falls back to the normal one, marked approx.
   */
  function copyUnit(copy, card) {
    if (copy.manual_value !== null && copy.manual_value !== undefined) return { value: copy.manual_value, source: "manual" };
    if (copy.grade_company) return null;
    const offer = matchOffer(copy, card);
    if (offer) {
      return { value: offer.price, source: "cardtrader", offer, approx: !offer.exact };
    }
    const p = forCard(card);
    if (!p) return null;
    if (isReverse(copy)) {
      const r = headline(p.reverse);
      if (r) return { value: r.value, source: "cardmarket", basis: r.basis };
      const n = headline(p.normal);
      return n ? { value: n.value, source: "cardmarket", basis: n.basis, approx: true } : null;
    }
    const n = headline(p.normal);
    return n ? { value: n.value, source: "cardmarket", basis: n.basis } : null;
  }

  function sealedUnit(item) {
    if (item.manual_value !== null && item.manual_value !== undefined) return { value: item.manual_value, source: "manual" };
    const p = forProduct(item.cardmarket_id);
    const n = p && headline(p.normal);
    return n ? { value: n.value, source: "cardmarket", basis: n.basis } : null;
  }

  /** Sealed products of the guide as {id, name, category, expansion, added}. */
  function sealed() {
    return data ? data.sealed.map(([id, name, category, expansion, added]) => ({ id, name, category, expansion, added })) : [];
  }

  function searchSealed(text, limit = 40) {
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const out = [];
    for (const item of sealed()) {
      const name = item.name.toLowerCase();
      if (words.every((w) => name.includes(w))) out.push(item);
      if (out.length >= limit) break;
    }
    return out;
  }

  function sealedById(id) {
    if (!data) return null;
    const row = data.sealed.find((r) => r[0] === id);
    return row ? { id: row[0], name: row[1], category: row[2], expansion: row[3], added: row[4] } : null;
  }

  /** History of a product as [{ date, normal, reverse }] in euro, oldest first. */
  function history(id) {
    if (!data || !id) return Promise.resolve([]);
    const bucket = Number(id) % (data.buckets || 256);
    if (!histories.has(bucket)) {
      const name = String(bucket).padStart(3, "0");
      histories.set(bucket, fetch(absolute(`data/prices-h/${name}.json`))
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null));
    }
    return histories.get(bucket).then((file) => {
      if (!file) { histories.delete(bucket); return []; }
      const series = file.series[String(id)];
      if (!series) return [];
      return file.dates
        .map((date, i) => ({ date, normal: series[i] ? euros(series[i][0]) : null, reverse: series[i] ? euros(series[i][1]) : null }))
        .filter((p) => p.normal !== null || p.reverse !== null);
    });
  }

  /**
   * Live prices from TCGdex for a card page: { cardmarket, tcgplayer } as TCGdex returns them,
   * or null offline. Only catalogue cards that come from TCGdex have an id there.
   */
  function fromTcgdex(card, lang) {
    if (!card || !card.set.source || card.set.seriesSource === "official") return Promise.resolve(null);
    const langs = card.set.langs || [];
    const apiLang = langs.includes(lang) ? lang : langs.includes("en") ? "en" : langs[0] || "en";
    const id = `${card.set.source}-${card.number}`;
    const key = `${apiLang}/${id}`;
    if (!live.has(key)) {
      live.set(key, fetch(`https://api.tcgdex.net/v2/${apiLang}/cards/${encodeURIComponent(id)}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((json) => (json && json.pricing ? json.pricing : null))
        .catch(() => { live.delete(key); return null; }));
    }
    return live.get(key);
  }

  return { load, info, cardmarketExpansion, cardtrader, blueprintOf, matchOffer, CT_SHORT, forProduct, forCard, headline, copyUnit, sealedUnit, sealed, searchSealed, sealedById, history, fromTcgdex };
})();
