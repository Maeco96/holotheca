# Decision log

One row per decision. Newest last.

| Date | Decision | Why |
| --- | --- | --- |
| 2026-11-16 | No Mac available: iOS builds run on GitHub Actions macOS runners | Free on public repositories |
| 2026-11-16 | Repository is public | Required for free macOS runners; holds code only, never the collection or card images |
| 2026-11-16 | The catalogue covers every language cards were printed in, not only the owned ones | Owner's requirement |
| 2026-11-16 | iPhone only for now, other platforms later | Scope |
| 2026-11-16 | Track purchase price and value history | Owner's requirement |
| 2026-11-16 | Graded cards and sealed products are supported; raw cards have priority | Scope |
| 2026-11-16 | TCGdex (`tcgdex/cards-database`, MIT) is the only catalogue source to start with; no scraped datasets | Lawful-sources constraint; revisit after the coverage report |
| 2026-11-16 | Pre-grading shows measurements and a grade range, labelled as indicative and unofficial | Only grading companies issue valid grades |
| 2026-11-16 | The Lynceus engine is not used in the app; image analysis uses Apple's Vision framework | Lynceus is a Windows/Python plate reader |

## Open

- How to fill the catalogue gaps shown in `docs/coverage/tcgdex-coverage.md`.
