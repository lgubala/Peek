#!/usr/bin/env python3
"""
Peek icon generator.

The mark is a peephole: a bright ring with a dark centre, set in a door. It is
the metaphor the extension is built on — a corridor of doors with nothing
written on them, and Peek puts a window in each one.

Icons are drawn, not scaled. A 128px icon shrunk to 16px turns to mush, so
detail is added back only as the canvas grows:

    16, 32   door + peephole. Nothing else survives.
    48, 96   + hinge seam
    128      + a catch of light on the lens, + door knob

Two rejected directions, recorded so nobody re-treads them: a teal tile with a
dark circle reads as a camera lens, which is the wrong association for a tool
whose selling point is that it does not watch you; and a door standing ajar
with light spilling out collapses into a media play button at 16px.

Everything is drawn at 8x and downsampled with LANCZOS, which gives cleaner
edges than the draw calls' own anti-aliasing.

    python3 make_icons.py OUTPUT_DIR
"""

from PIL import Image, ImageDraw

# Same values as src/content/styles.js
SLATE = (19, 26, 33, 255)      # the door
DEEP = (11, 16, 21, 255)       # through the peephole
TEAL = (127, 216, 196, 255)    # the ring
RIM = (58, 92, 100, 255)       # tile edge, so it reads on a dark toolbar
SEAM = (44, 60, 72, 255)       # hinge side
GLINT = (232, 255, 250, 205)   # light on the lens

SS = 8


def draw_icon(size: int) -> Image.Image:
    seam = size >= 48
    detail = size >= 128

    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    radius = int(s * 0.22)

    # --- the door -------------------------------------------------------
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=SLATE)

    # Light falls on the top of a door.
    shade = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for i in range(s):
        sd.line([(0, i), (s, i)], fill=(0, 0, 0, int(20 * (i / s))))
    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=radius, fill=255)
    img.paste(Image.alpha_composite(img, shade), (0, 0), mask)

    # A hairline rim keeps the tile from dissolving into a dark toolbar.
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=radius,
                        outline=RIM, width=max(SS, int(s * 0.014)))

    # --- the hinge seam -------------------------------------------------
    if seam:
        x = int(s * 0.225)
        d.line([(x, int(s * 0.18)), (x, int(s * 0.82))],
               fill=SEAM, width=max(SS, int(s * 0.020)))

    # --- the peephole ---------------------------------------------------
    cx = int(s * (0.600 if seam else 0.500))
    cy = int(s * 0.500)
    r = int(s * (0.235 if seam else 0.270))

    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=TEAL)
    inner = int(r * 0.52)
    d.ellipse([cx - inner, cy - inner, cx + inner, cy + inner], fill=DEEP)

    if detail:
        g = int(r * 0.30)
        gx, gy = cx - r + int(r * 0.16), cy - r + int(r * 0.16)
        d.ellipse([gx, gy, gx + g, gy + g], fill=GLINT)

        kr = int(s * 0.030)
        kx, ky = int(s * 0.345), int(s * 0.640)
        d.ellipse([kx - kr, ky - kr, kx + kr, ky + kr], fill=SEAM)

    return img.resize((size, size), Image.LANCZOS)


def contact_sheet(sizes, bg):
    pad, gap = 16, 20
    w = pad * 2 + sum(sizes) + gap * (len(sizes) - 1)
    h = pad * 2 + max(sizes)
    sheet = Image.new("RGBA", (w, h), bg)
    x = pad
    for sz in sizes:
        icon = draw_icon(sz)
        sheet.paste(icon, (x, pad + (max(sizes) - sz) // 2), icon)
        x += sz + gap
    return sheet


if __name__ == "__main__":
    import os
    import sys

    sizes = [16, 32, 48, 96, 128]
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    os.makedirs(out, exist_ok=True)

    for sz in sizes:
        draw_icon(sz).save(os.path.join(out, "icon-%d.png" % sz))
        print("icon-%d.png" % sz)

    light = contact_sheet(sizes, (245, 246, 248, 255))
    dark = contact_sheet(sizes, (43, 42, 51, 255))
    both = Image.new("RGBA", (max(light.width, dark.width), light.height + dark.height))
    both.paste(light, (0, 0))
    both.paste(dark, (0, light.height))
    both.save(os.path.join(out, "preview.png"))
    print("preview.png")
