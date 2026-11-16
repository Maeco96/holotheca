// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const R = require("../web/recognize.js");

// A tiny index in the layout written by etl/export_scan_index.py.
const index = R.prepareIndex({
  names: ["Gothita", "Mollimorba", "Eevee", "Evoli", "Super Rod", "Canna da pesca super", "Grass Energy", "Tropius"],
  illustrators: ["Sumiyoshi Kizuki", "Toyste Beach"],
  sets: [
    ["sv02", "PAL", 193, "Paldea Evolved", "2023-06-09", ["en", "it"]],
    ["ecard3", null, 144, "Skyridge", "2003-05-12", ["en"]],
    ["sve", "SVE", null, "Scarlet & Violet Energies", "2023-03-31", ["en"]],
    ["xy3", "FFI", 111, "Furious Fists", "2014-08-13", ["en"]],
  ],
  cards: [
    [0, "090", 70, [0, 1], -1],
    [0, "188", 0, [4, 5], 1],
    [0, "276", 0, [4, 5], 1],
    [0, "195", 110, [7], -1],
    [0, "007", 110, [7], -1],
    [1, "54", 50, [2, 3], 0],
    [3, "80", 50, [2, 3], -1],
    [2, "001", 0, [6], -1],
  ],
});

// Lines as the OCR engine returns them: text, confidence and a four-point box in pixels.
function line(text, x, y, w = 300, h = 40) {
  return { text, mean: 0.95, box: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] };
}
const W = 1000;
const H = 1400;

function best(lines) {
  const reading = R.parse(lines, W, H);
  return { reading, candidates: R.match(index, reading, 5) };
}

test("modern card: name, HP, number and set code read cleanly", () => {
  const { reading, candidates } = best([
    line("BASE Gothita P70", 60, 70),
    line("Ondamistero 20", 300, 950),
    line("GPALn090/193", 60, 1300),
  ]);
  assert.strictEqual(reading.hp, 70);
  assert.deepStrictEqual(reading.numbers.map((n) => `${n.number}/${n.total}`), ["90/193"]);
  assert.strictEqual(`${candidates[0].setId}-${candidates[0].number}`, "sv02-090");
  assert.deepStrictEqual(candidates[0].evidence, ["name", "number/total", "hp", "set code"]);
});

test("letters glued to the number are not taken as part of it", () => {
  const { reading } = best([line("GPALI188/193", 60, 1300)]);
  assert.deepStrictEqual(reading.numbers.map((n) => `${n.number}/${n.total}`), ["188/193"]);
});

test("same name printed twice in a set: the number decides", () => {
  const { candidates } = best([
    line("Strumento ALLENATORE", 60, 40),
    line("Canna da pesca suner", 60, 110),
    line("GPALI188/193", 60, 1300),
  ]);
  assert.strictEqual(candidates[0].number, "188");
  assert.strictEqual(candidates[0].name, "Canna da pesca super");
  assert.ok(candidates[0].score - candidates[1].score > 0.2);
});

test("secret rare numbered above the set total", () => {
  const { candidates } = best([line("seTropius 110", 60, 70), line("GPAL#195/193", 60, 1300)]);
  assert.strictEqual(candidates[0].number, "195");
});

test("old card with a badly read number: digits, HP and illustrator still find it", () => {
  const { reading, candidates } = best([
    line("Eevee 50HP*", 60, 60),
    line("2003 Pokemon/Nintond us. SunNyoshi Kizuid 541144.0", 200, 1250, 600),
  ]);
  assert.deepStrictEqual(reading.numbers, []);
  assert.strictEqual(`${candidates[0].setId}-${candidates[0].number}`, "ecard3-54");
  assert.ok(candidates[0].evidence.includes("number/total~"));
  assert.ok(candidates[0].evidence.includes("illustrator"));
});

test("card without a printed total: set code plus bare number", () => {
  const { reading, candidates } = best([line("Energia base ENERGIA", 60, 60), line("SVEI 001", 60, 1300)]);
  assert.deepStrictEqual(reading.looseNumbers, ["1"]);
  assert.strictEqual(`${candidates[0].setId}-${candidates[0].number}`, "sve-001");
});

test("evolves-from line and near-miss numbers do not promote the wrong card", () => {
  const small = R.prepareIndex({
    names: ["Gothitelle", "Gothorita"],
    illustrators: [],
    sets: [["sv02", "PAL", 193, "Paldea Evolved", "2023-06-09", ["it"]]],
    cards: [[0, "092", 150, [0], -1], [0, "091", 90, [1], -1]],
  });
  const reading = R.parse([
    line("FASE2 150", 60, 60),
    line("Gothitelle", 250, 70),
    line("Sievolve da Gothorita", 250, 130),
    line("GPALI 092/193", 60, 1300),
  ], W, H);
  const candidates = R.match(small, reading, 5);
  // Gothorita is only named by the evolves-from line, so it is not proposed at all.
  assert.deepStrictEqual(candidates.map((c) => c.number), ["092"]);
  assert.deepStrictEqual(candidates[0].evidence, ["name", "number/total", "hp", "set code"]);
});

test("nothing readable gives no candidates", () => {
  const { candidates } = best([line("~~", 60, 60), line("xx", 60, 1300)]);
  assert.deepStrictEqual(candidates, []);
});

test("helpers", () => {
  assert.strictEqual(R.normalize("Pokémon-ex ♀"), "pokemonex");
  assert.strictEqual(R.normalizeNumber("090"), "90");
  assert.strictEqual(R.normalizeNumber("TG05"), "TG05");
  assert.strictEqual(R.nameSimilarity("gothita", "basegothitap70"), 1);
  assert.strictEqual(R.nameSimilarity("mew", "mewtwo"), 1);
  assert.strictEqual(R.nameSimilarity("pikachu", "gothita"), 0);
});
