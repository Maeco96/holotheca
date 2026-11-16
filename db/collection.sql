-- Holotheca collection schema (the user's own data; never replaced by a catalogue update).
-- References the catalogue by stable source ids, not by row ids, because the
-- catalogue file is rebuilt from scratch.

PRAGMA foreign_keys = ON;
PRAGMA user_version = 1;

CREATE TABLE binders (
    id         INTEGER PRIMARY KEY,
    parent_id  INTEGER REFERENCES binders(id) ON DELETE SET NULL,  -- folders
    name       TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE owned_copies (
    id                INTEGER PRIMARY KEY,
    binder_id         INTEGER REFERENCES binders(id) ON DELETE SET NULL,
    card_source_id    TEXT NOT NULL,       -- catalogue cards.source_id
    lang              TEXT NOT NULL,
    -- Variant confirmed by hand; stored as values, not as a catalogue row id.
    variant_type      TEXT NOT NULL,
    variant_subtype   TEXT,
    variant_stamps    TEXT,
    variant_confirmed INTEGER NOT NULL DEFAULT 0 CHECK (variant_confirmed IN (0, 1)),
    condition         TEXT,                -- 'MT','NM','EX','GD','LP','PL','PO'; NULL for graded copies
    quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    purchase_price    REAL,
    purchase_currency TEXT,
    purchase_date     TEXT,
    notes             TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX owned_copies_card ON owned_copies(card_source_id);
CREATE INDEX owned_copies_binder ON owned_copies(binder_id);

CREATE TABLE copy_photos (
    id         INTEGER PRIMARY KEY,
    copy_id    INTEGER NOT NULL REFERENCES owned_copies(id) ON DELETE CASCADE,
    side       TEXT NOT NULL CHECK (side IN ('front', 'back', 'detail')),
    file_name  TEXT NOT NULL,              -- relative to the app's photo folder
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Grade issued by a grading company (the only kind that is official).
CREATE TABLE official_grades (
    copy_id     INTEGER PRIMARY KEY REFERENCES owned_copies(id) ON DELETE CASCADE,
    company     TEXT NOT NULL,             -- 'PSA', 'BGS', 'CGC', 'TAG', ...
    grade       TEXT NOT NULL,             -- text: '10', '9.5', 'Pristine 10'
    cert_number TEXT,
    graded_at   TEXT
);

-- Indicative, unofficial estimate produced by the app. Several per copy are
-- allowed so that estimates can later be compared with the official grade.
CREATE TABLE pregrades (
    id                INTEGER PRIMARY KEY,
    copy_id           INTEGER NOT NULL REFERENCES owned_copies(id) ON DELETE CASCADE,
    algorithm_version TEXT NOT NULL,
    front_lr          REAL,                -- larger side share, e.g. 55.0 for 55/45; NULL = not measurable
    front_tb          REAL,
    back_lr           REAL,
    back_tb           REAL,
    corners_score     REAL,
    edges_score       REAL,
    surface_score     REAL,
    grade_low         REAL,
    grade_high        REAL,
    limiting_factor   TEXT,                -- 'centering', 'corners', 'edges', 'surface'
    confirmed         INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0, 1)),
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX pregrades_copy ON pregrades(copy_id);

-- Centering thresholds per company and grade. Editable: companies change them.
CREATE TABLE grade_scales (
    company    TEXT NOT NULL,
    grade      TEXT NOT NULL,
    front_max  REAL,                       -- worst allowed larger-side share on the front
    back_max   REAL,
    source_url TEXT,
    checked_at TEXT,
    PRIMARY KEY (company, grade)
) WITHOUT ROWID;

CREATE TABLE sealed_products (
    id                INTEGER PRIMARY KEY,
    binder_id         INTEGER REFERENCES binders(id) ON DELETE SET NULL,
    name              TEXT NOT NULL,
    set_id            TEXT,                -- catalogue sets.id, when known
    lang              TEXT,
    product_type      TEXT,                -- 'booster', 'booster box', 'ETB', ...
    quantity          INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    purchase_price    REAL,
    purchase_currency TEXT,
    purchase_date     TEXT,
    notes             TEXT
);

-- One row per price reading: this is the value history.
CREATE TABLE price_history (
    id             INTEGER PRIMARY KEY,
    card_source_id TEXT NOT NULL,
    variant_type   TEXT,
    lang           TEXT,
    provider       TEXT NOT NULL,          -- 'cardmarket', 'tcgplayer', 'cardtrader'
    metric         TEXT NOT NULL,          -- 'trend', 'avg30', 'low', 'market', ...
    price          REAL NOT NULL,
    currency       TEXT NOT NULL,
    read_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX price_history_card ON price_history(card_source_id, read_at);
