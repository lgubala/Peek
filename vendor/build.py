#!/usr/bin/env python3
"""
Build Chrome/ and Firefox/ from the shared tree.

    python3 build.py            build both
    python3 build.py --check    build to a temp dir and diff; exit 1 on drift
    python3 build.py firefox    build one

Everything under src/ is shared. platform/<browser>/ is overlaid on top of it,
and that overlay is the *only* place the two builds are allowed to differ:

    platform/firefox/  MV2 background page, which has a DOM
    platform/chrome/   MV3 worker plus an offscreen document, because MV3
                       service workers have no DOM and Peek cannot parse HTML
                       without one

The script lists in both manifests, and the <script> tags in Chrome's offscreen
document, are generated from build/modules.json. That is the whole point: a
module can no longer be added to one browser and forgotten in the other.

Chrome/ and Firefox/ are committed so they can be uploaded to the stores
directly, and --check in CI proves they match the source they claim to be
built from.
"""

import argparse
import hashlib
import json
import os
import shutil
import sys
import tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
MODULES = os.path.join(ROOT, "build", "modules.json")
VERSION_FILE = os.path.join(ROOT, "build", "version.txt")

BROWSERS = ("firefox", "chrome")
ASSETS = ("vendor", "icons")

# Files that live in src/ but are not modules: copied, never listed.
STATIC = (".html", ".css", ".md")


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def version():
    with open(VERSION_FILE, encoding="utf-8") as fh:
        return fh.read().strip()


def resolve(entry):
    """A module path in modules.json to a path inside the built package."""
    if entry.startswith("@vendor/"):
        return entry[1:]                       # vendor/readability.js
    return "src/" + entry


def copy_tree(src, dst):
    for root, _dirs, files in os.walk(src):
        rel = os.path.relpath(root, src)
        target = os.path.join(dst, rel) if rel != "." else dst
        os.makedirs(target, exist_ok=True)
        for f in files:
            shutil.copy2(os.path.join(root, f), os.path.join(target, f))


def digest(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def contents(root):
    """Every file under root, relative path -> sha256."""
    out = {}
    for dirpath, _dirs, files in os.walk(root):
        for f in files:
            full = os.path.join(dirpath, f)
            out[os.path.relpath(full, root).replace(os.sep, "/")] = digest(full)
    return out


def sync(src, dst):
    """Make dst match src, touching only what actually changed.

    Not rmtree-and-copy: that rewrites every file on every build, so mtimes
    churn, it is slow, and a failure part way through leaves the destination
    destroyed rather than merely stale. Comparing by content also means a
    fresh `git checkout`, which sets every mtime to now, does not read as
    drift.
    """
    want = contents(src)
    have = contents(dst) if os.path.isdir(dst) else {}
    written = 0

    for rel, sha in want.items():
        if have.get(rel) == sha:
            continue
        target = os.path.join(dst, rel.replace("/", os.sep))
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copy2(os.path.join(src, rel.replace("/", os.sep)), target)
        written += 1

    for rel in have:
        if rel not in want:
            os.remove(os.path.join(dst, rel.replace("/", os.sep)))
            written += 1

    # prune directories the removals emptied
    for dirpath, dirs, files in os.walk(dst, topdown=False):
        if not dirs and not files and os.path.abspath(dirpath) != os.path.abspath(dst):
            os.rmdir(dirpath)

    return written


# --------------------------------------------------------------------------
# manifests
# --------------------------------------------------------------------------

DESCRIPTION = ("Read a link before you open it. Peek shows what is actually on "
               "the other side, without opening the page.")
HOMEPAGE = "https://github.com/lgubala/Peek"

ICONS = {"16": "icons/icon-16.png", "32": "icons/icon-32.png",
         "48": "icons/icon-48.png", "96": "icons/icon-96.png",
         "128": "icons/icon-128.png"}
TOOLBAR = {"16": "icons/icon-16.png", "32": "icons/icon-32.png",
           "48": "icons/icon-48.png"}


def firefox_manifest(mods, ver):
    engine = [resolve(m) for m in mods["engine"]]
    return {
        "manifest_version": 2,
        "name": "Peek",
        "version": ver,
        "description": DESCRIPTION,
        "homepage_url": HOMEPAGE,
        "browser_specific_settings": {
            "gecko": {
                "id": "peek@lgubala.dev",
                "strict_min_version": "115.0",
                "data_collection_permissions": {"required": ["none"]}
            }
        },
        "icons": dict(ICONS),
        "permissions": ["storage", "<all_urls>"],
        "background": {
            "scripts": engine + ["src/" + mods["entry"]["firefox_background"]],
            "persistent": False
        },
        "content_scripts": [{
            "matches": ["<all_urls>"],
            "js": [resolve(m) for m in mods["content"]],
            "run_at": "document_idle",
            "all_frames": False
        }],
        "browser_action": {"default_title": "Peek",
                           "default_popup": "src/popup/popup.html",
                           "default_icon": dict(TOOLBAR)}
    }


def chrome_manifest(mods, ver):
    icons = {k: v for k, v in ICONS.items() if k != "96"}   # Chrome uses 16/32/48/128
    return {
        "manifest_version": 3,
        "name": "Peek",
        "version": ver,
        "description": DESCRIPTION,
        "homepage_url": HOMEPAGE,
        "minimum_chrome_version": "116",
        "icons": icons,
        "permissions": ["storage", "offscreen"],
        "host_permissions": ["<all_urls>"],
        "background": {"service_worker": "src/" + mods["entry"]["chrome_worker"]},
        "content_scripts": [{
            "matches": ["<all_urls>"],
            "js": [resolve(m) for m in mods["content"]],
            "run_at": "document_idle",
            "all_frames": False
        }],
        "action": {"default_title": "Peek",
                   "default_popup": "src/popup/popup.html",
                   "default_icon": dict(TOOLBAR)}
    }


OFFSCREEN_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Peek engine</title>
</head>
<body>
<!--
  GENERATED by build.py from build/modules.json. Do not edit.

  Chrome MV3 service workers have no DOM, and Peek cannot parse HTML without
  one, so this invisible document hosts the engine. The scripts below are the
  same files, in the same order, that Firefox loads in its background page.
-->
%s
  <script src="../../src/%s"></script>
</body>
</html>
"""


def write_offscreen(out, mods):
    tags = "\n".join('  <script src="../../%s"></script>' % resolve(m)
                     for m in mods["engine"])
    path = os.path.join(out, "src", "offscreen", "offscreen.html")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(OFFSCREEN_TEMPLATE % (tags, mods["entry"]["chrome_offscreen"]))


def write_popup(out, mods):
    """The popup loads config/rules.js so DEFAULTS has one definition."""
    path = os.path.join(out, "src", "popup", "popup.html")
    with open(path, encoding="utf-8") as fh:
        html = fh.read()
    tags = "\n".join('<script src="../%s"></script>' % m for m in mods["popup"])
    marker = "<!--SCRIPTS-->"
    if marker in html:
        html = html.replace(marker, tags)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(html)


# --------------------------------------------------------------------------

def assemble(browser, out, mods, ver):
    """Build a complete package into an empty directory."""
    os.makedirs(out, exist_ok=True)

    copy_tree(os.path.join(ROOT, "src"), os.path.join(out, "src"))
    for asset in ASSETS:
        copy_tree(os.path.join(ROOT, asset), os.path.join(out, asset))
    copy_tree(os.path.join(ROOT, "platform", browser), out)

    manifest = firefox_manifest(mods, ver) if browser == "firefox" else chrome_manifest(mods, ver)
    with open(os.path.join(out, "manifest.json"), "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2)
        fh.write("\n")

    if browser == "chrome":
        write_offscreen(out, mods)
    write_popup(out, mods)

    # Every listed module must exist, or it fails at runtime in that browser only.
    missing = []
    listed = set(resolve(m) for m in mods["content"] + mods["engine"])
    if browser == "firefox":
        listed.add("src/" + mods["entry"]["firefox_background"])
    else:
        listed.add("src/" + mods["entry"]["chrome_worker"])
        listed.add("src/" + mods["entry"]["chrome_offscreen"])
    for m in sorted(listed):
        if not os.path.isfile(os.path.join(out, m)):
            missing.append(m)
    if missing:
        raise SystemExit("%s: listed but not present:\n  %s" % (browser, "\n  ".join(missing)))

    return len(listed)


def staged(browser, mods, ver):
    """Assemble into a temp directory. The caller decides what to do with it."""
    tmp = tempfile.mkdtemp(prefix="peek-build-")
    fresh = os.path.join(tmp, browser)
    try:
        assemble(browser, fresh, mods, ver)
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    return tmp, fresh


def build(browser, mods, ver):
    """Build, then sync into place. The committed tree is only touched once
    the new one is complete, so a failure leaves the old build intact."""
    tmp, fresh = staged(browser, mods, ver)
    try:
        out = os.path.join(ROOT, browser.capitalize())
        changed = sync(fresh, out)
        return len(contents(fresh)), changed
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def check(browser, mods, ver):
    tmp, fresh = staged(browser, mods, ver)
    try:
        return diff(fresh, os.path.join(ROOT, browser.capitalize()))
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def diff(fresh, committed):
    """Content comparison, so a checkout's fresh mtimes are not read as drift."""
    want = contents(fresh)
    have = contents(committed) if os.path.isdir(committed) else {}
    problems = []
    for rel in sorted(set(want) | set(have)):
        if rel not in have:
            problems.append("missing from the committed build: " + rel)
        elif rel not in want:
            problems.append("committed but not generated: " + rel)
        elif want[rel] != have[rel]:
            problems.append("differs: " + rel)
    return problems


def main():
    ap = argparse.ArgumentParser(description="Build Peek for Chrome and Firefox.")
    # Validated by hand rather than with choices=: under argparse in Python
    # 3.11 and earlier, nargs="*" validates the *default* against choices too,
    # so `build.py --check` with no positional argument died with
    # "invalid choice: []". It worked on 3.12, which is how it reached CI.
    ap.add_argument("browsers", nargs="*", metavar="BROWSER",
                    help="firefox, chrome, or nothing for both")
    ap.add_argument("--check", action="store_true",
                    help="verify the committed builds match the source")
    args = ap.parse_args()

    targets = args.browsers or list(BROWSERS)
    unknown = [b for b in targets if b not in BROWSERS]
    if unknown:
        ap.error("unknown browser: %s (expected %s)"
                 % (", ".join(unknown), " or ".join(BROWSERS)))

    mods = load(MODULES)
    ver = version()

    if args.check:
        bad = False
        for b in targets:
            problems = check(b, mods, ver)
            if problems:
                bad = True
                print("%s is out of date:" % b.capitalize())
                for p in problems:
                    print("  " + p)
            else:
                print("%s matches the source" % b.capitalize())
        if bad:
            print("\nrun: python3 build.py")
        return 1 if bad else 0

    for b in targets:
        total, changed = build(b, mods, ver)
        print("%-8s v%s  %d files, %d updated" % (b, ver, total, changed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
