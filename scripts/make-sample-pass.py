"""Draws a synthetic boarding-pass screenshot for the TR-18 fixture.

Fake layout, made-up airline styling, and a random block pattern that only looks like a 2D code:
it encodes nothing. Seeded, so the output is deterministic.
"""
import random, sys
from PIL import Image, ImageDraw, ImageFont

W, H = 750, 1334
img = Image.new("RGB", (W, H), (242, 242, 242))
d = ImageDraw.Draw(img)

def font(size, bold=False):
    for name in (["DejaVuSans-Bold.ttf"] if bold else ["DejaVuSans.ttf"]):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size)

# Header band
d.rectangle([0, 0, W, 170], fill=(40, 56, 82))
d.text((40, 60), "SAMPLE AIR", font=font(44, True), fill=(255, 255, 255))
d.text((40, 118), "Demo boarding pass. Not valid for travel.", font=font(22), fill=(200, 210, 225))

d.text((40, 220), "TPA", font=font(96, True), fill=(30, 30, 30))
d.text((W - 40 - 190, 220), "LAS", font=font(96, True), fill=(30, 30, 30))
d.text((40, 330), "Tampa", font=font(26), fill=(90, 90, 90))
d.text((W - 40 - 190, 330), "Las Vegas", font=font(26), fill=(90, 90, 90))
d.line([(270, 280), (480, 280)], fill=(120, 120, 120), width=3)

rows = [
    [("FLIGHT", "AA 2410"), ("DATE", "12 NOV"), ("BOARDS", "08:25")],
    [("GATE", "E75"), ("GROUP", "5"), ("SEAT", "14A")],
    [("PASSENGER", "MATTHEW S."), ("", ""), ("CONF", "KXJ4PL")],
]
y = 400
for row in rows:
    for i, (label, value) in enumerate(row):
        x = 40 + i * 235
        d.text((x, y), label, font=font(20), fill=(110, 110, 110))
        d.text((x, y + 28), value, font=font(34, True), fill=(30, 30, 30))
    y += 100

# A fake 2D code: random modules plus three corner squares. Encodes nothing.
rng = random.Random(2410)
size, n = 400, 29
x0, y0 = (W - size) // 2, 760
d.rectangle([x0 - 30, y0 - 30, x0 + size + 30, y0 + size + 30], fill=(255, 255, 255))
cell = size / n
for r in range(n):
    for c in range(n):
        if rng.random() < 0.5:
            d.rectangle([x0 + c * cell, y0 + r * cell, x0 + (c + 1) * cell - 1, y0 + (r + 1) * cell - 1], fill=(0, 0, 0))
for (cr, cc) in [(0, 0), (0, n - 7), (n - 7, 0)]:
    bx, by = x0 + cc * cell, y0 + cr * cell
    d.rectangle([bx, by, bx + 7 * cell - 1, by + 7 * cell - 1], fill=(0, 0, 0))
    d.rectangle([bx + cell, by + cell, bx + 6 * cell - 1, by + 6 * cell - 1], fill=(255, 255, 255))
    d.rectangle([bx + 2 * cell, by + 2 * cell, bx + 5 * cell - 1, by + 5 * cell - 1], fill=(0, 0, 0))

d.text((W // 2, 1230), "SAMPLE  ·  NOT A REAL PASS", font=font(22), fill=(130, 130, 130), anchor="mm")
img.save(sys.argv[1], optimize=True)
print("code box", (x0 - 30) / W, (y0 - 30) / H, (size + 60) / W, (size + 60) / H)
