#!/usr/bin/env node
/**
 * Build Chrome/ and Firefox/ from the shared tree.
 *
 *   node scripts/build.mjs            build both
 *   node scripts/build.mjs --check    verify the committed builds match; exit 1 if not
 *   node scripts/build.mjs firefox    build one
 *
 * Everything under src/ is shared. platform/<browser>/ is overlaid on top, and
 * that overlay is the only place the two builds may differ:
 *
 *   platform/firefox/  MV2 background page, which has a DOM
 *   platform/chrome/   MV3 worker plus an offscreen document, because MV3
 *                      service workers have no DOM and Peek cannot parse HTML
 *                      without one
 *
 * Both manifests and Chrome's offscreen.html are generated from
 * build/modules.json, so a module cannot be added to one browser and forgotten
 * in the other — the failure mode that produced two shipped bugs, each visible
 * only in Chrome and only at runtime.
 *
 * Chrome/ and Firefox/ are committed so they can be uploaded to the stores and
 * loaded from a clone without a build step. --check proves they are what the
 * source says they are.
 *
 * Node rather than Python: this is a JavaScript project, the tests already
 * need Node, and one toolchain is one fewer thing to install and to break in
 * CI.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync,
         copyFileSync, rmSync, existsSync, mkdtempSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BROWSERS = ["firefox", "chrome"];
const ASSETS = ["vendor", "icons"];

const read = (p) => readFileSync(join(ROOT, p), "utf8");
const modules = () => JSON.parse(read("build/modules.json"));
const version = () => JSON.parse(read("package.json")).version;

/** A module path from modules.json to its path inside a package. */
const resolve = (m) => (m.startsWith("@vendor/") ? m.slice(1) : "src/" + m);

/* --- file helpers -------------------------------------------------------- */

function walk(dir, base = dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

const digest = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

function contents(dir) {
  const out = new Map();
  for (const rel of walk(dir)) out.set(rel, digest(join(dir, rel)));
  return out;
}

function copyTree(from, to) {
  for (const rel of walk(from)) {
    const target = join(to, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(from, rel), target);
  }
}

/**
 * Make `to` match `from`, touching only what changed.
 *
 * Not delete-and-copy: that rewrites every file on every build, and a failure
 * part way through leaves the destination destroyed rather than merely stale.
 * Comparing contents also means a fresh checkout, which sets every mtime to
 * now, is not mistaken for drift.
 */
function sync(from, to) {
  const want = contents(from);
  const have = existsSync(to) ? contents(to) : new Map();
  let changed = 0;

  for (const [rel, sha] of want) {
    if (have.get(rel) === sha) continue;
    const target = join(to, rel);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(from, rel), target);
    changed++;
  }
  for (const rel of have.keys()) {
    if (!want.has(rel)) { rmSync(join(to, rel)); changed++; }
  }
  return changed;
}

/* --- manifests ----------------------------------------------------------- */

const DESCRIPTION =
  "Read a link before you open it. Peek shows what is actually on the other " +
  "side, without opening the page.";
const HOMEPAGE = "https://github.com/lgubala/Peek";

const ICONS = {
  16: "icons/icon-16.png", 32: "icons/icon-32.png", 48: "icons/icon-48.png",
  96: "icons/icon-96.png", 128: "icons/icon-128.png"
};
const TOOLBAR = { 16: ICONS[16], 32: ICONS[32], 48: ICONS[48] };

const contentScripts = (mods) => [{
  matches: ["<all_urls>"],
  js: mods.content.map(resolve),
  run_at: "document_idle",
  all_frames: false
}];

function firefoxManifest(mods, ver) {
  return {
    manifest_version: 2,
    name: "Peek",
    version: ver,
    description: DESCRIPTION,
    homepage_url: HOMEPAGE,
    browser_specific_settings: {
      gecko: {
        id: "peek@lgubala.dev",
        strict_min_version: "115.0",
        data_collection_permissions: { required: ["none"] }
      }
    },
    icons: { ...ICONS },
    permissions: ["storage", "<all_urls>"],
    background: {
      scripts: [...mods.engine.map(resolve), "src/" + mods.entry.firefox_background],
      persistent: false
    },
    content_scripts: contentScripts(mods),
    browser_action: {
      default_title: "Peek",
      default_popup: "src/popup/popup.html",
      default_icon: { ...TOOLBAR }
    }
  };
}

function chromeManifest(mods, ver) {
  const icons = { ...ICONS };
  delete icons[96];                       // Chrome uses 16/32/48/128
  return {
    manifest_version: 3,
    name: "Peek",
    version: ver,
    description: DESCRIPTION,
    homepage_url: HOMEPAGE,
    minimum_chrome_version: "116",
    icons,
    permissions: ["storage", "offscreen"],
    host_permissions: ["<all_urls>"],
    background: { service_worker: "src/" + mods.entry.chrome_worker },
    content_scripts: contentScripts(mods),
    action: {
      default_title: "Peek",
      default_popup: "src/popup/popup.html",
      default_icon: { ...TOOLBAR }
    }
  };
}

/* --- generated pages ----------------------------------------------------- */

function writeOffscreen(out, mods) {
  const tags = mods.engine
    .map((m) => `  <script src="../../${resolve(m)}"></script>`).join("\n");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Peek engine</title>
</head>
<body>
<!--
  GENERATED by scripts/build.mjs from build/modules.json. Do not edit.

  Chrome MV3 service workers have no DOM, and Peek cannot parse HTML without
  one, so this invisible document hosts the engine. The scripts below are the
  same files, in the same order, that Firefox loads in its background page.
-->
${tags}
  <script src="../../src/${mods.entry.chrome_offscreen}"></script>
</body>
</html>
`;
  const path = join(out, "src/offscreen/offscreen.html");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, html);
}

/** The popup loads config/rules.js so DEFAULTS has one definition. */
function writePopup(out, mods) {
  const path = join(out, "src/popup/popup.html");
  const tags = mods.popup.map((m) => `<script src="../${m}"></script>`).join("\n");
  writeFileSync(path, readFileSync(path, "utf8").replace("<!--SCRIPTS-->", tags));
}

/* --- assembly ------------------------------------------------------------ */

function assemble(browser, out, mods, ver) {
  mkdirSync(out, { recursive: true });
  copyTree(join(ROOT, "src"), join(out, "src"));
  for (const asset of ASSETS) copyTree(join(ROOT, asset), join(out, asset));
  copyTree(join(ROOT, "platform", browser), out);

  const manifest = browser === "firefox" ? firefoxManifest(mods, ver) : chromeManifest(mods, ver);
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  if (browser === "chrome") writeOffscreen(out, mods);
  writePopup(out, mods);

  /* Anything listed but absent fails only in the browser that listed it, and
   * only at runtime. Catch it here instead. */
  const listed = new Set([...mods.content, ...mods.engine].map(resolve));
  listed.add("src/" + (browser === "firefox"
    ? mods.entry.firefox_background : mods.entry.chrome_worker));
  if (browser === "chrome") listed.add("src/" + mods.entry.chrome_offscreen);

  const missing = [...listed].filter((m) => !existsSync(join(out, m))).sort();
  if (missing.length) {
    throw new Error(`${browser}: listed but not present:\n  ${missing.join("\n  ")}`);
  }
  return listed.size;
}

function staged(browser, mods, ver) {
  const tmp = mkdtempSync(join(tmpdir(), "peek-build-"));
  try {
    assemble(browser, join(tmp, browser), mods, ver);
    return tmp;
  } catch (e) {
    rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
}

function build(browser, mods, ver) {
  const tmp = staged(browser, mods, ver);
  try {
    const fresh = join(tmp, browser);
    const out = join(ROOT, browser[0].toUpperCase() + browser.slice(1));
    return { total: contents(fresh).size, changed: sync(fresh, out) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function check(browser, mods, ver) {
  const tmp = staged(browser, mods, ver);
  try {
    const want = contents(join(tmp, browser));
    const dir = join(ROOT, browser[0].toUpperCase() + browser.slice(1));
    const have = existsSync(dir) ? contents(dir) : new Map();
    const problems = [];
    for (const rel of [...new Set([...want.keys(), ...have.keys()])].sort()) {
      if (!have.has(rel)) problems.push("missing from the committed build: " + rel);
      else if (!want.has(rel)) problems.push("committed but not generated: " + rel);
      else if (want.get(rel) !== have.get(rel)) problems.push("differs: " + rel);
    }
    return problems;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/* --- cli ----------------------------------------------------------------- */

const argv = process.argv.slice(2);
const checking = argv.includes("--check");
const targets = argv.filter((a) => !a.startsWith("-"));

const unknown = targets.filter((t) => !BROWSERS.includes(t));
if (unknown.length) {
  console.error(`unknown browser: ${unknown.join(", ")} (expected ${BROWSERS.join(" or ")})`);
  process.exit(2);
}

const mods = modules();
const ver = version();
const chosen = targets.length ? targets : BROWSERS;

if (checking) {
  let bad = false;
  for (const browser of chosen) {
    const problems = check(browser, mods, ver);
    const name = browser[0].toUpperCase() + browser.slice(1);
    if (problems.length) {
      bad = true;
      console.log(`${name} is out of date:`);
      for (const p of problems) console.log("  " + p);
    } else {
      console.log(`${name} matches the source`);
    }
  }
  if (bad) console.log("\nrun: npm run build");
  process.exit(bad ? 1 : 0);
}

for (const browser of chosen) {
  const { total, changed } = build(browser, mods, ver);
  console.log(`${browser.padEnd(8)} v${ver}  ${total} files, ${changed} updated`);
}
