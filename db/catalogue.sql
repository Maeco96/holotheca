-- Scrinium catalogue schema (read-only file, rebuilt by the ETL and replaced on update).
-- Personal data lives in a separate file: see collection.sql.
--
-- Key idea: a card is one printed card of one set (set + collector number).
-- Its names are stored per language in card_names, so a card that exists in
-- a language but has no name in the source still resolves by set and number.

PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
) WITHOUT ROWID;
-- Expected keys: schema_version, built_at, tcgdex_revision.

CREATE TABLE games (
    id   TEXT PRIMARY KEY,           -- 'pokemon', later 'mtg', ...
    name TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE languages (
    code TEXT PRIMARY KEY,           -- 'en', 'it', 'ja', 'zh-tw', ...
    name TEXT NOT NULL
) WITHOUT ROWID;

-- A set family groups sets that share set list and numbering.
-- 'international': EN/FR/DE/IT/ES/PT releases. 'asia': Japanese and Asian releases.
CREATE TABLE set_families (
    id      TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id),
    name    TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE series (
    id        TEXT PRIMARY KEY,      -- source id, prefixed by family when needed
    family_id TEXT NOT NULL REFERENCES set_families(id),
    source_id TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE series_names (
    series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    lang      TEXT NOT NULL REFERENCES languages(code),
    name      TEXT NOT NULL,
    PRIMARY KEY (series_id, lang)
) WITHOUT ROWID;

CREATE TABLE sets (
    id             TEXT PRIMARY KEY, -- e.g. 'sv08', 'SV8s'
    series_id      TEXT NOT NULL REFERENCES series(id),
    code           TEXT,             -- code printed on the card, e.g. 'SSP'; NULL when unknown
    official_count INTEGER,          -- the "/191" printed on cards
    release_date   TEXT,             -- ISO date of the first release
    is_digital     INTEGER NOT NULL DEFAULT 0 CHECK (is_digital IN (0, 1))
) WITHOUT ROWID;
CREATE INDEX sets_code ON sets(code);

-- One row per language the set was released in. A row here means
-- "this set exists in this language", even if card names are missing.
CREATE TABLE set_names (
    set_id       TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    lang         TEXT NOT NULL REFERENCES languages(code),
    name         TEXT NOT NULL,
    code         TEXT,               -- language-specific code, e.g. FR 'ETD'
    release_date TEXT,
    PRIMARY KEY (set_id, lang)
) WITHOUT ROWID;

CREATE TABLE cards (
    id          INTEGER PRIMARY KEY,
    source_id   TEXT NOT NULL UNIQUE,  -- '<set id>-<number>', e.g. 'sv08-001'
    set_id      TEXT NOT NULL REFERENCES sets(id),
    number      TEXT NOT NULL,         -- collector number as printed, may hold letters
    number_sort INTEGER,               -- numeric part, for ordering and OCR lookup
    category    TEXT,                  -- 'Pokemon', 'Trainer', 'Energy'
    rarity      TEXT,
    illustrator TEXT,
    hp          INTEGER,
    UNIQUE (set_id, number)
);
CREATE INDEX cards_lookup ON cards(number_sort, set_id);

CREATE TABLE card_names (
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    lang    TEXT NOT NULL REFERENCES languages(code),
    name    TEXT NOT NULL,
    PRIMARY KEY (card_id, lang)
) WITHOUT ROWID;

-- Image availability per language; the URL is built by the app from a base URL in meta.
CREATE TABLE card_images (
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    lang    TEXT NOT NULL REFERENCES languages(code),
    url     TEXT NOT NULL,
    PRIMARY KEY (card_id, lang)
) WITHOUT ROWID;

-- Print variants the catalogue knows for a card. The scanner only proposes
-- these; the user always confirms the variant by hand.
CREATE TABLE variants (
    id        INTEGER PRIMARY KEY,
    card_id   INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    type      TEXT NOT NULL,           -- 'normal', 'holo', 'reverse', 'metal', 'lenticular'
    subtype   TEXT,                    -- 'shadowless', 'unlimited', ...
    size      TEXT NOT NULL DEFAULT 'standard',
    stamps    TEXT,                    -- comma-separated, e.g. '1st-edition' or 'pre-release,staff'
    foil      TEXT,
    languages TEXT,                    -- comma-separated; NULL = every language of the set
    inferred  INTEGER NOT NULL DEFAULT 0 CHECK (inferred IN (0, 1))  -- 1 = guessed by the ETL, not in the source
);
CREATE INDEX variants_card ON variants(card_id);

-- Marketplace identifiers. variant_id is NULL when the ID applies to the whole card.
-- Rows with manual = 1 come from etl/overrides and survive every rebuild.
CREATE TABLE external_ids (
    id          INTEGER PRIMARY KEY,
    card_id     INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    variant_id  INTEGER REFERENCES variants(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL CHECK (provider IN ('cardmarket', 'tcgplayer', 'cardtrader')),
    external_id TEXT NOT NULL,
    manual      INTEGER NOT NULL DEFAULT 0 CHECK (manual IN (0, 1))
);
CREATE INDEX external_ids_card ON external_ids(card_id, provider);

CREATE TABLE set_external_ids (
    set_id      TEXT NOT NULL REFERENCES sets(id) ON DELETE CASCADE,
    provider    TEXT NOT NULL CHECK (provider IN ('cardmarket', 'tcgplayer', 'cardtrader')),
    external_id TEXT NOT NULL,
    PRIMARY KEY (set_id, provider)
) WITHOUT ROWID;

-- Offline full-text search over every localized name.
CREATE VIRTUAL TABLE card_search USING fts5(
    name,
    card_id UNINDEXED,
    lang UNINDEXED,
    tokenize = 'unicode61 remove_diacritics 2'
);
