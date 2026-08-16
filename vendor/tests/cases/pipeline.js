/* A whole lookup, with the network stubbed: gate, fetch, redirect chain,
 * extraction, reading, signals. Runs in both browsers' engine contexts,
 * because Peek has twice shipped a bug that existed only in Chrome. */
const { loadEngine, fakeBrowser } = require("../harness");

const RECIPE = `<html><head><title>Cheesecake | Varecha</title>
<script type="application/ld+json">${JSON.stringify({
  "@type": "Recipe", name: "Cheesecake (fotorecept)",
  recipeIngredient: ["su&scaron;ienky, 250 g", "maslo, 120 g"],
  totalTime: "PT90M", recipeYield: "12 porci&iacute;",
  recipeInstructions: [{ "@type": "HowToStep", text: "Su&scaron;ienky rozdrv&iacute;me." }]
})}</script></head><body></body></html>`;

function engine(browser, routes) {
  const api = fakeBrowser({});
  const g = { browser: api, chrome: api };
  g.fetch = async (url) => {
    const hit = routes[url];
    if (!hit) return { ok: false, status: 404, url, type: "basic",
                       headers: { get: () => "" }, body: null, text: async () => "" };
    if (hit.redirect) {
      return { ok: false, status: 302, url, type: "basic",
               headers: { get: (h) => (h.toLowerCase() === "location" ? hit.redirect : "") },
               body: null };
    }
    const bytes = Buffer.from(hit.body, "utf8");
    return {
      ok: true, status: 200, url, type: "basic",
      headers: { get: (h) => (h.toLowerCase() === "content-type" ? "text/html; charset=utf-8" : "") },
      body: { getReader() { let d = false; return {
        read: async () => (d ? { done: true } : ((d = true), { done: false, value: bytes })),
        cancel: async () => {} }; } }
    };
  };
  const ctx = loadEngine({ browser, globals: g });
  ctx.api = api;
  return ctx;
}

const ROUTES = {
  "https://varecha.pravda.sk/r/cheesecake": { body: RECIPE },
  "https://t.example.com/go": { redirect: "https://hop.example.de/x" },
  "https://hop.example.de/x": { redirect: "https://varecha.pravda.sk/r/cheesecake" }
};

for (const browser of ["firefox", "chrome"]) {
  module.exports[`a recipe reaches the card (${browser})`] = async (t) => {
    const { P } = engine(browser, ROUTES);
    const r = await P.pipeline.look("https://varecha.pravda.sk/r/cheesecake", { images: true });
    t.ok(r.ok, "lookup should succeed: " + (r.reason || ""));
    t.equal(r.summary.kind, "Recipe", "recognised as a recipe");
    t.equal(r.summary.ingredients.length, 2, "ingredients extracted");
    t.match(r.summary.ingredients.join(" "), /sušienky/, "HTML entities decoded");
    t.match(r.summary.steps.join(" "), /rozdrvíme/i, "instructions extracted");
  };

  module.exports[`redirects are followed and reported (${browser})`] = async (t) => {
    const { P } = engine(browser, ROUTES);
    const r = await P.pipeline.look("https://t.example.com/go", {});
    t.ok(r.ok, "should follow the chain: " + (r.reason || ""));
    t.equal(r.chain.length, 3, "three hops recorded");
    t.equal(r.finalUrl, "https://varecha.pravda.sk/r/cheesecake", "ended at the destination");
    t.match(JSON.stringify(r.signals.flags), /Travels through/, "the route is described");
  };

  module.exports[`the gate is enforced inside the pipeline (${browser})`] = async (t) => {
    const { P } = engine(browser, ROUTES);
    const out = await P.pipeline.look("https://mail.example.com/logout", {});
    t.ok(out.blocked, "an action link must not be fetched");
    const yt = await P.pipeline.look("https://www.youtube.com/watch?v=abc", {});
    t.ok(yt.blocked, "a disabled site must not be fetched");
  };
}
