// Turns OCR text lines into a card reading, and ranks catalogue cards against that reading.
// No DOM access: the same file runs in the page and in the Node tests.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HolothecaRecognize = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TOP_ZONE = 0.24; // name, stage and HP sit in the top quarter on every era
  const BOTTOM_ZONE = 0.78; // set code, collector number and copyright sit below this

  // Start of the "Evolves from ..." line in the languages of the catalogue, normalised.
  const EVOLVES_FROM = /^(evolvesfrom|sievolveda|evolutionde|entwickeltsichaus|evolucionade|evoluide|evoluciona|evolvefrom)/;

  /** Lowercase, no accents, letters and digits only. */
  function normalize(text) {
    return String(text || "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "");
  }

  /** Collector numbers compare without leading zeros and case: "090" and "90" are the same. */
  function normalizeNumber(number) {
    const text = String(number || "").toUpperCase().replace(/\s+/g, "");
    return text.replace(/^0+(?=.)/, "");
  }

  /** Letters OCR engines confuse with digits, mapped back for number matching. */
  function digitLike(text) {
    return String(text || "")
      .replace(/[OoQD]/g, "0")
      .replace(/[lI|!]/g, "1")
      .replace(/[Ss]/g, "5")
      .replace(/B/g, "8")
      .replace(/Z/g, "2");
  }

  function boxOf(line, width, height) {
    const xs = line.box.map((p) => p[0]);
    const ys = line.box.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    return {
      x: x0 / width, y: y0 / height, w: (x1 - x0) / width, h: (y1 - y0) / height,
      cx: (x0 + x1) / 2 / width, cy: (y0 + y1) / 2 / height,
    };
  }

  /**
   * Builds a reading from OCR lines. `lines` is [{ text, mean, box: [[x, y] x 4] }] in pixels
   * of an image `width` x `height` that shows the whole card.
   */
  function parse(lines, width, height) {
    const items = lines
      .filter((line) => line && line.text && line.box)
      .map((line) => ({ text: line.text.trim(), confidence: line.mean || 0, ...boxOf(line, width, height) }));

    const top = items.filter((item) => item.cy < TOP_ZONE);
    const bottom = items.filter((item) => item.cy > BOTTOM_ZONE);

    // Every top line is a name candidate: the catalogue decides which one is a real name.
    // "Evolves from X" lines name another card, so they are left out.
    const nameCandidates = top
      .map((item) => ({ text: item.text, key: normalize(item.text), height: item.h, confidence: item.confidence }))
      .filter((c) => c.key.replace(/\d/g, "").length >= 3 && !EVOLVES_FROM.test(c.key));

    // HP: a multiple of 10 between 10 and 400 in the top zone; the rightmost wins.
    let hp = null;
    for (const item of [...top].sort((a, b) => a.cx - b.cx)) {
      for (const match of item.text.matchAll(/\d{2,3}/g)) {
        const value = Number(match[0]);
        if (value >= 10 && value <= 400 && value % 10 === 0) hp = value;
      }
    }

    // Collector numbers printed as NNN/NNN, anywhere on the card; bottom lines first.
    const numbers = [];
    const ordered = [...bottom, ...items.filter((item) => item.cy <= BOTTOM_ZONE)];
    for (const item of ordered) {
      for (const match of item.text.matchAll(/([A-Z]{0,2})(\d{1,3})\s*\/\s*([A-Z]{0,2})(\d{1,3})/g)) {
        const total = Number(match[4]);
        const variants = [normalizeNumber(match[2])];
        // Subset numbering such as TG12/TG30 keeps its letters on both sides.
        if (match[3] && match[1].endsWith(match[3])) variants.unshift(match[3] + match[2]);
        for (const number of variants) {
          if (!numbers.some((n) => n.number === number && n.total === total)) {
            numbers.push({ number, total, text: item.text, bottom: item.cy > BOTTOM_ZONE });
          }
        }
      }
    }

    // Cards without a printed total (energies, promos) show "SVE 001": keep bare 3-digit groups.
    const looseNumbers = [];
    for (const item of bottom) {
      for (const match of item.text.matchAll(/(?<![\d/])\d{3}(?![\d/])/g)) {
        const number = normalizeNumber(match[0]);
        if (!looseNumbers.includes(number)) looseNumbers.push(number);
      }
    }

    const bottomText = bottom.map((item) => item.text).join(" ");
    return {
      nameCandidates,
      hp,
      numbers,
      bottomText,
      bottomKey: bottomText.toUpperCase().replace(/[^A-Z0-9]+/g, ""),
      bottomDigits: digitLike(bottomText).replace(/[^0-9/]+/g, ""),
      bottomFuzzy: digitLike(bottomText).toUpperCase().replace(/[^A-Z0-9/]+/g, ""),
      looseNumbers,
      allKeys: items.map((item) => normalize(item.text)).filter((key) => key.length >= 6),
      lines: items,
    };
  }

  function levenshtein(a, b, limit) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    let previous = new Array(b.length + 1);
    let current = new Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) previous[j] = j;
    for (let i = 1; i <= a.length; i++) {
      current[0] = i;
      let best = current[0];
      for (let j = 1; j <= b.length; j++) {
        const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
        if (current[j] < best) best = current[j];
      }
      if (best > limit) return limit + 1;
      [previous, current] = [current, previous];
    }
    return previous[b.length];
  }

  /**
   * How well a catalogue name is found inside an OCR line, 0..1. The line may carry extra
   * text ("BASE Gothita PS70"), so the name is compared with every window of its own length.
   */
  function nameSimilarity(name, line) {
    if (!name || !line) return 0;
    if (line.includes(name)) return 1;
    const limit = Math.floor(name.length * 0.34);
    if (name.length < 4) return 0; // too short to match fuzzily
    let best = limit + 1;
    if (line.length <= name.length) {
      best = levenshtein(name, line, limit);
    } else {
      for (let start = 0; start + name.length <= line.length; start++) {
        const distance = levenshtein(name, line.substr(start, name.length), limit);
        if (distance < best) best = distance;
        if (best === 0) break;
      }
    }
    return best > limit ? 0 : 1 - best / name.length;
  }

  /** Prepares lookup tables once after the index file is loaded. */
  function prepareIndex(raw) {
    const nameKeys = raw.names.map(normalize);
    const byNumber = new Map();
    const byName = new Map();
    raw.cards.forEach((card, cardIndex) => {
      const key = normalizeNumber(card[1]);
      if (!byNumber.has(key)) byNumber.set(key, []);
      byNumber.get(key).push(cardIndex);
      for (const nameIndex of card[3]) {
        if (!byName.has(nameIndex)) byName.set(nameIndex, []);
        byName.get(nameIndex).push(cardIndex);
      }
    });
    const bySet = new Map();
    raw.cards.forEach((card, cardIndex) => {
      if (!bySet.has(card[0])) bySet.set(card[0], []);
      bySet.get(card[0]).push(cardIndex);
    });
    const illustratorKeys = (raw.illustrators || []).map(normalize);
    return { raw, nameKeys, byNumber, byName, bySet, illustratorKeys };
  }

  /** True when the bottom digits hold "<number><one stray char or slash><total>", e.g. 541144 for 54/144. */
  function digitsHold(bottomDigits, number, total) {
    if (!/^\d+$/.test(number) || !total) return false;
    const padded = [number, number.padStart(3, "0")];
    return padded.some((n) => new RegExp(`${n}[0-9/]?${total}`).test(bottomDigits));
  }

  /** Like digitsHold, but one character of the number may be misread, e.g. 5A1144 for 54/144. */
  function digitsNearlyHold(bottomFuzzy, number, total) {
    if (!/^\d{2,}$/.test(number) || !total) return false;
    for (const n of new Set([number, number.padStart(3, "0")])) {
      for (let i = 0; i < n.length; i++) {
        const pattern = n.slice(0, i) + "[A-Z0-9]" + n.slice(i + 1);
        if (new RegExp(`${pattern}[A-Z0-9/]?${total}`).test(bottomFuzzy)) return true;
      }
    }
    return false;
  }

  /**
   * Ranks catalogue cards against a reading. Returns the best `limit` candidates with the
   * evidence behind each score, best first. The caller always confirms by hand.
   */
  function match(index, reading, limit = 5) {
    const { raw, nameKeys, byNumber, byName, bySet, illustratorKeys } = index;
    const scores = new Map(); // card index -> { similarity, nameIndex }

    // 1. Cards whose name appears in a top line.
    const lines = reading.nameCandidates.map((c) => c.key);
    nameKeys.forEach((key, nameIndex) => {
      if (key.length < 3) return;
      let best = 0;
      for (const line of lines) {
        const similarity = nameSimilarity(key, line);
        if (similarity > best) best = similarity;
      }
      if (best < 0.75) return;
      // Longer names are stronger evidence than short ones found inside a longer line,
      // and an approximate match counts much less than an exact one.
      const weight = best * best * Math.min(1, 0.6 + key.length / 20);
      for (const cardIndex of byName.get(nameIndex) || []) {
        const known = scores.get(cardIndex);
        if (!known || known.similarity < weight) scores.set(cardIndex, { similarity: weight, exact: best >= 0.99, nameIndex });
      }
    });

    // 2. Cards with a read collector number and matching printed total.
    for (const entry of reading.numbers) {
      for (const cardIndex of byNumber.get(entry.number) || []) {
        const official = raw.sets[raw.cards[cardIndex][0]][2];
        if (official === entry.total && !scores.has(cardIndex)) scores.set(cardIndex, { similarity: 0 });
      }
    }

    // 3. Cards of a set whose printed code was read, with a bare number ("SVE 001").
    const codeSets = [];
    raw.sets.forEach((set, setIndex) => {
      if (set[1] && set[1].length >= 3 && reading.bottomKey.includes(set[1].toUpperCase())) codeSets.push(setIndex);
    });
    for (const setIndex of codeSets) {
      for (const cardIndex of bySet.get(setIndex) || []) {
        if (reading.looseNumbers.includes(normalizeNumber(raw.cards[cardIndex][1])) && !scores.has(cardIndex)) {
          scores.set(cardIndex, { similarity: 0 });
        }
      }
    }

    // A cleanly read "NNN/NNN" on the bottom line is trusted: no card gets credit for a
    // near miss of it. Fuzzy digit matching is only for numbers the reader garbled.
    const cleanRead = reading.numbers.some((n) => n.bottom);

    const results = [];
    for (const [cardIndex, found] of scores) {
      const card = raw.cards[cardIndex];
      const set = raw.sets[card[0]];
      const number = normalizeNumber(card[1]);
      const official = set[2];
      const codeRead = codeSets.includes(card[0]);
      const evidence = [];
      let score = 0;

      if (found.similarity > 0) {
        score += 0.45 * found.similarity;
        evidence.push(found.exact ? "name" : "name~");
      }
      if (reading.numbers.some((n) => n.number === number && n.total === official)) {
        score += 0.4;
        evidence.push("number/total");
      } else if (!cleanRead && digitsHold(reading.bottomDigits, number, official)) {
        score += 0.3;
        evidence.push("number/total~");
      } else if (codeRead && reading.looseNumbers.includes(number)) {
        score += 0.3;
        evidence.push("number");
      } else if (!cleanRead && digitsNearlyHold(reading.bottomFuzzy, number, official)) {
        score += 0.2;
        evidence.push("number/total~~");
      } else if (reading.numbers.some((n) => n.number === number)) {
        score += 0.12;
        evidence.push("number");
      } else if (reading.numbers.some((n) => n.total === official)) {
        score += 0.08;
        evidence.push("total");
      } else if (official >= 100 && reading.bottomDigits.includes(String(official))) {
        score += 0.04;
        evidence.push("total~");
      }
      if (reading.hp && card[2] === reading.hp) {
        score += 0.1;
        evidence.push("hp");
      }
      if (codeRead) {
        score += 0.08;
        evidence.push("set code");
      }
      const illustrator = card[4] === undefined || card[4] < 0 ? "" : illustratorKeys[card[4]];
      if (illustrator && illustrator.length >= 6 && reading.allKeys.some((key) => nameSimilarity(illustrator, key) >= 0.7)) {
        score += 0.1;
        evidence.push("illustrator");
      }
      const names = card[3].map((i) => raw.names[i]);
      results.push({
        cardIndex,
        score: Math.min(1, score),
        evidence,
        setId: set[0],
        setCode: set[1],
        setName: set[3],
        official,
        number: card[1],
        hp: card[2],
        name: found.nameIndex === undefined ? names[0] : raw.names[found.nameIndex],
        names,
      });
    }
    results.sort((a, b) => b.score - a.score || (b.setId < a.setId ? 1 : -1));
    return results.slice(0, limit);
  }

  return { parse, match, prepareIndex, normalize, normalizeNumber, nameSimilarity, digitLike };
});
