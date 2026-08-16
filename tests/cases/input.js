/* When the card should *not* appear, and how a keyboard user reaches it.
 * Every hover-preview extension collects one-star reviews for showing up
 * uninvited, so the negative cases are the product here. */
const { loadContent, fakeBrowser } = require("../harness");

const PAGE = '<!doctype html><html><body><p>Some text to select.</p>' +
             '<a id="a" href="https://index.sme.sk/c/x">Nemci narazili</a></body></html>';

const REPLY = {
  ok: true, status: 200, finalUrl: "https://x/", chain: ["https://x/"],
  signals: { level: "", flags: [] },
  summary: { kind: "Article", heading: "", description: "", metrics: [], ingredients: null,
             steps: null, image: "", flags: [], source: [] },
  article: { ok: false, reason: "" }
};

async function setup(trigger) {
  const api = fakeBrowser({ reply: REPLY });
  const ctx = loadContent({ url: "https://www.google.com/search?q=x", html: PAGE,
                            globals: { browser: api, chrome: api } });
  await new Promise((r) => setTimeout(r, 10));
  ctx.P.settings.values.trigger = trigger || "hover";
  ctx.P.settings.values.dwell = 5;
  ctx.api = api;
  ctx.card = () => {
    const host = ctx.document.querySelector("[data-peek]");
    return host && host.shadowRoot.querySelector(".card");
  };
  return ctx;
}

function move(ctx, x, y) {
  ctx.document.dispatchEvent(new ctx.window.MouseEvent("mousemove",
    { bubbles: true, clientX: x, clientY: y }));
}

const hover = (ctx) => ctx.document.getElementById("a")
  .dispatchEvent(new ctx.window.MouseEvent("mouseover", { bubbles: true }));

const settle = (ms) => new Promise((r) => setTimeout(r, ms || 30));

module.exports = {
  async "a pointer flying across a link is not intent"(t) {
    const ctx = await setup();
    /* Two moves 600px apart, a millisecond or two apart: very fast. */
    move(ctx, 0, 0);
    await new Promise((r) => setTimeout(r, 2));
    move(ctx, 600, 400);
    t.match(ctx.P.hover.busy() || "", /passing/, "should read as passing through");
    hover(ctx);
    await settle();
    t.equal(ctx.card(), null, "no card while the pointer is flying");
  },

  async "a settled pointer is intent"(t) {
    const ctx = await setup();
    move(ctx, 100, 100);
    await new Promise((r) => setTimeout(r, 40));
    move(ctx, 102, 101);
    t.equal(ctx.P.hover.busy(), null, "a slow move is not busy");
    hover(ctx);
    await settle();
    t.ok(ctx.card() && ctx.card().style.display === "block", "the card appears");
  },

  async "nothing appears mid-drag"(t) {
    const ctx = await setup();
    ctx.document.dispatchEvent(new ctx.window.MouseEvent("mousedown", { bubbles: true }));
    t.equal(ctx.P.hover.busy(), "dragging", "a held button is a drag");
    hover(ctx);
    await settle();
    t.equal(ctx.card(), null, "no card while a button is down");

    ctx.document.dispatchEvent(new ctx.window.MouseEvent("mouseup", { bubbles: true }));
    t.equal(ctx.P.hover.busy(), null, "and released is not");
  },

  async "the card is reachable and announced"(t) {
    const ctx = await setup();
    ctx.P.hover.show(ctx.document.getElementById("a"));
    await settle();
    const card = ctx.card();
    t.equal(card.getAttribute("role"), "dialog", "the card is a dialog");
    t.ok(card.getAttribute("aria-label"), "with a label");
    t.equal(card.getAttribute("tabindex"), "-1", "and can take focus");

    const host = ctx.document.querySelector("[data-peek]");
    const live = host.shadowRoot.querySelector('[aria-live="polite"]');
    t.ok(live, "a polite live region exists");
    t.match(live.textContent, /Preview of/, "and says a preview appeared: " + live.textContent);
    t.match(live.textContent, /F6/, "and how to read it");
  },

  async "Escape returns focus to the link"(t) {
    const ctx = await setup();
    const link = ctx.document.getElementById("a");
    link.focus();                       // as a keyboard user would arrive
    ctx.P.hover.show(link);
    await settle();

    ctx.document.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "F6", bubbles: true }));
    ctx.document.dispatchEvent(new ctx.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    t.equal(ctx.card().style.display, "none", "Escape dismisses");
    t.equal(ctx.document.activeElement, link, "and puts focus back on the link");
  }
};
