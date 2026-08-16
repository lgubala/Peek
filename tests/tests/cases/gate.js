/* What may be fetched, and what must never be.
 *
 * The false-positive direction matters more than it looks: an earlier version
 * matched action words anywhere in the path and refused seven of eight
 * ordinary news articles, which a user reads as the extension being broken.
 */
const { loadModules, Check } = require("../harness");

const MODULES = [
  "common/log.js", "config/rules.js", "config/sites.js", "config/trackers.js",
  "platform/dom.js", "common/text.js", "common/url.js", "common/policy.js",
  "background/gate.js"
];

const ALLOWED = [
  "https://www.theguardian.com/technology/how-to-delete-your-facebook-account",
  "https://sme.sk/2024/03/how-to-cancel-a-gym-membership",
  "https://example.com/guides/best-checkout-flows-in-ecommerce",
  "https://index.sme.sk/politics/why-young-people-dont-vote",
  "https://example.org/blog/how-to-remove-a-stain",
  "https://news.example.com/2026/confirm-or-deny-the-rumours",
  "https://shop.example.com/products/purchase-order-software",
  "https://wiki.example.com/wiki/Join_(SQL)",
  "https://example.com/reviews/best-vote-counting-machines",
  "https://blog.example.com/how-i-cancel-subscriptions-every-january",
  "https://varecha.pravda.sk/recepty/cheesecake-fotorecept/36357-recept.html",
  "https://github.com/lgubala/Peek"
];

const REFUSED = [
  "https://mail.example.com/logout",
  "https://x.example.com/account/unsubscribe",
  "https://a.example.com/reset-password/abc",
  "https://b.example.com/p?access_token=eyJ",
  "https://c.example.com/invite/accept?token=z",
  "https://shop.example.com/checkout",
  "https://shop.example.com/cart/add?id=9",
  "https://x.example.com/account/delete",
  "https://ipro3.dmesp.ru/clicks.php?m=7b57",
  "https://t.example.com/track/abc123",
  "https://user:pw@example.com/",
  "ftp://example.com/file"
];

/* Hostnames that contain a blocked word but are ordinary businesses. */
const NOT_ADULT = [
  "https://www.xxxlutz.de/kuche/kuchenzeilen",
  "https://escortcarhire.co.uk/book",
  "https://www.sexpistols.net/tour"
];

const ADULT = ["https://www.pornhub.com/", "https://porn.example.com/", "https://xxx.example.com/"];

module.exports = {
  "ordinary pages are fetchable"(t) {
    const { P } = loadModules(MODULES);
    for (const url of ALLOWED) {
      const g = P.gate.check(url);
      t.ok(g.ok, "refused an ordinary page: " + url + (g.ok ? "" : "\n      " + g.reason));
    }
  },

  "action links are refused"(t) {
    const { P } = loadModules(MODULES);
    for (const url of REFUSED) {
      t.ok(!P.gate.check(url).ok, "let through an action link: " + url);
    }
  },

  "category matching respects word boundaries"(t) {
    const { P } = loadModules(MODULES);
    for (const url of NOT_ADULT) {
      t.ok(P.gate.check(url).ok, "refused an ordinary business: " + url);
    }
    for (const url of ADULT) {
      t.ok(!P.gate.check(url).ok, "did not refuse: " + url);
    }
  },

  "action words must be whole path segments"(t) {
    const { P } = loadModules(MODULES);
    t.ok(!P.gate.check("https://x.com/logout").ok, "/logout should be refused");
    t.ok(P.gate.check("https://x.com/logout-explained-for-beginners").ok,
      "a slug containing 'logout' should be fine");
    t.ok(!P.gate.check("https://x.com/a/delete/42").ok, "/delete/42 should be refused");
    t.ok(P.gate.check("https://x.com/how-to-delete-things").ok,
      "a slug containing 'delete' should be fine");
  }
};
