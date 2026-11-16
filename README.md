# Scrinium

Personal iPhone app to scan trading cards, starting with Pokémon: camera
recognition, manual confirmation, virtual binder, card page with marketplace
links and an indicative (unofficial) pre-grade.

The card catalogue lives in a SQLite file built by an ETL script from open
data, so the app works offline and does not depend on any single API at
runtime.

## Constraints

- No recurring costs: no paid developer account, API or server.
- Lawful data sources only: open APIs, open datasets, officially published files. No scraping.
- Offline search and binder; network only for images, prices and catalogue updates.
- Print variant and grade are always proposed by the scanner and confirmed by hand.

## Layout

| Path | Content |
| --- | --- |
| `etl/` | Scripts that build and check the catalogue |
| `tests/` | Unit tests for the ETL and for the scanner matching |
| `web/` | PWA scanner test page (camera, text reading, catalogue matching), published with GitHub Pages |
| `tools/ppocr/` | Rebuilds the vendored text reader in `web/vendor/ppocr/` |
| `db/` | SQLite schemas: `catalogue.sql` (rebuilt by the ETL) and `collection.sql` (personal data) |
| `docs/DECISIONS.md` | Decision log |
| `docs/coverage/` | Generated reports on source coverage |

## Catalogue coverage

```sh
git clone --depth 1 https://github.com/tcgdex/cards-database /tmp/cards-database
python3 etl/tcgdex_coverage.py /tmp/cards-database --out docs/coverage/tcgdex-coverage.md
python3 etl/tcgdex_fields.py /tmp/cards-database --out docs/coverage/tcgdex-fields.md
```

## Build the catalogue

```sh
python3 etl/build_catalogue.py /tmp/cards-database --out build/catalogue.sqlite
python3 -m unittest discover -s tests
```

Takes about 10 seconds and produces a 21 MB SQLite file (7 MB gzipped). Corrections to marketplace IDs go in
`etl/overrides/external_ids.csv` and are applied on every build.

Requires Python 3.9 or newer, no third-party packages.

## App

`web/` is the app (installable web app, interface in Italian): `app.js` (views and scan flow), `camera.js`,
`catalogue.js` (search, card page data, shop links), `store.js` (the collection, kept on the device with
export and import), `recognize.js` (matching) and `styles.css`.

The scanner reads every text line on the card with PaddleOCR (on the device, nothing is uploaded),
then `web/recognize.js` ranks catalogue cards by name, collector number, HP, set code and illustrator.
The owner always confirms the card and its print variant by hand.

```sh
python3 etl/export_scan_index.py build/catalogue.sqlite --out web/data/scan-index.json   # card index, 3 MB
node --test tests/test_recognize.js
python3 -m http.server 8000 --directory web                                              # then open localhost:8000
```

The Pages workflow builds the card index at every deployment; `web/data/` is not committed.
