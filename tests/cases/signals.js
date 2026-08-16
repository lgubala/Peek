/* Judging the page rather than the URL. The quiet cases matter as much as the
 * loud ones: flagging a genuine login page teaches people to ignore flags. */
const { loadModules } = require("../harness");

const MODULES = [
  "common/log.js", "config/rules.js", "config/sites.js", "config/trackers.js",
  "platform/dom.js", "common/text.js", "common/url.js", "link/tld.js",
  "reader/signals.js"
];

const login = (brand, formAttrs) =>
  `<html><head><title>${brand} - Log in</title></head><body><h1>${brand}</h1>` +
  `<form ${formAttrs || ""}><input type="text"><input type="password"></form></body></html>`;

const prose = (n) => "<p>" + "Ordinary article copy, at some length. ".repeat(n) + "</p>";

function level(P, html, url) {
  return P.signals.inspect(P.platform.parse(html), url).level;
}

module.exports = {
  "a brand served from the wrong domain"(t) {
    const { P } = loadModules(MODULES);
    t.equal(level(P, login("PayPal"), "https://paypal-secure.verify.xyz/signin"), "danger",
      "fake PayPal login");
    t.equal(level(P, login("Microsoft"), "https://login-microsoft.ru/auth"), "danger",
      "fake Microsoft login");
  },

  "the genuine article stays quiet"(t) {
    const { P } = loadModules(MODULES);
    t.equal(level(P, login("PayPal"), "https://www.paypal.com/signin"), "", "real PayPal");
    t.equal(level(P, login("Microsoft"), "https://login.microsoftonline.com/"), "",
      "real Microsoft, on a domain it owns but is not named after");
    t.equal(level(P, login("GitHub"), "https://github.com/login"), "",
      "a brand with no mapping should not be guessed at");
  },

  "an ordinary login page is not suspicious"(t) {
    const { P } = loadModules(MODULES);
    const bare = "<html><head><title>Members</title></head><body><form><input type='password'></form></body></html>";
    t.equal(level(P, bare, "https://intranet.example.org/"), "",
      "a login page on an ordinary domain says nothing");
    t.equal(level(P, bare, "https://secure-portal.tk/"), "danger",
      "the same page on a throwaway registry does");
    t.equal(level(P, bare, "http://185.23.44.7/login"), "danger",
      "…and on a bare IP");
  },

  "a form that posts somewhere else"(t) {
    const { P } = loadModules(MODULES);
    t.equal(level(P, login("Steam", 'action="https://collector.example.ru/p"'),
      "https://steamcommunlty.com/login"), "danger", "cross-origin credential post");
  },

  "ordinary pages are never marked"(t) {
    const { P } = loadModules(MODULES);
    const news = `<html><head><title>Nemci narazili | SME</title></head><body><h1>Nemci</h1>${prose(25)}</body></html>`;
    const shop = `<html><head><title>Mobily Motorola | Alza.sk</title></head><body><h1>Motorola</h1>` +
                 `<form action="/search"><input type="text"></form>${prose(25)}</body></html>`;
    t.equal(level(P, news, "https://index.sme.sk/c/nemci"), "", "a news article");
    t.equal(level(P, shop, "https://www.alza.sk/motorola"), "", "a shop with a search box");
  },

  "the redirect route is described"(t) {
    const { P } = loadModules(MODULES);
    const r = P.signals.describeChain([
      "https://ipro3.dmesp.ru/clicks.php?r=x",
      "https://track.example.de/t",
      "https://www.sqlmanager.net/products"
    ]);
    t.equal(r.flags.length, 1, "one line describing the route");
    t.match(r.flags[0].text, /ipro3\.dmesp\.ru/, "names the hop");
    t.equal(P.signals.describeChain(["https://x.example/only"]).flags.length, 0,
      "no route line when there was no redirect");
  }
};
