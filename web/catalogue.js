// Read access to the card index built by etl/export_scan_index.py (web/data/scan-index.json).
// Depends on recognize.js for text normalisation.
const Catalogue = (() => {
  "use strict";

  const CATEGORY = { P: "Pokémon", T: "Allenatore", E: "Energia" };
  const IMAGE_LANG_ORDER = ["it", "en", "fr", "de", "es", "pt", "ja", "zh-tw", "ko", "th", "id", "zh-cn"];
  let promise = null;
  let index = null; // prepared index, see HolothecaRecognize.prepareIndex
  let byKey = null;
  // Images on the official card sites (Japan, Korea, Taiwan) for cards TCGdex has no picture
  // of, built by etl/sources/compare.py. Loaded from the official site, never copied here.
  let official = null; // { prefix: {lang: url}, cards: {key: {lang: path}} }
  const OFFICIAL_SITES = { ja: "pokemon-card.com", ko: "pokemoncard.co.kr", "zh-tw": "asia.pokemon-card.com", it: "Pokémon Central (wiki, CC BY-NC-SA)" };

  function absolute(path) {
    return new URL(path, document.baseURI).href;
  }

  /** Loads the index once. Resolves to the prepared index, or null when it is not available. */
  function load() {
    if (!promise) {
      promise = fetch(absolute("data/scan-index.json"))
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((raw) => {
          loadOfficial();
          index = HolothecaRecognize.prepareIndex(raw);
          byKey = new Map();
          raw.cards.forEach((card, i) => byKey.set(`${raw.sets[card[0]][0]}-${card[1]}`, i));
          return index;
        })
        .catch((e) => {
          promise = null;
          console.warn("card index not available:", e.message);
          return null;
        });
    }
    return promise;
  }

  /** The official image map is optional: without it the app shows TCGdex images only. */
  function loadOfficial() {
    return fetch(absolute("data/official-images.json"))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => { official = data && data.cards ? data : null; })
      .catch(() => { official = null; });
  }

  function officialImages(key) {
    const entry = official && official.cards[key];
    if (!entry) return [];
    return Object.entries(entry).map(([lang, path]) => ({
      lang,
      url: /^https?:/.test(path) ? path : (official.prefix[lang] || "") + path,
      official: OFFICIAL_SITES[lang] || true,
    }));
  }

  function info() {
    if (!index) return null;
    const raw = index.raw;
    return { cards: raw.cards.length, sets: raw.sets.length, revision: raw.tcgdex_revision, builtAt: raw.built_at };
  }

  /** A card as an object. `cardIndex` is the position in the index. */
  function card(cardIndex) {
    const raw = index.raw;
    const row = raw.cards[cardIndex];
    if (!row) return null;
    const set = raw.sets[row[0]];
    const kinds = row[10] || "";
    return {
      index: cardIndex,
      key: `${set[0]}-${row[1]}`,
      name: raw.names[row[3][0]] || "?",
      names: row[3].map((i) => raw.names[i]),
      number: row[1],
      hp: row[2] || null,
      illustrator: row[4] >= 0 ? raw.illustrators[row[4]] : null,
      rarity: row[5] >= 0 ? raw.rarities[row[5]] : null,
      category: CATEGORY[row[6]] || null,
      cardmarketId: row[7] || null,
      tcgplayerId: row[8] || null,
      cardtraderId: row[9] || null,
      // Every printing the catalogue knows, as "type:subtype:stamps:foil:size" (see parseVariant).
      variants: kinds.replace("?", "").split(",").filter(Boolean),
      variantsInferred: kinds.endsWith("?"),
      set: {
        id: set[0], code: set[1], official: set[2], name: set[3], releaseDate: set[4],
        langs: set[5] || [], seriesSource: set[6], source: set[7],
      },
    };
  }

  function cardByKey(key) {
    if (!index || !byKey.has(key)) return null;
    return card(byKey.get(key));
  }

  /**
   * Images to try in order, as [{ url, lang }]: the wanted language first, then Italian,
   * English and the set's other languages. The picture is a reference for the card, not for
   * the exact printing: the source keeps one image per card and language.
   */
  function images(c, quality = "low", preferred = null) {
    const pattern = index.raw.image_url_pattern;
    if (!pattern || !c.set.seriesSource) return [];
    const langs = IMAGE_LANG_ORDER.filter((lang) => c.set.langs.includes(lang));
    if (preferred && langs.includes(preferred)) langs.unshift(...langs.splice(langs.indexOf(preferred), 1));
    const tcgdex = langs.map((lang) => ({
      lang,
      url: pattern
        .replace("{lang}", lang)
        .replace("{serie}", encodeURIComponent(c.set.seriesSource))
        .replace("{set}", encodeURIComponent(c.set.source))
        .replace("{number}", encodeURIComponent(c.number)) + `/${quality}.webp`,
    }));
    // An official image goes right after the TCGdex image of the same language, so the
    // wanted language is tried on both sources before falling back to another language.
    const extra = officialImages(c.key);
    if (!extra.length) return tcgdex;
    const out = [];
    const placed = new Set();
    for (const image of tcgdex) {
      out.push(image);
      for (const o of extra) if (o.lang === image.lang && !placed.has(o)) { out.push(o); placed.add(o); }
    }
    const rest = extra.filter((o) => !placed.has(o));
    const wanted = rest.filter((o) => o.lang === preferred);
    return [...wanted, ...out, ...rest.filter((o) => o.lang !== preferred)];
  }

  /** One printing from its index token "type:subtype:stamps:foil:size". */
  function parseVariant(token) {
    const [type = "normal", subtype = "", stamps = "", foil = "", size = ""] = String(token || "normal").split(":");
    return { token: String(token || "normal"), type: type || "normal", subtype: subtype || null, stamps: stamps ? stamps.split("+") : [], foil: foil || null, size: size || null };
  }

  // Cardmarket's language filter on a product page.
  const CARDMARKET_LANGUAGE = { en: 1, fr: 2, de: 3, es: 4, it: 5, "zh-cn": 6, ja: 7, pt: 8, ru: 9, ko: 10, "zh-tw": 11 };

  /** Marketplace pages. Product pages when the catalogue knows the id, else a name search. */
  function links(c, lang = null) {
    const query = encodeURIComponent(`${c.name} ${c.number}`);
    const language = CARDMARKET_LANGUAGE[lang] ? `&language=${CARDMARKET_LANGUAGE[lang]}` : "";
    return [
      {
        label: "Cardmarket",
        url: c.cardmarketId
          ? `https://www.cardmarket.com/it/Pokemon/Products?idProduct=${c.cardmarketId}${language}`
          : `https://www.cardmarket.com/it/Pokemon/Products/Search?searchString=${encodeURIComponent(c.name)}${language}`,
        exact: Boolean(c.cardmarketId),
      },
      {
        label: "TCGplayer",
        url: c.tcgplayerId
          ? `https://www.tcgplayer.com/product/${c.tcgplayerId}`
          : `https://www.tcgplayer.com/search/pokemon/product?q=${query}`,
        exact: Boolean(c.tcgplayerId),
      },
      c.cardtraderId
        ? { label: "CardTrader", url: `https://www.cardtrader.com/cards/${c.cardtraderId}`, exact: true }
        : null,
    ].filter(Boolean);
  }

  /**
   * Search by name in any language, optionally with a number: "gothitelle", "eevee 54", "92/193".
   * Newest sets first.
   */
  function search(text, limit = 60) {
    if (!index) return [];
    const raw = index.raw;
    const numberMatch = text.match(/(\d{1,3})\s*(?:\/\s*(\d{1,3}))?\s*$/);
    const words = HolothecaRecognize.normalize(text.replace(/\d+\s*(\/\s*\d+)?\s*$/, ""));
    const wantedNumber = numberMatch ? HolothecaRecognize.normalizeNumber(numberMatch[1]) : null;
    const wantedTotal = numberMatch && numberMatch[2] ? Number(numberMatch[2]) : null;
    if (words.length < 2 && !wantedNumber) return [];

    let pool;
    if (words.length >= 2) {
      const set = new Set();
      index.nameKeys.forEach((key, nameIndex) => {
        if (key.includes(words)) for (const i of index.byName.get(nameIndex) || []) set.add(i);
      });
      pool = [...set];
    } else {
      pool = index.byNumber.get(wantedNumber) || [];
    }
    const found = pool.filter((i) => {
      const row = raw.cards[i];
      if (wantedNumber && HolothecaRecognize.normalizeNumber(row[1]) !== wantedNumber) return false;
      if (wantedTotal && raw.sets[row[0]][2] !== wantedTotal) return false;
      return true;
    });
    found.sort((a, b) => {
      const da = raw.sets[raw.cards[a][0]][4] || "";
      const db = raw.sets[raw.cards[b][0]][4] || "";
      return da < db ? 1 : da > db ? -1 : a - b;
    });
    return found.slice(0, limit).map(card);
  }

  return { load, info, card, cardByKey, images, parseVariant, links, search, prepared: () => index };
})();
