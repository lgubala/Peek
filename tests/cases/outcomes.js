/* Reading an arbitrary page is a ladder, and every rung fails on some of the
 * web. What matters is that Peek says which rung answered, in language that
 * describes the page rather than apologising — and that a page it cannot read
 * is never dressed as a page that is dangerous. */
const { loadUnit, loadContent, fakeBrowser } = require("../harness");

const EXTRA = [
  "@vendor/readability.js",          // read() cannot work without it
  "reader/images.js", "reader/sanitize.js", "reader/tidy.js",
  "reader/serialize.js", "reader/signals.js", "reader/files.js", "reader/index.js"
];

const prose = (n) => "<p>" + "Real article text, at a readable length. ".repeat(n) + "</p>";

module.exports = {
  "a JavaScript shell is described, not apologised for"(t) {
    const { P } = loadUnit(EXTRA);
    const r = P.reader.read(
      /* A real single-page app ships a handful of bundles, which is what the
       * detection keys on; one script tag is not a shell. */
      '<html><head><title>App</title></head><body><div id="root"></div>' +
      '<script src="/runtime.js"></script><script src="/vendor.js"></script>' +
      '<script src="/main.js"></script><script src="/polyfills.js"></script>' +
      '</body></html>',
      "https://app.example.com/", {});
    t.equal(r.ok, false, "nothing to read");
    t.equal(r.code, "js-shell", "the outcome has a stable code");
    t.match(r.reason, /built by JavaScript/, "and describes the page: " + r.reason);
    t.notMatch(r.reason, /could not|failed|sorry/i,
      "the wording should describe the page, not Peek's disappointment");
  },

  "a menu is called a menu"(t) {
    const { P } = loadUnit(EXTRA);
    const nav = "<ul>" + ["Home", "News", "Sport", "Culture", "About", "Contact"]
      .map((x) => '<li><a href="https://s.example/' + x + '">' + x + "</a></li>").join("") + "</ul>";
    const r = P.reader.read("<html><body><div>" + nav + nav + "</div></body></html>",
      "https://s.example/", {});
    t.equal(r.ok, false, "not offered as an article");
    t.ok(r.code === "menu" || r.code === "furniture", "recognised as navigation: " + r.code);
  },

  "a real article reports which rung answered"(t) {
    const { P } = loadUnit(EXTRA);
    const r = P.reader.read(
      "<html><head><title>Nemci narazili</title></head><body><article><h1>Nemci</h1>" +
      prose(30) + "</article></body></html>", "https://index.sme.sk/c/x", {});
    t.ok(r.ok, "read successfully: " + r.reason);
    t.ok(r.via, "and says how: " + r.via);
    t.equal(r.code, "", "with no failure code");
  },

  "a limitation is separated from 'this is not an article'"(t) {
    const { P } = loadUnit(EXTRA);
    /* The distinction that makes failures legible: could not read what was
     * there, versus there was nothing to read. */
    for (const code of ["js-shell", "too-large", "parse-failed"]) {
      t.ok(P.reader.LIMITATION.has(code), code + " is Peek's limitation");
    }
    for (const code of ["menu", "furniture", "no-structure", "thin"]) {
      t.ok(!P.reader.LIMITATION.has(code), code + " is a fact about the page");
    }
  },

  "every outcome has wording, and none of it sounds like an alarm"(t) {
    const { P } = loadUnit(EXTRA);
    const codes = Object.keys(P.reader.OUTCOME);
    t.ok(codes.length >= 6, "the ladder's outcomes are enumerated: " + codes.length);
    for (const code of codes) {
      const text = P.reader.OUTCOME[code];
      t.ok(text && text.length > 20, code + " needs a real sentence");
      t.ok(/[.!]$/.test(text), code + " should read as a sentence, got: " + text);
    }
  },

  async "an unreadable page is shown as information, not as a warning"(t) {
    const reply = {
      ok: true, status: 200, finalUrl: "https://app.example.com/", chain: [],
      signals: { level: "", flags: [] }, flags: [],
      summary: { kind: "Article", heading: "The Dashboard", description: "A description.",
                 metrics: ["2 min read"], ingredients: null, steps: null, image: "",
                 flags: [], source: ["OpenGraph"] },
      article: { ok: false, code: "js-shell", limitation: true,
                 reason: "The text is built by JavaScript, so the HTML Peek received holds none of it." }
    };
    const api = fakeBrowser({ reply });
    const ctx = loadContent({
      url: "https://www.google.com/search?q=x",
      html: '<body><a id="a" href="https://app.example.com/">Dashboard</a></body>',
      globals: { browser: api, chrome: api }
    });
    await new Promise((r) => setTimeout(r, 15));
    ctx.P.settings.values.trigger = "hover";
    ctx.P.hover.show(ctx.document.getElementById("a"));
    await new Promise((r) => setTimeout(r, 30));

    const card = ctx.document.querySelector("[data-peek]").shadowRoot.querySelector(".card");
    t.ok(card.querySelector(".unread"), "rendered as a neutral note");
    t.equal(card.querySelector(".flag"), null,
      "and not as a flag, which is the language of a security warning");
    t.match(card.querySelector(".unread").textContent, /built by JavaScript/, "it says why");
    t.match(card.querySelector(".unread").textContent, /Showing/,
      "and what is on offer instead: " + card.querySelector(".unread").textContent);
    t.notMatch(card.className, /danger|caution/, "the card itself stays unmarked");
  }
};
