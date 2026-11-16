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
| 2026-11-16 | Set ids are made globally unique by the ETL: `<id>~asia` when an Asian set reuses an international id (the Japanese Neo sets), `<id>~<file>` for source slips; `sets.source_id` keeps the TCGdex id for image URLs | TCGdex ids are unique per language list, not globally; skipping them would drop 324 cards |
| 2026-11-16 | The ETL infers a variant only when TCGdex lists none and the rarity is unambiguous: Common/Uncommon/Rare become `normal`, any "Holo" rarity becomes `holo`; rows are flagged `inferred` | Owner: "deduci al momento, poi vediamo". Reverse holos, 1st editions and stamps are never guessed; the app must show inferred variants as a guess. Revisit after real scans |
| 2026-11-16 | PWA test on iPhone (iOS 27.2.1) passed: installs from the Home Screen, starts offline, camera 2160x3840; Safari does not expose focus control; web storage is not guaranteed persistent, so backups are mandatory | Real-device test |
| 2026-11-16 | Route: PWA first with an OCR read test; the native app (SideInstaller + SideStore) only if browser OCR proves too weak | Owner's choice. No PC software needed; keeps zero cost |
| 2026-11-16 | OCR test v0.3.0: wider strips, several number strips (bottom-left, bottom-right, full bottom), grayscale then black/white retry, coloured boxes drawn on the captured photo | First real read (sleeved Eevee, e-Reader era) returned nothing useful; the boxes show whether the crop or the image quality is at fault |
| 2026-11-16 | OCR test v0.4.0: the number is searched in thin overlapping bands (left and right halves, step 1.5% of card height) instead of one tall strip; name strip covers the full width and HP is parsed from it | Real read of a sleeved e-Reader Eevee: name read correctly, number not, because bars and the illustrator line share the strip. Layouts differ by era, so the app must not assume a fixed position; the final lookup will rank candidates using name + HP + number against the catalogue |
| 2026-11-16 | OCR test v0.5.0: the number is read in thin windows (3.5% of card height, 30% of width), because Tesseract fails when the text is under about a third of the strip height; name and HP are separate strips; black/white retry uses an adaptive threshold | Real read of the e-Reader Eevee: 24 px number in a 109 px strip was not read (a synthetic probe confirmed the limit); the full-width name strip got worse. The expansion symbol is not read by OCR: it needs the visual match planned for later |
| 2026-11-16 | OCR test v0.6.0 adds camera controls: lens picker (all back cameras Safari lists), zoom, focus mode and torch, each shown only if the browser exposes it, plus the list of exposed controls | Owner asked to use lenses, zoom and flash. WebKit supports `torch` since iOS 17.5 (bug 243075 / 262131); zoom and lens selection are unverified on iOS 27, so the page reports what is really available |

## Open

- How to fill the catalogue gaps shown in `docs/coverage/tcgdex-coverage.md`.
- Image coverage per language: the TCGdex asset index is not reachable from the build environment used so far; measure it from GitHub Actions.
- Inferred variants (from rarity) are provisional: review once real scans show how many are wrong.
