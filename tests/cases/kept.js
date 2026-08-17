/* Pin holds a card open; Keep puts it somewhere you can come back to. They
 * used to be the same button, which is why nobody could tell what it did. */
const { loadContent, fakeBrowser } = require("../harness");

const PAGE = '<!doctype html><html><body>' +
  '<a id="a" href="https://index.sme.sk/c/nemci?utm_source=nl">Nemci narazili</a>' +
  '<a id="b" href="https://varecha.pravda.sk/r/cheesecake">Cheesecake</a>' +
  '</body></html>';

const reply = (heading) => ({
  ok: true, status: 200, finalUrl: "https://x/", chain: [],
  signals: { level: "", flags: [] },
  summary: { kind: "Article", heading, description: "Some description.", metrics: ["5 min read"],
             ingredients: null, steps: null, image: "", flags: [], source: [] },
  article: { ok: true, nodes: ["Body text."], minutes: 5, reason: "" }
});

async function setup(stored) {
  const api = fakeBrowser({ reply: reply("Nemci narazili"), storage: stored || {} });
  const ctx = loadContent({ url: "https://www.google.com/search?q=x", html: PAGE,
                            globals: { browser: api, chrome: api } });
  Object.defineProperty(ctx.window.navigator, "clipboard",
    { value: { writeText: () => Promise.resolve() }, configurable: true });
  await new Promise((r) => setTimeout(r, 15));
  ctx.P.settings.values.trigger = "hover";
  ctx.api = api;
  ctx.card = () => ctx.document.querySelector("[data-peek]").shadowRoot.querySelector(".card");
  ctx.panel = () => {
    const h = ctx.document.querySelector("[data-peek-sidebar]");
    return h && h.shadowRoot.querySelector(".panel");
  };
  ctx.button = (label) => [...ctx.card().querySelectorAll(".act, .openbtn")]
    .find((b) => b.textContent.indexOf(label) === 0);
  return ctx;
}

const settle = (ms) => new Promise((r) => setTimeout(r, ms || 30));

module.exports = {
  async "scrolling does not close a pinned card"(t) {
    const ctx = await setup();
    ctx.P.hover.show(ctx.document.getElementById("a"));
    await settle();

    ctx.P.hover.setPinned(true);
    /* The link scrolls out of view: getBoundingClientRect is stubbed to a
     * fixed on-screen rect, so move it off-screen deliberately. */
    ctx.document.getElementById("a").getBoundingClientRect =
      () => ({ left: 10, top: -900, right: 210, bottom: -880, width: 200, height: 20 });
    ctx.window.dispatchEvent(new ctx.window.Event("scroll"));
    await settle();

    t.equal(ctx.card().style.display, "block",
      "a pinned card must survive scrolling past its link");

    ctx.P.hover.setPinned(false);
    ctx.window.dispatchEvent(new ctx.window.Event("scroll"));
    await settle();
    t.equal(ctx.card().style.display, "none", "an unpinned one still follows the link");
  },

  async "keeping outlives the card"(t) {
    const ctx = await setup();
    ctx.P.hover.show(ctx.document.getElementById("a"));
    await settle();

    t.equal(ctx.P.kept.count, 0, "nothing kept to start with");
    ctx.button("Keep").dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
    await settle();

    t.equal(ctx.P.kept.count, 1, "one item kept");
    ctx.P.hover.hide();
    await settle();
    t.equal(ctx.P.kept.count, 1, "closing the card does not lose it");

    const item = ctx.P.kept.all[0];
    t.equal(item.cleanUrl, "https://index.sme.sk/c/nemci", "the stored link is the clean one");
    t.match(item.heading, /Nemci/, "with what the card was showing");
    t.ok(item.nodes, "and the article it had already fetched, so opening it re-asks nobody");
  },

  async "kept items survive a reload"(t) {
    const first = await setup();
    first.P.hover.show(first.document.getElementById("a"));
    await settle();
    first.button("Keep").dispatchEvent(new first.window.MouseEvent("click", { bubbles: true }));
    await settle();

    /* A second page load, with the storage the first one wrote. */
    const second = await setup(first.api._stored);
    t.equal(second.P.kept.count, 1, "kept pages come back after a reload");
    t.match(second.P.kept.all[0].heading, /Nemci/, "with their contents");
  },

  async "the same page is not kept twice"(t) {
    const ctx = await setup();
    ctx.P.hover.show(ctx.document.getElementById("a"));
    await settle();
    ctx.button("Keep").dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
    await settle();
    t.match(ctx.button("Kept").textContent, /Kept/, "the button says it is already kept");
    t.equal(ctx.P.kept.count, 1, "and a second click does not duplicate it");
  },

  async "the panel lists what is kept and can empty it"(t) {
    const ctx = await setup();
    ctx.P.hover.show(ctx.document.getElementById("a"));
    await settle();
    ctx.button("Keep").dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
    await settle();

    ctx.P.sidebar.show();
    await settle();
    const panel = ctx.panel();
    t.ok(panel && panel.style.display === "flex", "the panel opens");
    t.match(panel.textContent, /Nemci/, "and lists the kept page");
    t.match(panel.textContent, /1 page/, "with a count");

    ctx.P.kept.clear();
    await settle();
    t.match(panel.textContent, /Nothing kept yet/, "emptying it updates the panel live");
  },

  async "the collection is capped"(t) {
    const ctx = await setup();
    const data = { lookUrl: "https://x.example/", title: "x", flags: [], linkText: "x" };
    for (let i = 0; i < ctx.P.kept.MAX_ITEMS + 10; i++) {
      ctx.P.kept.add(Object.assign({}, data, { lookUrl: "https://x.example/" + i }), reply("Item " + i));
    }
    t.equal(ctx.P.kept.count, ctx.P.kept.MAX_ITEMS,
      "unbounded invisible state is how an extension earns 'it slowed my browser'");
    t.match(ctx.P.kept.all[0].heading, /Item 59/, "newest first");
  }
};
