/* What the card actually renders. Peek's job is to show the destination's
 * content, so the card must stay quiet when there is nothing to add and be
 * unmissable when something is wrong. */
const { loadContent, fakeBrowser } = require("../harness");

const PAGE = `<!doctype html><html><body>
<a id="recipe" href="https://varecha.pravda.sk/r/cheesecake">Cheesecake</a>
<a id="fake" href="https://paypal-secure.verify.xyz/signin">Verify your account</a>
<a id="yt" href="https://www.youtube.com/watch?v=abc">A video</a>
</body></html>`;

const RECIPE = {
  ok: true, status: 200, finalUrl: "https://varecha.pravda.sk/r/cheesecake",
  chain: ["https://varecha.pravda.sk/r/cheesecake"], signals: { level: "", flags: [] },
  summary: { kind: "Recipe", heading: "Cheesecake", description: "", metrics: ["10 ingredients", "90 min"],
             ingredients: ["sušienky, 250 g", "maslo, 120 g"], steps: ["Rozdrvíme."],
             image: "", flags: [], source: ["JSON-LD"] },
  article: { ok: false, reason: "" }
};

const PHISH = {
  ok: true, status: 200, finalUrl: "https://paypal-secure.verify.xyz/signin",
  chain: ["https://paypal-secure.verify.xyz/signin"],
  signals: { level: "danger", flags: [
    { tone: "bad", text: "This page calls itself Paypal and asks for a password, but it is served from paypal-secure.verify.xyz, not paypal.com." }] },
  summary: { kind: "", heading: "", description: "", metrics: [], ingredients: null,
             steps: null, image: "", flags: [], source: [] },
  article: { ok: false, reason: "" }
};

function show(id, reply, pageUrl) {
  const api = fakeBrowser({ reply });
  const ctx = loadContent({ url: pageUrl || "https://www.google.com/search?q=x", html: PAGE,
                            globals: { browser: api, chrome: api } });
  ctx.P.settings.values.enabled = true;
  ctx.P.hover.show(ctx.document.getElementById(id));
  const host = ctx.document.querySelector("[data-peek]");
  return { ctx, api, host, card: host && host.shadowRoot.querySelector(".card") };
}

const settle = () => new Promise((r) => setTimeout(r, 20));

module.exports = {
  async "a recipe card shows ingredients and steps"(t) {
    const { card } = show("recipe", RECIPE);
    await settle();
    const text = card.textContent;
    t.match(text, /10 ingredients/, "metrics shown");
    t.match(text, /sušienky/, "ingredients shown");
    t.match(text, /Rozdrvíme/, "steps shown");
    t.notMatch(card.className, /danger|caution/, "an ordinary card must not be marked");
    t.equal(card.querySelector(".alarm"), null, "no alarm banner on an ordinary card");
  },

  async "a phishing card is unmissable"(t) {
    const { card } = show("fake", PHISH);
    await settle();
    t.match(card.className, /danger/, "the card itself is marked");
    const alarm = card.querySelector(".alarm");
    t.ok(alarm, "an alarm banner is present");
    t.ok(card.querySelector(".sign.danger"), "the warning sign is drawn");
    t.equal(card.children[1], alarm, "the alarm sits directly under the identity bar");
    t.match(alarm.textContent, /paypal-secure\.verify\.xyz/, "it names the domain");
  },

  async "disabled sites produce nothing at all"(t) {
    const { card, api } = show("yt", RECIPE);
    await settle();
    t.equal(card ? card.style.display : "none", "none", "no card for a disabled destination");
    t.equal(api._sent.length, 0, "and no request");
  },

  async "webmail gets a card but never a request"(t) {
    const { card, api } = show("recipe", RECIPE, "https://mail.google.com/mail/u/0/");
    await settle();
    t.equal(card.style.display, "block", "the card still appears");
    t.equal(api._sent.length, 0, "but nothing was fetched");
    t.match(card.textContent, /never fetches from your mail/i, "and it says why");
  },

  async "an orphaned extension explains itself once"(t) {
    const api = fakeBrowser({ dead: true });
    const ctx = loadContent({ url: "https://www.google.com/search?q=x", html: PAGE,
                              globals: { browser: api, chrome: api } });
    let threw = null;
    try { ctx.P.hover.show(ctx.document.getElementById("recipe")); }
    catch (e) { threw = e; }
    await settle();
    t.equal(threw, null, "an orphaned context must not throw");
    const card = ctx.document.querySelector("[data-peek]").shadowRoot.querySelector(".card");
    t.match(card.textContent, /Reload this page/, "it explains what happened");
  }
};
