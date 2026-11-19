"""Shared image preparation for the visual fallback: the same steps run on catalogue images
(build_index.py) and on photos from the phone (embed_photos.py), and web/visual.js repeats them
in the browser. Keep the three in step."""
from __future__ import annotations

import numpy as np
from PIL import Image

SIZE = 224
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)
# Artwork window of a standard card, as a share of the card (left, top, right, bottom).
# Holds for most eras: the picture sits under the name bar and above the attacks.
ART = (0.08, 0.10, 0.92, 0.52)
# The phone captures the guide frame plus 3% of its size on every side (web/camera.js).
FRAME_MARGIN = 0.03


def regions(card: Image.Image) -> dict[str, Image.Image]:
    """The parts of a card image that get a vector: the whole card and its artwork."""
    card = card.convert("RGB")
    w, h = card.size
    l, t, r, b = ART
    return {"full": card, "art": card.crop((round(l * w), round(t * h), round(r * w), round(b * h)))}


def tensor(image: Image.Image) -> np.ndarray:
    """Model input [3, 224, 224]: the region squashed to a square, ImageNet normalisation."""
    small = image.convert("RGB").resize((SIZE, SIZE), Image.BILINEAR)
    pixels = np.asarray(small, dtype=np.float32) / 255.0
    return ((pixels - MEAN) / STD).transpose(2, 0, 1)


def dhash(image: Image.Image, side: int = 16) -> bytes:
    """Difference hash: side x side bits from neighbouring pixel comparisons of a grey copy."""
    grey = np.asarray(image.convert("L").resize((side + 1, side), Image.BILINEAR), dtype=np.int16)
    bits = (grey[:, 1:] > grey[:, :-1]).flatten()
    return np.packbits(bits).tobytes()


def trim_capture(photo: Image.Image, margin: float = FRAME_MARGIN) -> Image.Image:
    """Cut the capture margin off a phone photo, leaving the guide frame."""
    w, h = photo.size
    share = margin / (1 + 2 * margin)
    return photo.crop((round(share * w), round(share * h), round(w - share * w), round(h - share * h)))


def find_card(photo: Image.Image) -> Image.Image:
    """Tighten a capture to the card edges: the card is the bright, detailed area; the strongest
    jump in brightness near each side of the capture is taken as its edge. Falls back to the
    trimmed guide frame when no clear edge is found."""
    grey = np.asarray(photo.convert("L").resize((256, round(256 * photo.height / photo.width)), Image.BILINEAR), dtype=np.float32)
    h, w = grey.shape
    cols = grey.mean(axis=0)
    rows = grey.mean(axis=1)

    def edge(profile: np.ndarray, start: int, stop: int, step: int) -> int | None:
        idx = list(range(start, stop, step))
        diffs = [(profile[i + step] - profile[i]) * 1 for i in idx if 0 <= i + step < len(profile)]
        if not diffs:
            return None
        best = int(np.argmax(diffs))
        return idx[best] + step if diffs[best] > 12 else None

    band_w = int(w * 0.12)
    band_h = int(h * 0.12)
    left = edge(cols, 0, band_w, 1)
    right = edge(cols, w - 1, w - 1 - band_w, -1)
    top = edge(rows, 0, band_h, 1)
    bottom = edge(rows, h - 1, h - 1 - band_h, -1)
    fallback = trim_capture(photo)
    if None in (left, right, top, bottom):
        return fallback
    sx = photo.width / w
    sy = photo.height / h
    box = (left * sx, top * sy, (right + 1) * sx, (bottom + 1) * sy)
    bw, bh = box[2] - box[0], box[3] - box[1]
    if bw < 0.75 * photo.width or bh < 0.75 * photo.height:
        return fallback
    return photo.crop(tuple(round(v) for v in box))
