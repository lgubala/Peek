/* What summons the card. A modifier is an explicit request, so it overrides
 * every guess Peek makes about intent in ambient mode — but not the safety
 * gate, which is about what a fetch might *do*, not what you meant. */
const { loadContent, fakeBrowser } = require("../harness");

const PAGE = `<!doctype html><html><body>
<a id="article" href="https://index.sme.sk/c/nemci-narazili">Nemci narazili</a>
<a id="yt" href="https://www.youtube.com/watch?v=abc">A video</a>
<nav><a id="nav" href="/domov">Domov</a><a href="/svet">Svet</a><a href="/sport">Šport</a></nav>
</body></html>`;

const REPLY = {
  ok: true, status: 200, finalUrl: "https://x/", chain: ["https://x/"],
  signals: { level: "", flags: [] },
  summary: { kind: "Article", heading: "", description: "", metrics: [], ingredients: null,
             steps: null, image: "", flags: [], source: [] },
  article: { ok: false, reason: "" }
};

/* Listeners are attached after settings.load() resolves, so a test that
 * dispatches immediately fires into a page with nothing listening. */
async function setup(trigger, pageUrl) {
  const api = fakeBrowser({ reply: REPLY });
  const ctx = loadContent({ url: pageUrl || "https://www.google.com/search?q=x", html: PAGE,
                            globals: { browser: api, chrome: api } });
  ctx.P.settings.values.trigger = trigger;
  ctx.api = api;
  ctx.card = () => {
    const host = ctx.document.querySelector("[data-peek]");
    return host && host.shadowRoot.querySelector(".card");
  };
  await new Promise((r) => setTimeout(r, 10));   // let attach() happen
  ctx.P.settings.values.trigger = trigger;
  ctx.P.settings.values.dwell = 5;
  return ctx;
}

/* A mouseover carrying (or not carrying) the modifier. */
function hover(ctx, id, mods) {
  const el = ctx.document.getElementById(id);
  const e = new ctx.window.MouseEvent("mouseover", Object.assign({ bubbles: true }, mods || {}));
  el.dispatchEvent(e);
  return el;
}

const settle = (ms) => new Promise((r) => setTimeout(r, ms || 30));

module.exports = {
  async "without the modifier, nothing happens"(t) {
    const ctx = await setup("alt");
    hover(ctx, "article", { altKey: false });
    await settle();
    t.equal(ctx.card(), null, "a bare hover must not summon the card");
    t.equal(ctx.api._sent.length, 0, "and must not fetch");
  },

  async "with the modifier, the card appears"(t) {
    const ctx = await setup("alt");
    hover(ctx, "article", { altKey: true });
    await settle();
    t.ok(ctx.card() && ctx.card().style.display === "block", "Alt+hover summons the card");
    t.equal(ctx.api._sent.filter((m) => m.type === "peek:look").length, 1, "and fetches once");
  },

  async "the modifier overrides every guess about intent"(t) {
    const ctx = await setup("alt");

    hover(ctx, "nav", { altKey: true });
    await settle();
    t.ok(ctx.card() && ctx.card().style.display === "block",
      "a navigation link should peek when you asked for it");

    ctx.P.hover.hide();
    hover(ctx, "yt", { altKey: true });
    await settle();
    t.ok(ctx.card() && ctx.card().style.display === "block",
      "a site Peek stays off should peek when you asked for it");
  },

  async "webmail fetches only when asked"(t) {
    const ambient = await setup("hover", "https://mail.google.com/mail/u/0/");
    hover(ambient, "article", {});
    await settle();
    t.equal(ambient.api._sent.filter((m) => m.type === "peek:look").length, 0,
      "ambient mode still never fetches from a mailbox");

    const asked = await setup("alt", "https://mail.google.com/mail/u/0/");
    hover(asked, "article", { altKey: true });
    await settle();
    t.equal(asked.api._sent.filter((m) => m.type === "peek:look").length, 1,
      "holding the key is you asking, so it fetches");
  },

  async "plain hover still works when chosen"(t) {
    const ctx = await setup("hover");
    hover(ctx, "article", {});
    await settle();
    t.ok(ctx.card() && ctx.card().style.display === "block", "ambient mode is still available");

    ctx.P.hover.hide();
    hover(ctx, "nav", {});
    await settle();
    t.equal(ctx.card().style.display, "none", "and still skips navigation");
  },

  async "pressing the key while already on a link works"(t) {
    const ctx = await setup("alt");
    hover(ctx, "article", { altKey: false });
    await settle(10);
    t.equal(ctx.card(), null, "nothing yet");

    ctx.document.dispatchEvent(new ctx.window.KeyboardEvent("keydown",
      { key: "Alt", altKey: true, bubbles: true }));
    await settle();
    t.ok(ctx.card() && ctx.card().style.display === "block",
      "pressing the key should not require moving the mouse again");
  }
};
