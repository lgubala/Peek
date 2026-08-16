/* The card was read-only apart from Open. These are the things people
 * actually want to do with what they are looking at. */
const { loadContent, loadModules, fakeBrowser } = require("../harness");

const PAGE = '<!doctype html><html><body>' +
  '<a id="tracked" href="https://shop.example.com/p?utm_source=nl&id=42&fbclid=abc">Widget</a>' +
  '<a id="clean" href="https://index.sme.sk/c/nemci">Nemci</a></body></html>';

const RECIPE = {
  ok: true, status: 200, finalUrl: "https://varecha.pravda.sk/r", chain: [],
  signals: { level: "", flags: [] },
  summary: { kind: "Recipe", heading: "Cheesecake", description: "", metrics: ["10 ingredients"],
             ingredients: ["sušienky, 250 g", "maslo, 120 g"],
             steps: ["§ Korpus", "Rozdrvíme sušienky."], image: "", flags: [], source: [] },
  article: { ok: false, reason: "" }
};

async function setup(reply) {
  const copied = [];
  const api = fakeBrowser({ reply });
  const ctx = loadContent({ url: "https://www.google.com/search?q=x", html: PAGE,
                            globals: { browser: api, chrome: api } });
  /* The harness points the global navigator at jsdom's; this adds the
   * clipboard, which jsdom does not implement. */
  Object.defineProperty(ctx.window.navigator, "clipboard", {
    value: { writeText: (t) => { copied.push(t); return Promise.resolve(); } },
    configurable: true
  });
  await new Promise((r) => setTimeout(r, 10));
  ctx.P.settings.values.trigger = "hover";
  ctx.copied = copied;
  ctx.card = () => ctx.document.querySelector("[data-peek]").shadowRoot.querySelector(".card");
  ctx.button = (label) => [...ctx.card().querySelectorAll(".act, .openbtn")]
    .find((b) => b.textContent.indexOf(label) === 0);
  return ctx;
}

const settle = (ms) => new Promise((r) => setTimeout(r, ms || 30));
const click = (ctx, el) => el.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));

module.exports = {
  "a clean link drops the tracking and keeps the rest"(t) {
    const { P } = loadModules(["common/log.js", "config/rules.js", "config/trackers.js", "common/url.js"]);
    t.equal(P.trackers.clean("https://shop.example.com/p?utm_source=nl&id=42&fbclid=abc"),
      "https://shop.example.com/p?id=42", "tracking removed, id kept");
    t.equal(P.trackers.clean("https://sme.sk/hladanie?q=cheesecake&page=2#x"),
      "https://sme.sk/hladanie?q=cheesecake&page=2#x", "an ordinary query is untouched");
    t.equal(P.trackers.clean("not a url"), "not a url", "nonsense is returned as-is");
  },

  async "the copy button offers the clean link"(t) {
    const ctx = await setup(RECIPE);
    ctx.P.hover.show(ctx.document.getElementById("tracked"));
    await settle();
    const btn = ctx.button("Copy clean link");
    t.ok(btn, "the button says the link will be cleaned");
    click(ctx, btn);
    await settle();
    t.equal(ctx.copied[0], "https://shop.example.com/p?id=42", "and copies the clean one");
  },

  async "an untracked link is just Copy link"(t) {
    const ctx = await setup(RECIPE);
    ctx.P.hover.show(ctx.document.getElementById("clean"));
    await settle();
    t.ok(ctx.button("Copy link"), "no promise to clean what is already clean");
    t.ok(!ctx.button("Copy clean link"), "and not the other label");
  },

  async "copy text takes what the card is showing"(t) {
    const ctx = await setup(RECIPE);
    ctx.P.hover.show(ctx.document.getElementById("clean"));
    await settle();
    click(ctx, ctx.button("Copy text"));
    await settle();
    const text = ctx.copied[0] || "";
    t.match(text, /sušienky, 250 g/, "ingredients are included");
    t.match(text, /Rozdrvíme/, "and the steps");
    t.match(text, /index\.sme\.sk/, "and the link, so a paste has its source");
  },

  async "a pinned card survives the pointer leaving"(t) {
    const ctx = await setup(RECIPE);
    ctx.P.hover.show(ctx.document.getElementById("clean"));
    await settle();

    click(ctx, ctx.button("Pin"));
    await settle();
    t.ok(ctx.P.hover.pinned, "pinned");
    t.match(ctx.card().className, /pinned/, "and says so");

    ctx.card().dispatchEvent(new ctx.window.MouseEvent("mouseleave", { bubbles: false }));
    await settle(60);
    t.equal(ctx.card().style.display, "block", "leaving does not close a pinned card");

    ctx.P.hover.show(ctx.document.getElementById("tracked"));
    await settle();
    t.match(ctx.card().textContent, /sme\.sk/, "and another link does not replace it");

    ctx.document.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    t.equal(ctx.card().style.display, "none", "Escape still closes it");
    t.ok(!ctx.P.hover.pinned, "and unpins");
  }
};
