/* Recognising tracking parameters, and — more importantly — not inventing
 * them. Attributing every ?ref= to Amazon was confidently wrong, which is the
 * one thing a hint must never be. */
const { loadModules } = require("../harness");

const MODULES = ["common/log.js", "config/rules.js", "config/trackers.js"];

module.exports = {
  "families catch parameters nobody has catalogued"(t) {
    const { P } = loadModules(MODULES);
    t.equal(P.trackers.owner("utm_source"), "Google Analytics", "utm_source");
    t.equal(P.trackers.owner("utm_brand_new_thing"), "Google Analytics",
      "an unseen utm_ parameter still counts");
    t.equal(P.trackers.owner("mtm_campaign"), "Matomo", "Matomo family");
    t.equal(P.trackers.owner("pk_kwd"), "Piwik", "Piwik family");
    t.equal(P.trackers.owner("hsa_acc"), "HubSpot", "HubSpot family");
  },

  "ordinary parameters are left alone"(t) {
    const { P } = loadModules(MODULES);
    for (const name of ["q", "query", "page", "sort", "id", "lang", "v", "s", "tab", "from"]) {
      t.equal(P.trackers.owner(name), null, "should not be a tracker: " + name);
    }
  },

  "ambiguous names count only on the sites where they mean tracking"(t) {
    const { P } = loadModules(MODULES);
    t.equal(P.trackers.owner("ref", "sme.sk"), null, "?ref= on a news site means nothing");
    t.equal(P.trackers.owner("ref", "www.amazon.co.uk"), "Amazon", "?ref= on Amazon is tracking");
    t.equal(P.trackers.owner("hash", "www.ebay.co.uk"), "eBay", "eBay's scoped names");
    t.equal(P.trackers.owner("hash", "example.com"), null, "…but not elsewhere");
  },

  "tracking baked into the path"(t) {
    const { P } = loadModules(MODULES);
    const hits = P.trackers.inPath("amazon.co.uk", "/dp/B08N5WRWNW/ref=nav_signin");
    t.equal(hits.length, 1, "Amazon path tracking found");
    t.equal(hits[0].owner, "Amazon", "attributed to Amazon");
    t.equal(P.trackers.inPath("sme.sk", "/c/12345/ref=x").length, 0,
      "the same shape elsewhere is not path tracking");
  },

  "a query is summarised by who is being told"(t) {
    const { P } = loadModules(MODULES);
    const params = [["utm_source", "nl"], ["fbclid", "abc"], ["q", "cheesecake"]];
    const s = P.trackers.summarise(params, "shop.example.com", "/p");
    t.equal(s.count, 2, "two trackers, not three");
    t.ok(s.owners.includes("Google Analytics") && s.owners.includes("Meta"),
      "named both owners, got " + JSON.stringify(s.owners));
  }
};
