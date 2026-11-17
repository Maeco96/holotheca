# Card sources beyond TCGdex

TCGdex is the base of the catalogue. These tools fill its gaps and check it against other
sources. Every source is asked politely: one request per second, a named client, robots.txt
respected. Only facts are stored: names, numbers, sets, and the addresses of the images. Images
are never copied into this repository or the Pages site. The phone loads them from where they
are published (decision of 2026-11-17, see `docs/DECISIONS.md`).

| Source | Run by | Gives | How it is read | Terms |
|---|---|---|---|---|
| pokemon-card.com | The Pokémon Company (Japan) | Japanese cards and images | JSON list + detail pages | personal use only, no redistribution |
| pokemoncard.co.kr | Pokémon Korea | Korean cards and images | the page's load-more request + detail pages | robots.txt allows all |
| asia.pokemon-card.com/tw | The Pokémon Company (Asia) | Traditional Chinese cards and images | list per expansion + detail pages | no copying outside the service |
| wiki.pokemoncentral.it | Pokémon Central (fan wiki) | Italian card names and scans | article pages only (its API is closed to robots) | CC BY-NC-SA 3.0 |
| pokewiki.de, pokepedia.fr, wikidex.net, bulbapedia | fan wikis | German, French, Spanish, English names and scans | MediaWiki API where robots.txt allows it | CC BY-NC-SA |

Left out: pokemon.com (its terms forbid bots), Cardmarket (project rule), Pokedexia (its terms
forbid scraping), paid APIs (no recurring costs).

A wiki may illustrate a page with a scan in another language, so `scan_language.py` reads the
words printed on each scan (Tesseract) and a scan is only used for the language it shows.

- `probe.py`: what a site serves (robots.txt, terms, page layout). Runs in `source-probe.yml`.
- `official.py`: collector for the official sites. Runs in `official-sources.yml`.
- `compare.py`: report against TCGdex and the image map for the app (`web/data/official-images.json`).
- `scan_language.py`: language printed on a scan.
- `data/`: the collected facts, committed by the full runs.
