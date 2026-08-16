/* The builds are generated, so the thing worth testing is that generation is
 * complete: every module listed exists, every context gets the ones it needs,
 * and the two browsers stay in step. Peek's two worst runtime bugs were both a
 * module present in one list and missing from another. */
const fs = require("fs");
const path = require("path");
const { MODULES, CORE, ROOT, resolve } = require("../harness");

const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8"));

module.exports = {
  "the tests' core list is a real subset of the engine"(t) {
    /* tests/harness.js keeps its own short list of modules every unit test
     * loads. If it drifts from the engine, tests pass against a combination
     * no browser ever runs. */
    for (const m of CORE) {
      t.ok(MODULES.engine.includes(m), "CORE has " + m + ", which the engine does not load");
    }
  },

  "every listed module exists in the source tree"(t) {
    for (const group of ["content", "engine"]) {
      for (const m of MODULES[group]) {
        for (const browser of ["firefox", "chrome"]) {
          t.ok(fs.existsSync(resolve(browser, m)),
            group + " module missing for " + browser + ": " + m);
        }
      }
    }
  },

  "the built manifests match the module manifest"(t) {
    const expected = MODULES.content.map((m) => (m.startsWith("@vendor/") ? m.slice(1) : "src/" + m));
    for (const browser of ["Firefox", "Chrome"]) {
      const m = read(browser + "/manifest.json");
      t.equal(JSON.stringify(m.content_scripts[0].js), JSON.stringify(expected),
        browser + " content scripts drifted from build/modules.json");
    }
  },

  "Chrome's offscreen document loads the whole engine"(t) {
    const html = fs.readFileSync(path.join(ROOT, "Chrome/src/offscreen/offscreen.html"), "utf8");
    const loaded = [...html.matchAll(/src="\.\.\/\.\.\/([^"]+)"/g)].map((m) => m[1]);
    for (const m of MODULES.engine) {
      t.ok(loaded.includes(resolve("chrome", m).split("/platform/chrome/")[1] || resolveRel(m)),
        "offscreen.html is missing " + m);
    }
    function resolveRel(mod) { return mod.startsWith("@vendor/") ? mod.slice(1) : "src/" + mod; }
  },

  "Firefox's background page loads the whole engine"(t) {
    const m = read("Firefox/manifest.json");
    const scripts = m.background.scripts;
    for (const mod of MODULES.engine) {
      const rel = mod.startsWith("@vendor/") ? mod.slice(1) : "src/" + mod;
      t.ok(scripts.includes(rel), "background scripts missing " + mod);
    }
    t.ok(scripts[scripts.length - 1].endsWith("background/index.js"),
      "the entry point must load last");
  },

  "both builds ship the same shared files"(t) {
    const list = (dir) => {
      const out = [];
      (function walk(d, prefix) {
        for (const f of fs.readdirSync(path.join(ROOT, d, prefix || ""), { withFileTypes: true })) {
          const rel = path.join(prefix || "", f.name);
          if (f.isDirectory()) walk(d, rel);
          else out.push(rel);
        }
      })(dir);
      return out.sort();
    };
    const platformOnly = /platform[\\/]|offscreen[\\/]|background[\\/]index\.js|manifest\.json/;
    const fx = list("Firefox/src").filter((f) => !platformOnly.test(f));
    const cr = list("Chrome/src").filter((f) => !platformOnly.test(f));
    t.equal(JSON.stringify(fx), JSON.stringify(cr),
      "the shared part of the two builds is not identical");
  },

  "no test or build file leaks into a package"(t) {
    for (const browser of ["Firefox", "Chrome"]) {
      const stray = [];
      (function walk(d) {
        for (const f of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
          const rel = path.join(d, f.name);
          if (f.isDirectory()) walk(rel);
          else if (/^(tests?|build|node_modules)$/.test(f.name) || /\.test\.js$/.test(f.name)) {
            stray.push(rel);
          }
        }
      })(browser);
      t.equal(stray.length, 0, browser + " contains development files: " + stray.join(", "));
    }
  }
};
