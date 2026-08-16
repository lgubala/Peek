/* Peek — sites/declared.js
 * Sites Peek knows how to ask directly.
 *
 * Each of these has a keyless public API that answers the question the card is
 * for, better than scraping the page ever could — and often when scraping
 * cannot work at all, because the page builds itself in the browser.
 *
 * Adding one is a data entry, not a module. See sites/README.md.
 */
(function (P) {
  "use strict";

  const D = P.siteHandlers.describe;
  const trim = (s, n) => (s ? String(s).slice(0, n || 300) : "");
  const num = (n) => (typeof n === "number" ? n.toLocaleString() : null);
  const day = (d) => (d ? String(d).slice(0, 10) : null);

  /* --- Wikipedia ------------------------------------------------------- */
  /* The REST summary is the first paragraph, which is exactly what a peek
   * wants — no navigation, no infobox, no "citation needed". */
  D({
    name: "wikipedia",
    match: /^https?:\/\/([a-z-]{2,12})\.(?:m\.)?wikipedia\.org\/wiki\/([^?#]+)/i,
    api: (m) => "https://" + m[1] + ".wikipedia.org/api/rest_v1/page/summary/" +
                encodeURIComponent(decodeURIComponent(m[2])),
    map: (j, m) => ({
      kind: j.type === "disambiguation" ? "Disambiguation" : "Encyclopedia",
      heading: j.title,
      description: trim(j.extract, 600),
      image: (j.thumbnail && j.thumbnail.source) || "",
      metrics: [j.description, m[1].toUpperCase()]
    })
  });

  /* --- npm -------------------------------------------------------------- */
  D({
    name: "npm",
    match: /^https?:\/\/(?:www\.)?npmjs\.com\/package\/((?:@[^/]+\/)?[^/?#]+)/i,
    api: (m) => "https://registry.npmjs.org/" + m[1].split("/").map(encodeURIComponent).join("/"),
    map: (j) => {
      const latest = j["dist-tags"] && j["dist-tags"].latest;
      const version = latest && j.versions && j.versions[latest];
      const modified = j.time && j.time.modified;
      return {
        kind: "Package",
        heading: j.name,
        description: trim(j.description),
        metrics: [
          latest && "v" + latest,
          version && version.license,
          modified && "updated " + day(modified),
          j.maintainers && j.maintainers.length + " maintainers"
        ]
      };
    },
    article: (j) => (typeof j.readme === "string" && j.readme.indexOf("<") === 0 ? j.readme : null)
  });

  /* --- PyPI ------------------------------------------------------------- */
  D({
    name: "pypi",
    match: /^https?:\/\/pypi\.org\/project\/([^/?#]+)/i,
    api: (m) => "https://pypi.org/pypi/" + encodeURIComponent(m[1]) + "/json",
    map: (j) => {
      const i = j.info || {};
      return {
        kind: "Package",
        heading: i.name,
        description: trim(i.summary),
        metrics: [
          i.version && "v" + i.version,
          i.license && trim(i.license, 24),
          i.requires_python && "Python " + i.requires_python,
          i.author
        ]
      };
    }
  });

  /* --- crates.io -------------------------------------------------------- */
  D({
    name: "crates.io",
    match: /^https?:\/\/crates\.io\/crates\/([^/?#]+)/i,
    api: (m) => "https://crates.io/api/v1/crates/" + encodeURIComponent(m[1]),
    map: (j) => {
      const c = j.crate || {};
      return {
        kind: "Package",
        heading: c.name,
        description: trim(c.description),
        metrics: [
          c.max_stable_version && "v" + c.max_stable_version,
          num(c.downloads) && num(c.downloads) + " downloads",
          c.updated_at && "updated " + day(c.updated_at)
        ]
      };
    }
  });

  /* --- Hacker News ------------------------------------------------------ */
  /* The comment count and score are the whole reason you hover an HN link,
   * and the page is a table layout Readability cannot make sense of. */
  D({
    name: "hacker news",
    match: /^https?:\/\/news\.ycombinator\.com\/item\?id=(\d+)/i,
    api: (m) => "https://hacker-news.firebaseio.com/v0/item/" + m[1] + ".json",
    map: (j) => {
      if (!j || !j.title) return null;
      return {
        kind: j.type === "job" ? "Job" : "Discussion",
        heading: j.title,
        description: trim(j.text ? String(j.text).replace(/<[^>]+>/g, " ") : ""),
        metrics: [
          num(j.score) && num(j.score) + " points",
          num(j.descendants) && num(j.descendants) + " comments",
          j.by && "by " + j.by,
          j.url && (function () {
            try { return new URL(j.url).hostname.replace(/^www\./, ""); } catch (_) { return null; }
          })()
        ]
      };
    }
  });

  /* --- Open Library ----------------------------------------------------- */
  D({
    name: "open library",
    match: /^https?:\/\/openlibrary\.org\/(?:works|books)\/([^/?#]+)/i,
    api: (m) => "https://openlibrary.org/works/" + encodeURIComponent(m[1]) + ".json",
    map: (j) => ({
      kind: "Book",
      heading: j.title,
      description: trim(typeof j.description === "string" ? j.description
                        : (j.description && j.description.value) || ""),
      image: j.covers && j.covers.length
        ? "https://covers.openlibrary.org/b/id/" + j.covers[0] + "-M.jpg" : "",
      metrics: [
        j.first_publish_date,
        j.subjects && j.subjects.length && j.subjects.slice(0, 2).join(", ")
      ]
    })
  });

  /* --- Stack Exchange --------------------------------------------------- */
  /* "Is this answered, and did anyone agree?" is the whole question, and it is
   * three numbers the page buries below the fold. */
  D({
    name: "stack exchange",
    match: /^https?:\/\/(?:([a-z][a-z0-9-]*)\.)?(stackoverflow|superuser|serverfault|askubuntu|stackexchange)\.com\/questions\/(\d+)/i,
    api: (m) => {
      /* stackexchange.com is a family: the site lives in the subdomain.
       * Everywhere else the domain itself is the site. */
      const site = m[2] === "stackexchange" ? m[1] : m[2];
      return site ? "https://api.stackexchange.com/2.3/questions/" + m[3] +
                    "?site=" + site + "&filter=withbody" : null;
    },
    map: (j) => {
      const q = j && j.items && j.items[0];
      if (!q) return null;
      return {
        kind: "Question",
        heading: String(q.title || "").replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
        description: trim(String(q.body || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
        metrics: [
          q.is_answered ? "answered" : "no accepted answer",
          num(q.score) && num(q.score) + " votes",
          num(q.answer_count) && num(q.answer_count) + " answers",
          (q.tags || []).slice(0, 2).join(", ")
        ]
      };
    }
  });

  /* --- DOI -------------------------------------------------------------- */
  /* A DOI link tells you nothing and redirects to a publisher that will
   * probably want money. Crossref answers who wrote it and when, for free. */
  D({
    name: "doi",
    match: /^https?:\/\/(?:dx\.)?doi\.org\/(10\.[^\s?#]+)/i,
    api: (m) => "https://api.crossref.org/works/" + encodeURIComponent(m[1]),
    map: (j) => {
      const w = j && j.message;
      if (!w) return null;
      const authors = (w.author || []).slice(0, 3)
        .map((a) => [a.given, a.family].filter(Boolean).join(" "))
        .filter(Boolean);
      const parts = w.issued && w.issued["date-parts"] && w.issued["date-parts"][0];
      return {
        kind: "Paper",
        heading: (w.title && w.title[0]) || "",
        description: trim(String(w.abstract || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()),
        metrics: [
          parts && parts[0] && String(parts[0]),
          w["container-title"] && w["container-title"][0],
          authors.length ? authors.join(", ") + ((w.author || []).length > 3 ? " et al." : "") : null,
          num(w["is-referenced-by-count"]) && num(w["is-referenced-by-count"]) + " citations"
        ]
      };
    }
  });
})(self.Peek = self.Peek || {});
