/* The declarative handlers. Each is a data entry, so what needs pinning down
 * is the shape: does it match the right URLs, ask the right endpoint, and turn
 * the answer into something the card can show — and does it get out of the way
 * when the API says nothing useful. */
const { loadEngine, fakeBrowser } = require("../harness");

/* Recorded API responses, trimmed to the fields Peek reads. */
const RESPONSES = {
  "https://en.wikipedia.org/api/rest_v1/page/summary/Peephole": {
    type: "standard", title: "Peephole",
    description: "opening through a door allowing viewing from the inside",
    extract: "A peephole, spyhole, or door viewer is an opening through a door " +
             "allowing the viewer to look from the inside to the outside.",
    thumbnail: { source: "https://upload.wikimedia.org/peephole.jpg" }
  },
  "https://registry.npmjs.org/lodash": {
    name: "lodash", description: "Lodash modular utilities.",
    "dist-tags": { latest: "4.17.21" },
    versions: { "4.17.21": { license: "MIT" } },
    time: { modified: "2021-02-20T15:42:16.891Z" },
    maintainers: [{ name: "a" }, { name: "b" }]
  },
  "https://pypi.org/pypi/requests/json": {
    info: { name: "requests", summary: "Python HTTP for Humans.", version: "2.32.3",
            license: "Apache-2.0", requires_python: ">=3.8", author: "Kenneth Reitz" }
  },
  "https://hacker-news.firebaseio.com/v0/item/8863.json": {
    type: "story", title: "My YC app: Dropbox - Throw away your USB drive",
    by: "dhouston", score: 111, descendants: 71, url: "http://www.getdropbox.com/u/2/screencast.html"
  },
  "https://hacker-news.firebaseio.com/v0/item/999999999.json": null,
  "https://api.stackexchange.com/2.3/questions/11227809?site=stackoverflow&filter=withbody": {
    items: [{
      title: "Why is processing a sorted array faster than an unsorted array?",
      body: "<p>Here is a piece of C++ code that shows some very peculiar behaviour.</p>",
      is_answered: true, score: 27043, answer_count: 25,
      tags: ["java", "c++", "performance"]
    }]
  },
  "https://api.crossref.org/works/10.1038%2Fnature12373": {
    message: {
      title: ["Mycobacterium tuberculosis in ancient DNA"],
      abstract: "<jats:p>An analysis of ancient genomes.</jats:p>",
      "container-title": ["Nature"],
      issued: { "date-parts": [[2013, 8]] },
      author: [{ given: "Kirsten", family: "Bos" }, { given: "Verena", family: "Schuenemann" },
               { given: "G.", family: "Golding" }, { given: "Extra", family: "Author" }],
      "is-referenced-by-count": 412
    }
  }
};

function engine(extra) {
  const api = fakeBrowser({});
  const asked = [];
  const g = { browser: api, chrome: api };
  g.fetch = async (url) => {
    asked.push(url);
    const body = Object.prototype.hasOwnProperty.call(RESPONSES, url)
      ? RESPONSES[url] : (extra && extra[url]);
    if (body === undefined) {
      return { ok: false, status: 404, url, type: "basic",
               headers: { get: () => "" }, body: null, text: async () => "" };
    }
    return { ok: true, status: 200, url, type: "basic",
             headers: { get: () => "application/json" },
             json: async () => body, body: null, text: async () => JSON.stringify(body) };
  };
  const ctx = loadEngine({ globals: g });
  ctx.asked = asked;
  return ctx;
}

module.exports = {
  async "Wikipedia answers with the first paragraph"(t) {
    const { P, asked } = engine();
    const r = await P.pipeline.look("https://en.wikipedia.org/wiki/Peephole", { id: 1 });
    t.equal(r.handler, "wikipedia", "the Wikipedia handler claimed it");
    t.match(asked[0], /rest_v1\/page\/summary\/Peephole/, "asked the summary endpoint");
    t.equal(r.summary.heading, "Peephole", "title");
    t.match(r.summary.description, /opening through a door/, "the lead paragraph");
    t.match(r.summary.image, /upload\.wikimedia/, "and the thumbnail");
  },

  async "npm gives the version, licence and last publish"(t) {
    const { P } = engine();
    const r = await P.pipeline.look("https://www.npmjs.com/package/lodash", { id: 2 });
    t.equal(r.handler, "npm", "the npm handler claimed it");
    t.equal(r.summary.heading, "lodash", "package name");
    t.match(r.summary.metrics.join(" "), /v4\.17\.21/, "version");
    t.match(r.summary.metrics.join(" "), /MIT/, "licence");
    t.match(r.summary.metrics.join(" "), /updated 2021-02-20/, "last publish");
  },

  async "PyPI too"(t) {
    const { P } = engine();
    const r = await P.pipeline.look("https://pypi.org/project/requests/", { id: 3 });
    t.equal(r.summary.heading, "requests", "package name");
    t.match(r.summary.metrics.join(" "), /v2\.32\.3/, "version");
    t.match(r.summary.metrics.join(" "), /Python >=3\.8/, "python requirement");
  },

  async "Hacker News gives the score and comment count"(t) {
    const { P } = engine();
    const r = await P.pipeline.look("https://news.ycombinator.com/item?id=8863", { id: 4 });
    t.equal(r.summary.kind, "Discussion", "recognised as a discussion");
    t.match(r.summary.metrics.join(" "), /111 points/, "score");
    t.match(r.summary.metrics.join(" "), /71 comments/, "comments");
    t.match(r.summary.metrics.join(" "), /getdropbox\.com/, "and where the link goes");
  },

  async "an unhelpful answer falls through instead of showing nothing"(t) {
    const { P } = engine();
    /* The API returns null for a missing item; the handler must decline so the
     * generic fetch still gets its chance. */
    const r = await P.pipeline.look("https://news.ycombinator.com/item?id=999999999", { id: 5 });
    t.ok(r.handler !== "hacker news", "the handler should have declined");
  },

  async "handlers only claim URLs they understand"(t) {
    const { P } = engine();
    const names = P.siteHandlers.list.map((h) => h.name);
    t.ok(names.indexOf("wikipedia") !== -1, "handlers are registered: " + names.join(", "));

    const claims = (url) => P.siteHandlers.list.filter((h) => {
      try { return h.match(url); } catch (_) { return false; }
    }).map((h) => h.name);

    t.equal(claims("https://index.sme.sk/c/nemci").length, 0, "an ordinary article is nobody's");
    t.equal(claims("https://en.wikipedia.org/wiki/Peephole").join(), "wikipedia", "one claimant");
    t.equal(claims("https://www.npmjs.com/package/lodash").join(), "npm", "one claimant");
    t.equal(claims("https://github.com/lgubala/Peek").join(), "github", "github still owns its own");
  },

  async "a Stack Exchange question answers the question you had"(t) {
    const { P, asked } = engine();
    const r = await P.pipeline.look(
      "https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster", { id: 1 });
    t.ok(r.ok && r.handler === "stack exchange", "the handler took it: " + (r.reason || r.handler));
    t.match(asked.join(" "), /site=stackoverflow/, "asked the right site");
    t.match(r.summary.heading, /sorted array/, "the question title");
    t.ok(r.summary.metrics.includes("answered"), "says it is answered: " + r.summary.metrics.join(", "));
    t.match(r.summary.metrics.join(" "), /27,043 votes/, "and the score");
  },

  async "the site family is read from the subdomain"(t) {
    const { P, asked } = engine();
    /* stackexchange.com is a family — the site is in the subdomain — while
     * stackoverflow.com is its own. Getting this backwards asks the API about
     * a site that does not exist. */
    await P.pipeline.look("https://scifi.stackexchange.com/questions/1/x", { id: 2 });
    t.match(asked.join(" "), /site=scifi/, "family member: " + asked.join(" "));
  },

  async "a DOI says who wrote it and when"(t) {
    const { P } = engine();
    const r = await P.pipeline.look("https://doi.org/10.1038/nature12373", { id: 3 });
    t.ok(r.ok && r.handler === "doi", "the handler took it: " + (r.reason || r.handler));
    t.match(r.summary.heading, /Mycobacterium/, "the paper title");
    const m = r.summary.metrics.join(" | ");
    t.match(m, /2013/, "the year");
    t.match(m, /Nature/, "the journal");
    t.match(m, /et al\./, "authors, truncated");
    t.match(m, /412 citations/, "and how often it is cited");
  }
};
