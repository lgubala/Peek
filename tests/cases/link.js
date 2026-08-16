/* Everything Peek can say about a link without fetching it. */
const { loadContent, fakeBrowser } = require("../harness");

const PAGE = `<!doctype html><html><body>
<a id="wrapped" href="https://www.google.com/url?q=https://varecha.pravda.sk/r?utm_source=g%26fbclid=z&sa=U&ved=2ah">Cheesecake</a>
<a id="b64" href="https://ipro3.dmesp.ru/clicks.php?m=7b57&r=aHR0cHM6Ly93d3cuc3FsbWFuYWdlci5uZXQvcHJvZHVjdHM=">DB tools</a>
<a id="at" href="https://paypal.com@evil-tracker.ru/login">paypal.com</a>
<a id="lies" href="https://malware-drop.tk/x">Read it on nytimes.com</a>
<a id="mail" href="mailto:oxfam.aidrep@hotmail.com">contact us</a>
<a id="person" href="mailto:jana.kovacova@gmail.com">Jana</a>
<a id="charity" href="mailto:enquiries@oxfam.org.uk">Oxfam</a>
<a id="plain" href="https://index.sme.sk/c/nemci-narazili">Nemci narazili</a>
<nav><a id="nav" href="/domov">Domov</a><a href="/svet">Svet</a><a href="/sport">Šport</a></nav>
</body></html>`;

function setup() {
  const api = fakeBrowser({ reply: null });
  const ctx = loadContent({ url: "https://www.google.com/search?q=x", html: PAGE,
                            globals: { browser: api, chrome: api } });
  return ctx;
}

const of = (ctx, id) =>
  ctx.P.analyze.analyze(ctx.document.getElementById(id), "https://www.google.com/search?q=x");

module.exports = {
  "search-engine redirects are unwrapped"(t) {
    const ctx = setup();
    const d = of(ctx, "wrapped");
    t.equal(d.title, "pravda.sk", "shows the destination, not google.com");
    t.ok(d.via && /google\.com/.test(d.via.host), "records the hop it came through");
  },

  "base64 redirects are unwrapped"(t) {
    const ctx = setup();
    const d = of(ctx, "b64");
    t.equal(d.title, "sqlmanager.net", "decoded the destination out of the link");
    t.equal(d.via.host, "ipro3.dmesp.ru", "kept the tracker as the hop");
    t.equal(d.via.origin && d.via.origin.code, "RU", "named the hop's registry");
  },

  "deceptive links are flagged"(t) {
    const ctx = setup();
    t.match(JSON.stringify(of(ctx, "at").flags), /@ before the domain/,
      "an @ before the domain");
    t.match(JSON.stringify(of(ctx, "lies").flags), /nytimes\.com/,
      "link text claiming another site");
  },

  "an ordinary link says nothing alarming"(t) {
    const ctx = setup();
    const d = of(ctx, "plain");
    t.equal(d.flags.length, 0, "no flags on a plain news link: " + JSON.stringify(d.flags));
    t.equal(d.origin && d.origin.code, "SK", "still names the registry");
  },

  "email addresses are inspected"(t) {
    const ctx = setup();
    t.match(JSON.stringify(of(ctx, "mail").flags), /free mail provider/,
      "an office-sounding address at a free provider");
    t.equal(of(ctx, "person").flags.length, 0, "an ordinary personal address");
    t.equal(of(ctx, "charity").flags.length, 0, "a real organisation's address");
  },

  "navigation is recognised"(t) {
    const ctx = setup();
    t.ok(ctx.P.nav.isNavLink(ctx.document.getElementById("nav")), "a link inside <nav>");
    t.ok(!ctx.P.nav.isNavLink(ctx.document.getElementById("plain")), "an article link");
  }
};
