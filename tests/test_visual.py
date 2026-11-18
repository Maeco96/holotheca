"""Tests of the visual index packing and the image preparation (no model, no network)."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "etl" / "visual"))

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None


@unittest.skipIf(Image is None, "Pillow not installed")
class VisualTest(unittest.TestCase):
    def test_find_card_tightens_to_bright_card_on_dark_background(self):
        from common import find_card
        photo = Image.new("RGB", (400, 560), (20, 20, 20))
        photo.paste(Image.new("RGB", (360, 504), (230, 200, 60)), (20, 28))
        card = find_card(photo)
        self.assertLess(abs(card.width - 360), 6)
        self.assertLess(abs(card.height - 504), 8)

    def test_find_card_falls_back_to_the_guide_frame(self):
        from common import find_card, trim_capture
        photo = Image.new("RGB", (400, 560), (128, 128, 128))
        self.assertEqual(find_card(photo).size, trim_capture(photo).size)

    def test_phone_index_sign_bits(self):
        import phone_index
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            art = np.array([[1, -1, 0.5, -0.2, 0.1, 0.3, -0.4, 0.9], [-1, 1, -1, 1, -1, 1, -1, 1]], dtype=np.float16)
            art.tofile(d / "art.f16")
            art.tofile(d / "full.f16")
            (d / "keys.json").write_text(json.dumps({"dim": 8, "keys": ["a-1", "b-2"], "urls": ["", ""]}))
            sys.argv = ["phone_index.py", str(d), "--method", "art", "--bits", "1", "--out", str(d / "out" / "vi")]
            phone_index.main()
            head = json.loads((d / "out" / "vi.json").read_text())
            self.assertEqual((head["dim"], head["bits"], head["method"]), (8, 1, "art"))
            self.assertEqual(list((d / "out" / "vi.bin").read_bytes()), [0b10101101, 0b01010101])


if __name__ == "__main__":
    unittest.main()
