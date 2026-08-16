/* First run, and the image modes. Both are promises made to the user in the
 * interface, so they are worth asserting rather than eyeballing. */
const fs = require("fs");
const path = require("path");
const { loadEngine, loadModules, fakeBrowser, ROOT } = require("../harness");

const MODULES = [
  "common/log.js", "config/rules.js", "config/sites.js", "config/trackers.js",
  "platform/dom.js", "common/text.js", "common/url.js", "link/tld.js",
  "reader/images.js", "reader/sanitize.js", "reader/tidy.js",
  "reader/serialize.js", "reader/signals.js", "reader/index.js"
];

const article = "<p>" + "Ordinary prose, at some length, to clear the threshold. ".repeat(8) + "</p>";
const PAGE =
  "<article>" +
  "<img src='https://www.sme.sk/photo/hero.jpg' width='1200' alt='own'>" +
  /* Not a URL containing "pixel", "badge" or the like: those are dropped as
   * decoration whatever the image mode, which would mask what is being
   * tested here. */
  "<img src='https://images.cdn-example.net/photos/large.jpg' width='1200' alt='third party'>" +
  article + "</article>";

const srcsOf = (r) => (JSON.stringify(r.nodes).match(/"src":"([^"]+)"/g) || []).map((m) => m.slice(7, -1));

module.exports = {
  "the first-run page opens on install, and only on install"(t) {
    const api = fakeBrowser({});
    loadEngine({ browser: "firefox", globals: { browser: api, chrome: api } });

    api._install("update");
    t.equal(api._opened.length, 0, "an update must not reopen it");

    api._install("install");
    t.equal(api._opened.length, 1, "a fresh install opens it once");
    t.match(api._opened[0], /onboarding\.html$/, "and opens the right page");
  },

  "the first-run page says the two things it has to"(t) {
    const html = fs.readFileSync(
      path.join(ROOT, "src/onboarding/onboarding.html"), "utf8");
    t.match(html, /request from your IP address/i,
      "it must disclose that Peek fetches pages");
    t.match(html, /triggerKey/,
      "it must show which key summons the card");
    t.notMatch(html, /<script>[^<]/,
      "no inline script: extension pages run under a strict CSP");
  },

  "images: off requests nothing"(t) {
    const { P } = loadModules(MODULES);
    const r = P.reader.clean(PAGE, { images: "off", maxImages: 4, pageHost: "www.sme.sk" });
    t.equal(srcsOf(r).length, 0, "no image should survive");
  },

  "images: same keeps the site's own and drops third parties"(t) {
    const { P } = loadModules(MODULES);
    const r = P.reader.clean(PAGE, { images: "same", maxImages: 4, pageHost: "www.sme.sk" });
    const srcs = srcsOf(r);
    t.equal(srcs.length, 1, "exactly one image should survive: " + JSON.stringify(srcs));
    t.match(srcs[0] || "", /sme\.sk/, "and it should be the site's own");
  },

  "images: any keeps both"(t) {
    const { P } = loadModules(MODULES);
    const r = P.reader.clean(PAGE, { images: "any", maxImages: 4, pageHost: "www.sme.sk" });
    t.equal(srcsOf(r).length, 2, "both images should survive");
  },

  "the old boolean setting still means something"(t) {
    const { P } = loadModules(MODULES);
    t.equal(srcsOf(P.reader.clean(PAGE, { images: true, maxImages: 4, pageHost: "www.sme.sk" })).length,
      2, "images: true behaves like 'any' for anyone upgrading");
    t.equal(srcsOf(P.reader.clean(PAGE, { images: false, maxImages: 4, pageHost: "www.sme.sk" })).length,
      0, "images: false behaves like 'off'");
  }
};
