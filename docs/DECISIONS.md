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
| 2026-11-16 | A card is identified by set and collector number; names are per-language rows | TCGdex lacks Italian names for 82 sets, so lookup must not depend on a localized name |
| 2026-11-16 | Two SQLite files: `catalogue` (replaced on update) and `collection` (personal, references cards by source id) | A catalogue rebuild must never touch personal data |
| 2026-11-16 | Pokémon TCG Pocket sets are flagged `is_digital` and hidden from the physical catalogue | They are in the TCGdex data but are not printed cards |
| 2026-11-16 | The owner's PC cannot install software, so iloader/SideStore/AltServer (which need iTunes drivers on Windows) are not usable from it; PWA test page added as the no-PC route | Native route needs a computer with installed tools for the first install |

## Open

- How to fill the catalogue gaps shown in `docs/coverage/tcgdex-coverage.md`.
- Image coverage per language: the TCGdex asset index is not reachable from the build environment used so far; measure it from GitHub Actions.
- 22% of international cards and 28% of Asian cards have no variant information in TCGdex: decide whether the ETL infers variants from rarity or leaves them empty.
