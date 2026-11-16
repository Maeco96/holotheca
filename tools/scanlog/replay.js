#!/usr/bin/env node
// Replays an exported scan log (Altro > Registro delle letture > Esporta) against a card index
// and measures how often the right card comes first. The OCR lines stored in the log are fed
// to the current web/recognize.js, so a matching change can be measured on the same readings
// before it reaches the phone.
//
// Usage:
//   node tools/scanlog/replay.js LOG.json INDEX.json [--labels LABELS.json] [--photos DIR]
//                                [--json OUT.json] [--verbose]
//
//   LOG.json     the exported file (scrinium-letture-YYYY-MM-DD.json)
//   INDEX.json   web/data/scan-index.json, built by etl/export_scan_index.py
//   --labels     {"<reading id>": "<card key>" | "skip"}: the right card for readings where the
//                owner picked none, or a correction of a wrong pick; "skip" drops a reading
//                (blurred photo, not a card, duplicate)
//   --photos     writes each reading's photo to DIR/<id>.jpg, for labelling by eye
//   --json       writes the per-reading results for diffing two runs
//   --verbose    prints every reading, not only the failures
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const R = require("../../web/recognize.js");

const CONFIDENT_SCORE = 0.75; // same rule as showScan() in web/app.js
const CONFIDENT_GAP = 0.15;
const DEPTH = 50; // how far down the ranking the right card is looked for

function parseArgs(argv) {
  const args = { positional: [], verbose: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--labels" || a === "--photos" || a === "--json") args[a.slice(2)] = argv[++i];
    else if (a === "--verbose") args.verbose = true;
    else args.positional.push(a);
  }
  if (args.positional.length !== 2) {
    console.error("usage: replay.js LOG.json INDEX.json [--labels L.json] [--photos DIR] [--json OUT.json] [--verbose]");
    process.exit(2);
  }
  return args;
}

/** OCR lines as recognize.parse() takes them, rebuilt from the normalised boxes in the log. */
function linesOf(reading) {
  return (reading.lines || []).map((l) => ({
    text: l.text,
    mean: l.confidence,
    box: [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]],
  }));
}

function keyOf(raw, cardIndex) {
  const card = raw.cards[cardIndex];
  return `${raw.sets[card[0]][0]}-${card[1]}`;
}

function isConfident(candidates) {
  const [best, second] = candidates;
  return Boolean(best) && best.score >= CONFIDENT_SCORE && (!second || best.score - second.score >= CONFIDENT_GAP);
}

/** Why the right card was missed, read from the evidence: helps group the failures. */
function diagnose(result, truthEvidence) {
  if (result.rank === 1) return "ok";
  if (!result.lines) return "no text read";
  if (result.truthInCatalogue === false) return "card not in index";
  if (result.rank === null) {
    if (!result.readNumbers && !result.readName) return "nothing usable read";
    return "right card not proposed";
  }
  if (!truthEvidence.some((e) => e.startsWith("number"))) return result.readNumbers ? "number misread" : "number not read";
  if (!truthEvidence.some((e) => e.startsWith("name"))) return "name not matched";
  return "outranked";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const log = JSON.parse(fs.readFileSync(args.positional[0], "utf8"));
  if (log.kind !== "scrinium-scan-log") throw new Error("not a scrinium scan log");
  const raw = JSON.parse(fs.readFileSync(args.positional[1], "utf8"));
  const index = R.prepareIndex(raw);
  const keys = new Set(raw.cards.map((_, i) => keyOf(raw, i)));
  const labels = args.labels ? JSON.parse(fs.readFileSync(args.labels, "utf8")) : {};

  if (args.photos) fs.mkdirSync(args.photos, { recursive: true });

  const results = [];
  for (const reading of log.readings) {
    const id = String(reading.id);
    if (args.photos && reading.photo) {
      const data = reading.photo.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(path.join(args.photos, `${id}.jpg`), Buffer.from(data, "base64"));
    }
    const label = labels[id];
    if (label === "skip") continue;
    const truth = label || (reading.chosen && reading.chosen !== "none" ? reading.chosen : null);

    const parsed = R.parse(linesOf(reading), 1, 1);
    const candidates = R.match(index, parsed, DEPTH);
    const ranked = candidates.map((c) => `${c.setId}-${c.number}`);
    const position = truth ? ranked.indexOf(truth) : -1;
    const truthCandidate = position >= 0 ? candidates[position] : null;
    const result = {
      id,
      at: reading.at,
      version: reading.version,
      truth,
      truthKnown: Boolean(truth),
      truthInCatalogue: truth ? keys.has(truth) : null,
      rank: position >= 0 ? position + 1 : null,
      confident: isConfident(candidates),
      lines: (reading.lines || []).length,
      readName: parsed.nameCandidates.map((c) => c.text),
      readNumbers: parsed.numbers.map((n) => `${n.number}/${n.total}`).join(", "),
      bottom: parsed.bottomText,
      hp: parsed.hp,
      sharpness: reading.sharpness,
      top: candidates.slice(0, 3).map((c) => ({ key: `${c.setId}-${c.number}`, name: c.name, score: Math.round(c.score * 100) / 100, evidence: c.evidence })),
      truthScore: truthCandidate ? Math.round(truthCandidate.score * 100) / 100 : null,
      truthEvidence: truthCandidate ? truthCandidate.evidence : [],
      loggedTop: (reading.candidates || [])[0]?.key ?? null,
    };
    result.readName = result.readName.length ? result.readName : null;
    result.readNumbers = result.readNumbers || null;
    result.diagnosis = truth ? diagnose(result, result.truthEvidence) : "no answer";
    results.push(result);
  }

  report(results, log, raw, args.verbose);
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(results, null, 1));
}

function pct(n, d) {
  return d ? `${((100 * n) / d).toFixed(1)}%` : "-";
}

function report(results, log, raw, verbose) {
  const known = results.filter((r) => r.truthKnown);
  const top1 = known.filter((r) => r.rank === 1).length;
  const top5 = known.filter((r) => r.rank !== null && r.rank <= 5).length;
  const confident = known.filter((r) => r.confident);
  const confidentWrong = confident.filter((r) => r.rank !== 1).length;
  const notInCatalogue = known.filter((r) => r.truthInCatalogue === false).length;

  console.log(`log: ${log.readings.length} readings, app ${log.version}, exported ${log.exported_at}`);
  console.log(`index: ${raw.cards.length} cards, TCGdex ${String(raw.tcgdex_revision || "?").slice(0, 8)}; phone catalogue ${String(log.catalogue?.revision || "?").slice(0, 8)}`);
  console.log(`measured: ${known.length} readings with a known right card (${results.length - known.length} without an answer)`);
  console.log(`  right card first:        ${top1}  ${pct(top1, known.length)}`);
  console.log(`  right card in first 5:   ${top5}  ${pct(top5, known.length)}`);
  console.log(`  shown as "Trovata":      ${confident.length}  ${pct(confident.length, known.length)}, of which wrong: ${confidentWrong}`);
  if (notInCatalogue) console.log(`  right card not in index: ${notInCatalogue}`);

  const groups = new Map();
  for (const r of known) groups.set(r.diagnosis, (groups.get(r.diagnosis) || 0) + 1);
  console.log("by outcome:");
  for (const [k, v] of [...groups].sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(26)} ${v}`);

  const shown = verbose ? results : results.filter((r) => r.truthKnown ? r.rank !== 1 || (r.confident && r.rank !== 1) : true);
  if (shown.length) console.log(verbose ? "\nall readings:" : "\nreadings to look at:");
  for (const r of shown) {
    console.log(`\n#${r.id}  [${r.diagnosis}]  truth ${r.truth || "?"}  rank ${r.rank ?? "-"}${r.truthScore !== null ? ` (${r.truthScore} ${r.truthEvidence.join("+")})` : ""}`);
    console.log(`  read: name ${JSON.stringify(r.readName)}  number ${r.readNumbers || "-"}  hp ${r.hp ?? "-"}  sharp ${r.sharpness ?? "-"}`);
    console.log(`  bottom: ${JSON.stringify(r.bottom)}`);
    for (const c of r.top) console.log(`  -> ${c.key.padEnd(18)} ${String(c.score).padEnd(5)} ${c.name}  [${c.evidence.join("+")}]`);
  }
}

main();
