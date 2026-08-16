/* Peek — tests/harness.js
 * Loading the extension outside a browser, and a few assertions.
 *
 * Tests run against src/ and platform/, never against a built copy, so a
 * passing suite says the source is right rather than that the last build was.
 * The module order comes from build/modules.json — the same file the build
 * reads — so a test cannot accidentally load a set of modules no browser does.
 */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MODULES = JSON.parse(fs.readFileSync(path.join(ROOT, "build/modules.json"), "utf8"));

/* src/ first, then the platform overlay, exactly as build.py layers them. */
function resolve(browser, entry) {
  const rel = entry.startsWith("@vendor/") ? entry.slice(1) : "src/" + entry;
  const overlay = path.join(ROOT, "platform", browser, rel);
  return fs.existsSync(overlay) ? overlay : path.join(ROOT, rel);
}

function jsdomFor(url, html) {
  return new JSDOM(html || "<body></body>", { url: url || "https://example.com/", pretendToBeVisual: true });
}

/* Globals a content script or background page can count on. */
function installGlobals(dom, extra) {
  const w = dom.window;
  global.window = w;
  global.self = w;
  global.document = w.document;
  global.location = w.location;
  for (const k of ["DOMParser", "Node", "Element", "HTMLElement", "CSSStyleSheet",
                   "AbortController", "MouseEvent", "Event"]) {
    if (w[k]) global[k] = w[k];
  }
  global.TextDecoder = require("util").TextDecoder;
  /* Node 21+ ships a read-only `navigator` global of its own, so a plain
   * assignment is silently ignored and extension code reads Node's navigator
   * instead of jsdom's — no clipboard, no userAgent, nothing it expects. */
  Object.defineProperty(global, "navigator", {
    value: w.navigator, configurable: true, writable: true
  });
  global.atob = (s) => Buffer.from(s, "base64").toString("binary");
  global.requestAnimationFrame = (cb) => cb();
  w.requestAnimationFrame = (cb) => cb();
  /* jsdom reports every element as zero-sized, which would fail eligible(). */
  w.Element.prototype.getBoundingClientRect = () => ({
    left: 10, top: 10, right: 210, bottom: 30, width: 200, height: 20
  });
  Object.assign(global, extra || {});
  return w;
}

function evaluate(files, w) {
  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");
    try {
      // eslint-disable-next-line no-eval
      (0, eval)(code);
    } catch (e) {
      throw new Error("loading " + path.relative(ROOT, file) + ": " + e.message);
    }
  }
  return (w && w.Peek) || global.Peek || self.Peek;
}

/* --- the three contexts, loaded the way each browser loads them ---------- */

function loadEngine(opts) {
  opts = opts || {};
  const browser = opts.browser || "firefox";
  const dom = jsdomFor(opts.url);
  const w = installGlobals(dom, opts.globals);
  const files = MODULES.engine.map((m) => resolve(browser, m));
  if (opts.entry !== false) {
    files.push(resolve(browser, browser === "firefox"
      ? MODULES.entry.firefox_background : MODULES.entry.chrome_offscreen));
  }
  return { P: evaluate(files, w), window: w, dom };
}

function loadContent(opts) {
  opts = opts || {};
  const dom = jsdomFor(opts.url, opts.html);
  const w = installGlobals(dom, opts.globals);
  const files = MODULES.content.map((m) => resolve(opts.browser || "firefox", m));
  return { P: evaluate(files, w), window: w, dom, document: w.document };
}

/* The modules almost every unit test needs before it can load anything else:
 * config, the DOM shim, and the small shared helpers. Defined here so that a
 * new config module does not mean editing ten hardcoded lists — which is what
 * happened when reader tuning moved out of rules.js, and 26 tests failed for
 * a reason that had nothing to do with what they were testing.
 *
 * tests/cases/build-integrity.js asserts this stays a subset of the engine. */
const CORE = [
  "common/log.js",
  "config/rules.js",
  "config/reader.js",
  "config/sites.js",
  "config/trackers.js",
  "platform/dom.js",
  "common/text.js",
  "common/url.js",
  "common/policy.js",
  "link/tld.js"
];

/* CORE plus whatever the test actually exercises. */
function loadUnit(extra, opts) {
  return loadModules(CORE.concat(extra || []), opts);
}

/* Only the modules a test names, for unit work. */
function loadModules(names, opts) {
  opts = opts || {};
  const dom = jsdomFor(opts.url, opts.html);
  const w = installGlobals(dom, opts.globals);
  return { P: evaluate(names.map((m) => resolve(opts.browser || "firefox", m)), w), window: w, dom };
}

/* --- a stub extension API ----------------------------------------------- */

function fakeBrowser(opts) {
  opts = opts || {};
  const stored = Object.assign({}, opts.storage);
  const listeners = [];
  const sent = [];

  const opened = [];

  const api = {
    runtime: {
      id: opts.dead ? undefined : "peek@test",
      getManifest: () => ({ version: "test" }),
      getURL: (p) => "moz-extension://test/" + p,
      onMessage: { addListener: (f) => { api.runtime._handler = f; } },
      /* Present in every real browser; the stub needs it or loading a
       * background script that registers a first-run hook throws. */
      onInstalled: { addListener: (f) => { api.runtime._installed = f; } },
      sendMessage: (msg) => {
        sent.push(msg);
        if (opts.dead) throw new Error("Extension context invalidated.");
        return Promise.resolve(typeof opts.reply === "function" ? opts.reply(msg) : opts.reply);
      }
    },
    storage: {
      local: {
        get: () => Promise.resolve(stored),
        set: (patch) => {
          Object.assign(stored, patch);
          const changes = {};
          for (const k of Object.keys(patch)) changes[k] = { newValue: patch[k] };
          listeners.forEach((f) => f(changes, "local"));
          return Promise.resolve();
        }
      },
      onChanged: { addListener: (f) => listeners.push(f) }
    },
    tabs: {
      query: () => Promise.resolve([{ url: opts.tabUrl || "https://example.com/" }]),
      create: (info) => { opened.push(info.url); return Promise.resolve({ id: 1 }); }
    },
    _sent: sent,
    _opened: opened,
    _install: (reason) => api.runtime._installed && api.runtime._installed({ reason }),
    _stored: stored,
    _fire: (patch) => api.storage.local.set(patch)
  };
  return api;
}

/* --- assertions ---------------------------------------------------------- */

class Check {
  constructor(name) { this.name = name; this.failures = []; this.count = 0; }

  ok(cond, what) {
    this.count++;
    if (!cond) this.failures.push(what);
    return cond;
  }

  equal(actual, expected, what) {
    return this.ok(actual === expected,
      what + "\n      expected: " + JSON.stringify(expected) +
             "\n      actual:   " + JSON.stringify(actual));
  }

  match(value, re, what) {
    return this.ok(re.test(String(value)),
      what + "\n      " + re + " did not match: " + JSON.stringify(String(value)).slice(0, 160));
  }

  notMatch(value, re, what) {
    return this.ok(!re.test(String(value)),
      what + "\n      " + re + " unexpectedly matched: " + JSON.stringify(String(value)).slice(0, 160));
  }
}

module.exports = { loadEngine, loadContent, loadModules, loadUnit, fakeBrowser,
                   Check, MODULES, CORE, ROOT, resolve };
