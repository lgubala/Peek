#!/usr/bin/env python3
"""
Regenerate Chrome/src/offscreen/offscreen.html from the Firefox background
script list, and check the two manifests agree on the content scripts.

Chrome's offscreen document loads the same engine that Firefox loads in its
background page, but it lists those files in HTML rather than in the manifest,
so the two can drift silently. When they do, the missing module fails only in
Chrome and only at runtime — `P.policy.forHost is not a function`, and every
link stops working.

    python3 docs/sync-offscreen.py            # rewrite and report
    python3 docs/sync-offscreen.py --check    # report only, exit 1 on drift
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OFFSCREEN = os.path.join(ROOT, "Chrome", "src", "offscreen", "offscreen.html")

HEADER = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Peek engine</title>
</head>
<body>
<!--
  Chrome MV3 service workers have no DOM, and Peek cannot parse HTML without
  one, so this invisible document hosts the engine instead.

  The scripts below are the same files, in the same order, that Firefox loads
  in its background page — Firefox/manifest.json "background.scripts", minus
  its background/index.js entry, which offscreen.js replaces.

  This list is generated, not hand-maintained: after changing the Firefox
  background scripts, run

      python3 docs/sync-offscreen.py

  A module missing here fails only in Chrome, and only at runtime.
-->
"""

FOOTER = """  <script src="offscreen.js"></script>
</body>
</html>
"""


def read_manifest(name):
    with open(os.path.join(ROOT, name, "manifest.json")) as fh:
        return json.load(fh)


def engine_modules():
    bg = read_manifest("Firefox")["background"]["scripts"]
    return [s for s in bg if s != "src/background/index.js"]


def current_offscreen():
    with open(OFFSCREEN) as fh:
        html = fh.read()
    return [m.replace("../../", "") for m in re.findall(r'src="([^"]+)"', html)
            if "offscreen.js" not in m]


def main():
    check = "--check" in sys.argv
    want = engine_modules()
    have = current_offscreen()

    problems = []
    if want != have:
        for m in want:
            if m not in have:
                problems.append("offscreen.html is missing " + m)
        for m in have:
            if m not in want:
                problems.append("offscreen.html loads " + m + ", which Firefox does not")
        if not problems:
            problems.append("offscreen.html loads the right modules in the wrong order")

    # content scripts must match exactly between the two builds
    f_cs = read_manifest("Firefox")["content_scripts"][0]["js"]
    c_cs = read_manifest("Chrome")["content_scripts"][0]["js"]
    if f_cs != c_cs:
        for m in f_cs:
            if m not in c_cs:
                problems.append("Chrome content_scripts is missing " + m)
        for m in c_cs:
            if m not in f_cs:
                problems.append("Chrome content_scripts has extra " + m)
        if f_cs != c_cs and all("content_scripts" not in p for p in problems):
            problems.append("content_scripts differ in order")

    if not problems:
        print("in step: %d engine modules, %d content scripts" % (len(want), len(f_cs)))
        return 0

    for p in problems:
        print("  " + p)

    if check:
        print("\ndrift detected; run without --check to fix offscreen.html")
        return 1

    tags = "\n".join('  <script src="../../%s"></script>' % s for s in want)
    with open(OFFSCREEN, "w") as fh:
        fh.write(HEADER + tags + "\n" + FOOTER)
    print("\nrewrote offscreen.html with %d modules" % len(want))
    print("content_scripts must be fixed by hand in Chrome/manifest.json"
          if f_cs != c_cs else "")
    return 0


if __name__ == "__main__":
    sys.exit(main())
