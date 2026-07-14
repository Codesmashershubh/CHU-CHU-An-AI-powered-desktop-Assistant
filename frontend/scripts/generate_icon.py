"""
Generates Chu Chu's app icon: the twin-pulse mark (two rhythm beats, echoing
the name's two syllables) in brass on a graphite rounded-square background —
matching the design system in docs/DESIGN.md. Produces a source PNG, a
multi-res .ico for Windows, and a set of PNG sizes electron-builder expects
for Linux.  macOS .icns needs a Mac (`iconutil`) or an online converter fed
with build/icon.png — noted in the frontend README.

Run from frontend/:  pip install Pillow && python3 scripts/generate_icon.py
"""
import math
from PIL import Image, ImageDraw, ImageFilter

INK = (13, 16, 19, 255)        # --chu-ink
INK2 = (18, 22, 27, 255)       # slightly lighter, for the subtle corner gradient feel
BRASS = (213, 162, 83, 255)    # --chu-brass
BRASS_SOFT = (213, 162, 83, 90)

SIZE = 1024


def pulse_points(width, cy, amp, n=400, x0=0):
    """Two symmetric rounded pulse humps on a flat baseline — the brand's
    signature 'twin beat' shape, echoing the two syllables of 'Chu Chu'."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = x0 + t * width
        # Two half-sine humps centered around 30% and 70% of the width,
        # each about 16% wide, flat baseline elsewhere.
        y = cy
        for center in (0.30, 0.70):
            d = (t - center)
            half_w = 0.11
            if abs(d) < half_w:
                y -= amp * math.cos((d / half_w) * (math.pi / 2)) ** 1.6
        pts.append((x, y))
    return pts


def make_icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded-square base, subtle vertical gradient (ink -> ink2)
    radius = int(SIZE * 0.22)
    base = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    bdraw = ImageDraw.Draw(base)
    bdraw.rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=INK)
    grad = Image.new("L", (1, SIZE))
    for y in range(SIZE):
        t = y / SIZE
        grad.putpixel((0, y), int(18 + 10 * t))
    grad = grad.resize((SIZE, SIZE))
    tint = Image.new("RGBA", (SIZE, SIZE), INK2)
    base = Image.composite(tint, base, grad.point(lambda p: max(0, p - 15)))
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, SIZE - 1, SIZE - 1], radius=radius, fill=255)
    base.putalpha(mask)
    img = Image.alpha_composite(img, base)

    # Soft brass glow behind the mark
    glow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    gdraw = ImageDraw.Draw(glow)
    gdraw.ellipse(
        [SIZE * 0.18, SIZE * 0.30, SIZE * 0.82, SIZE * 0.72],
        fill=(BRASS[0], BRASS[1], BRASS[2], 120),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(SIZE * 0.09))
    glow.putalpha(Image.eval(glow.getchannel("A"), lambda a: min(a, 130)))
    img = Image.alpha_composite(img, glow)

    # The twin-pulse mark itself
    mark_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    mdraw = ImageDraw.Draw(mark_layer)
    line_w = int(SIZE * 0.052)
    pts = pulse_points(width=SIZE * 0.58, cy=SIZE * 0.52, amp=SIZE * 0.17, x0=SIZE * 0.21)
    mdraw.line(pts, fill=BRASS, width=line_w, joint="curve")
    # rounded end caps
    r = line_w / 2
    for p in (pts[0], pts[-1]):
        mdraw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=BRASS)
    img = Image.alpha_composite(img, mark_layer)

    return img


def main():
    icon = make_icon()
    icon.save("build/icon.png")

    sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
    icon.save(
        "build/icon.ico",
        sizes=[(s, s) for s in sizes if s <= 256],
    )

    for s in (16, 32, 192, 512):
        icon.resize((s, s), Image.LANCZOS).save(f"public/icon-{s}.png")

    icon.resize((512, 512), Image.LANCZOS).save("build/icon-512.png")
    print("Icon assets generated.")


if __name__ == "__main__":
    main()
