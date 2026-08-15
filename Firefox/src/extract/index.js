/* Peek — extract/index.js
 * HTML in, the handful of facts that answer "is this worth opening?" out.
 * Pure. Runs wherever a DOM parser is available (see src/platform/dom.js).
 */
(function (P) {
  "use strict";

  const meta = (doc, sel) => {
    const el = doc.querySelector(sel);
    return el ? (el.getAttribute("content") || "").trim() : "";
  };

  function extract(html, opts) {
    opts = opts || {};

    const r = {
      kind: "", heading: "", description: "", metrics: [], flags: [],
      ingredients: null, steps: null, image: "",
      lang: "", canonical: "", source: []
    };

    let doc;
    try { doc = P.platform.parse(html); }
    catch (_) {
      r.flags.push({ tone: "warn", text: "Could not parse the page." });
      return r;
    }

    /* --- structured data ---------------------------------------------- */
    const nodes = P.jsonld.collect(doc);
    if (nodes.length) r.source.push("JSON-LD");

    const winner = P.jsonld.best(nodes);
    if (winner) {
      P.types.apply(winner, r);
      if (winner.description) r.description = P.types.txt(winner.description).slice(0, 300);
    }

    /* Paywalls the site admits to. */
    for (const o of nodes) {
      const free = o.isAccessibleForFree;
      if (free === false || free === "False" || free === "false") {
        r.flags.push({ tone: "warn", text: "The site marks this as not free to read." });
        break;
      }
    }
    const faq = nodes.find((o) => P.jsonld.typesOf(o).indexOf("faqpage") !== -1);
    if (faq && Array.isArray(faq.mainEntity)) r.metrics.push(faq.mainEntity.length + " questions");

    /* --- OpenGraph and plain meta fill the gaps ------------------------ */
    const ogTitle = meta(doc, 'meta[property="og:title"]') || meta(doc, 'meta[name="twitter:title"]');
    const ogDesc = meta(doc, 'meta[property="og:description"]') ||
                   meta(doc, 'meta[name="twitter:description"]') ||
                   meta(doc, 'meta[name="description"]');
    const ogType = meta(doc, 'meta[property="og:type"]');
    const pubTime = meta(doc, 'meta[property="article:published_time"]');
    const author = meta(doc, 'meta[property="article:author"]') || meta(doc, 'meta[name="author"]');
    const docTitle = (doc.querySelector("title") || {}).textContent || "";

    if (!r.heading) r.heading = (ogTitle || docTitle).trim().slice(0, 160);
    if (!r.description) r.description = (ogDesc || "").trim().slice(0, 300);
    if (ogTitle || ogDesc) r.source.push("OpenGraph");

    if (!r.kind && ogType) {
      r.kind = { article: "Article", "video.other": "Video", product: "Product",
                 profile: "Profile", book: "Book", website: "" }[ogType] || "";
    }
    if (pubTime && !r.metrics.some((m) => /^\d{4}-/.test(m))) r.metrics.push(pubTime.slice(0, 10));
    if (author && r.metrics.length < 4) r.metrics.push(author.slice(0, 40));

    /* --- lead image ---------------------------------------------------- */
    const candidates = [
      meta(doc, 'meta[property="og:image"]'),
      meta(doc, 'meta[property="og:image:secure_url"]'),
      meta(doc, 'meta[name="twitter:image"]'),
      winner && P.types.txt(Array.isArray(winner.image) ? winner.image[0] : winner.image)
    ];
    for (const c of candidates) {
      if (c && /^https?:\/\//i.test(c) && !P.config.USELESS_HERO.test(c)) { r.image = c; break; }
    }

    const htmlEl = doc.documentElement;
    r.lang = ((htmlEl && htmlEl.getAttribute("lang")) || "").slice(0, 5);
    const canon = doc.querySelector('link[rel="canonical"]');
    r.canonical = canon ? canon.getAttribute("href") || "" : "";

    r.metrics = r.metrics.filter((m, i) => m && r.metrics.indexOf(m) === i).slice(0, 6);
    return r;
  }

  P.extract = { extract };
})(self.Peek = self.Peek || {});
