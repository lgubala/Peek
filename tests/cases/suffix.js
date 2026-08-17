/* Which domain someone actually registered.
 *
 * Everything that judges "is this the same site" keys off this — ownedBy(), the
 * brand-mismatch check, the leaves-this-site chip — so being wrong here is
 * being wrong about safety. The dangerous direction is treating two unrelated
 * sites as one owner, which is precisely what free hosting invites. */
const { loadUnit } = require("../harness");

const EXTRA = ["reader/signals.js"];

const PAIRS = [
  /* ordinary */
  ["www.google.com", "google.com"],
  ["index.sme.sk", "sme.sk"],
  ["sme.sk", "sme.sk"],
  ["a.b.c.example.com", "example.com"],

  /* irregular second levels, listed explicitly */
  ["news.bbc.co.uk", "bbc.co.uk"],
  ["shop.example.com.au", "example.com.au"],
  ["x.example.co.jp", "example.co.jp"],

  /* regular ccTLD second levels, covered by the pattern rather than a list —
     every one of these was wrong before */
  ["site.gov.br", "site.gov.br"],
  ["shop.com.ng", "shop.com.ng"],
  ["news.co.ke", "news.co.ke"],
  ["uni.ac.at", "uni.ac.at"],
  ["x.com.pe", "x.com.pe"],
  ["y.net.cn", "y.net.cn"],
  ["z.co.ug", "z.co.ug"],

  /* free hosting: the security-critical group */
  ["evil.pages.dev", "evil.pages.dev"],
  ["victim.pages.dev", "victim.pages.dev"],
  ["thing.onrender.com", "thing.onrender.com"],
  ["app.fly.dev", "app.fly.dev"],
  ["tunnel.ngrok-free.app", "tunnel.ngrok-free.app"],
  ["bucket.s3.amazonaws.com", "bucket.s3.amazonaws.com"],
  ["site.azurewebsites.net", "site.azurewebsites.net"],
  ["repo.github.io", "repo.github.io"],
  ["shop.myshopify.com", "shop.myshopify.com"],
  ["blog.substack.com", "blog.substack.com"]
];

module.exports = {
  "registrable domains"(t) {
    const { P } = loadUnit(EXTRA);
    for (const [host, want] of PAIRS) {
      t.equal(P.url.registrable(host), want, host);
    }
  },

  "two strangers on the same free host are not the same site"(t) {
    const { P } = loadUnit(EXTRA);
    /* The false negative a phisher wants: if these collapse to one registrable
     * domain, every same-site check silently passes between them. */
    const pairs = [
      ["evil.pages.dev", "victim.pages.dev"],
      ["phish.onrender.com", "bank.onrender.com"],
      ["a.ngrok-free.app", "b.ngrok-free.app"],
      ["x.github.io", "y.github.io"]
    ];
    for (const [a, b] of pairs) {
      t.ok(P.url.registrable(a) !== P.url.registrable(b),
        a + " and " + b + " must not share a registrable domain");
    }
  },

  "a brand's real subdomains still count as the brand"(t) {
    const { P } = loadUnit(EXTRA);
    t.ok(P.signals.ownedBy("login.microsoftonline.com", "microsoft"),
      "Microsoft's login host belongs to Microsoft");
    t.ok(P.signals.ownedBy("www.paypal.com", "paypal"), "PayPal's own host");
    t.ok(!P.signals.ownedBy("paypal.pages.dev", "paypal"),
      "a free-hosting subdomain named after a brand does not belong to it");
    t.ok(!P.signals.ownedBy("paypal-secure.verify.xyz", "paypal"), "nor a lookalike");
  },

  "an unknown suffix fails safe"(t) {
    const { P } = loadUnit(EXTRA);
    /* Peek does not bundle the full Public Suffix List, so unknown suffixes
     * will exist. Treating one as a suffix splits two sites apart, which is
     * the harmless mistake; merging them is the dangerous one. */
    t.equal(P.url.registrable("a.co.zz"), "a.co.zz",
      "an invented ccTLD second level is still treated as a suffix");
    t.ok(P.url.registrable("one.co.zz") !== P.url.registrable("two.co.zz"),
      "so two sites under it stay distinct");
  }
};
