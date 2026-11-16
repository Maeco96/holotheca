# TCGdex coverage per language

Generated on 2026-11-16 by `etl/tcgdex_coverage.py` from `tcgdex/cards-database` at revision `4218f64d 2026-11-15`.

A card counts for a language when its `name` has a value in that language. "Official" is the sum of `cardCount.official` over the sets named in that language; it excludes secret rares, so the ratio can exceed 100%. "Empty sets" are sets named in the language that hold no card in it.

## International releases (`data/`)

224 set files, 24015 card files.

| Language | Code | Sets | Empty sets | Cards | Official | Cards / official |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| English | `en` | 221 | 4 | 23913 | 20998 | 114% |
| French | `fr` | 208 | 6 | 22383 | 20228 | 111% |
| German | `de` | 197 | 12 | 21630 | 19869 | 109% |
| Italian | `it` | 200 | 82 | 15929 | 19474 | 82% |
| Spanish | `es` | 166 | 34 | 17144 | 17011 | 101% |
| Spanish (Latin America) | `es-mx` | 17 | 0 | 2175 | 1841 | 118% |
| Portuguese | `pt` | 132 | 22 | 14676 | 14803 | 99% |
| Portuguese (Brazil) | `pt-br` | 14 | 6 | 1124 | 1423 | 79% |
| Dutch | `nl` | 3 | 3 | 0 | 228 | 0% |
| Polish | `pl` | 2 | 2 | 0 | 253 | 0% |
| Russian | `ru` | 9 | 9 | 0 | 1049 | 0% |
| Japanese | `ja` | 1 | 1 | 0 | 71 | 0% |
| Korean | `ko` | 14 | 6 | 1124 | 1423 | 79% |
| Chinese (Traditional) | `zh-tw` | 1 | 1 | 0 | 71 | 0% |
| Chinese (Simplified) | `zh-cn` | 1 | 1 | 0 | 71 | 0% |

## Japanese and Asian releases (`data-asia/`)

347 set files, 18584 card files.

| Language | Code | Sets | Empty sets | Cards | Official | Cards / official |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| English | `en` | 1 | 1 | 0 | 1 | 0% |
| Japanese | `ja` | 228 | 97 | 13660 | 17776 | 77% |
| Korean | `ko` | 134 | 131 | 239 | 10405 | 2% |
| Chinese (Traditional) | `zh-tw` | 112 | 28 | 7587 | 10427 | 73% |
| Chinese (Simplified) | `zh-cn` | 57 | 49 | 877 | 6829 | 13% |
| Thai | `th` | 77 | 45 | 2994 | 7643 | 39% |
| Indonesian | `id` | 85 | 64 | 2788 | 9877 | 28% |
