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
| `web/` | PWA test page (camera, install, offline), published with GitHub Pages |
| `db/` | SQLite schemas: `catalogue.sql` (rebuilt by the ETL) and `collection.sql` (personal data) |
| `docs/DECISIONS.md` | Decision log |
| `docs/coverage/` | Generated reports on source coverage |

## Catalogue coverage

```sh
git clone --depth 1 https://github.com/tcgdex/cards-database /tmp/cards-database
python3 etl/tcgdex_coverage.py /tmp/cards-database --out docs/coverage/tcgdex-coverage.md
python3 etl/tcgdex_fields.py /tmp/cards-database --out docs/coverage/tcgdex-fields.md
```

Requires Python 3.9 or newer, no third-party packages.
