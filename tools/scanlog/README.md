# Scan log replay

Measures the scanner on real readings exported from the phone
(Altro > Registro delle letture > Esporta registro).

```sh
# build the card index once (same steps as .github/workflows/pwa-pages.yml)
git clone --depth 1 https://github.com/tcgdex/cards-database.git /tmp/tcgdex
python3 etl/build_catalogue.py /tmp/tcgdex --out /tmp/catalogue.sqlite
python3 etl/export_scan_index.py /tmp/catalogue.sqlite --out /tmp/scan-index.json

# replay the log against the current web/recognize.js
node tools/scanlog/replay.js holotheca-letture-2026-11-16.json /tmp/scan-index.json \
  --labels labels.json --photos /tmp/scan-photos --json run.json
```

The right card for each reading is the one the owner tapped. For readings marked
"Nessuna è quella giusta", add the right card key (`<set id>-<number>`, as in the
card page URL) to `labels.json`, or `"skip"` to leave the reading out.

The log holds the OCR lines, not only the photo, so matching changes are measured
without running OCR again. Changes to framing or OCR need new readings from the phone.

Logs contain photos of the owner's cards: keep them out of the repository.
