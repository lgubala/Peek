/* Cost and behaviour that only show up at scale: what every tab pays, how big
 * a page Peek will read, and whether the card jumps when content lands. */
const { loadUnit, loadContent, fakeBrowser, MODULES } = require("../harness");

const EXTRA = ["background/inflight.js", "background/gate.js", "background/fetcher.js"];

function response(bytes, ctype) {
  return {
    ok: true, status: 200, url: "https://x/", type: "basic",
    headers: { get: (h) => (h.toLowerCase() === "content-type" ? ctype : null) },
    body: { getReader() {
      let sent = 0;
      return {
        read: async () => {
          if (sent >= bytes.length) return { done: true };
          const chunk = bytes.subarray(sent, sent + 64 * 1024);
          sent += chunk.length;
          return { done: false, value: chunk };
        },
        cancel: async () => {}
      };
    } }
  };
}

module.exports = {
  "the content script carries nothing the engine alone needs"(t) {
    /* Reader tuning used to sit in the bundle parsed in every tab. */
    const enginesOnly = ["config/reader.js"];
    for (const m of enginesOnly) {
      t.ok(!MODULES.content.includes(m), m + " should not be in the content script");
      t.ok(MODULES.engine.includes(m), m + " should be in the engine");
    }
  },

  async "a large HTML page is read in full"(t) {
    const { P } = loadUnit(EXTRA);
    /* A megabyte and a half: bigger than the old 640 KB cap, ordinary for a
     * modern news page. Truncating it broke the tree and Peek blamed the site. */
    const big = Buffer.from("<html><body>" + "<p>text</p>".repeat(140000) + "</body></html>", "utf8");
    t.ok(big.length > 1024 * 1024, "the fixture is over a megabyte: " + big.length);

    const r = await P.fetcher.readCapped(response(big, "text/html; charset=utf-8"));
    t.ok(!r.truncated, "an HTML page of this size should not be truncated");
    t.match(r.text.slice(-20), /<\/html>/, "and should reach the end of the document");
  },

  async "other content types keep the smaller budget"(t) {
    const { P } = loadUnit(EXTRA);
    const json = Buffer.from(JSON.stringify({ pad: "x".repeat(900 * 1024) }), "utf8");
    const r = await P.fetcher.readCapped(response(json, "application/json"));
    t.ok(r.truncated, "a JSON answer this large is not answering the question");
  },

  async "the card reserves space while it is loading"(t) {
    const api = fakeBrowser({ reply: () => new Promise(() => {}) });   // never settles
    const ctx = loadContent({
      url: "https://www.google.com/search?q=x",
      html: '<body><a id="a" href="https://index.sme.sk/c/x">Nemci</a></body>',
      globals: { browser: api, chrome: api }
    });
    await new Promise((r) => setTimeout(r, 10));
    ctx.P.settings.values.trigger = "hover";
    ctx.P.hover.show(ctx.document.getElementById("a"));
    await new Promise((r) => setTimeout(r, 20));

    const card = ctx.document.querySelector("[data-peek]").shadowRoot.querySelector(".card");
    const loading = card.querySelector(".loading");
    t.ok(loading, "a loading body is rendered rather than a bare line of text");
    t.ok(loading.querySelectorAll(".skel").length >= 3,
      "with placeholder lines, so the card does not grow when content arrives");
  }
};
