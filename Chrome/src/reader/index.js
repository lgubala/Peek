/* Peek — reader/index.js
 * Turns a fetched page into readable article HTML.
 *
 *   1. A named selector for the site, if config/sites.js has one.
 *   2. Otherwise Mozilla's Readability picks the article out of the furniture.
 *   3. Either way the result is sanitized and tidied before it leaves here.
 *
 * The content script never sees raw HTML from the web.
 */
(function (P) {
  "use strict";

  /* The rungs Peek tries, in order, and what it says when it stops on one.
   *
   * Reading an arbitrary page is a ladder of decreasing ambition: a handler
   * that knows the site, a selector for its article, Readability's guess, and
   * finally the metadata the page states about itself. Every rung fails on
   * some of the web, so the useful thing is not hiding that — it is saying
   * which rung answered, and what is still available when none did.
   *
   * These read as observations, not apologies. "The text is built by
   * JavaScript" tells the user something true about the page; "could not read
   * this page" only tells them Peek failed. And none of them is a *warning* —
   * a page Peek cannot parse is not a page that is out to get you, and using
   * the same red flag for both is how real warnings stop being read. */
  const OUTCOME = {
    "js-shell": "The text is built by JavaScript, so the HTML Peek received holds none of it.",
    "menu": "This is a menu or an index rather than something to read.",
    "furniture": "Only page furniture here \u2014 headers, nav, no article.",
    "too-large": "The page was too large to read in full, so its structure came out incomplete.",
    "no-structure": "No article structure Peek could find.",
    "thin": "Nothing readable in the HTML.",
    "parse-failed": "Peek could not parse what the site sent.",
    "no-readme": "No README in this repository."
  };

  /* Two different failures wearing the same coat.
   *
   *   LIMITATION  Peek could not read something that was there — the text is
   *               behind JavaScript, the page was too big, the HTML broke.
   *               Worth saying even when a summary is on offer, because it
   *               explains why this card is thinner than usual.
   *
   *   NOT_AN_ARTICLE  There was no article to begin with: a menu, a product
   *               page, a directory. Saying "no article structure" on a
   *               product page is noise; the card is doing its job.
   *
   * Collapsing the two is why "works on 5 sites, fails on 50" feels arbitrary
   * from the outside. */
  const LIMITATION = new Set(["js-shell", "too-large", "parse-failed"]);

  /* Whatever the reason, some of these leave the summary intact. */
  const stop = (out, code, extra) => {
    out.code = code;
    out.reason = OUTCOME[code] || code;
    /* Whether it is worth explaining alongside a summary. */
    out.limitation = LIMITATION.has(code);
    if (extra) Object.assign(out, extra);
    return out;
  };

  function blank() {
    return {
      ok: false, code: "", title: "", byline: "", siteName: "", excerpt: "",
      nodes: [], textLength: 0, minutes: 0, images: 0, reason: "", via: ""
    };
  }

  function selectorContent(doc, url) {
    const host = P.url.hostOf(url);
    for (const sel of P.sites.contentSelectors(host)) {
      let node = null;
      try { node = doc.querySelector(sel); } catch (_) { continue; }
      if (!node) continue;
      if (P.text.squash(node.textContent).length > 150) return { node, sel };
    }
    return null;
  }

  /* Sanitize, tidy and measure a fragment. Shared by read() and clean(). */
  function finish(frag, out, opts) {
    const maxImages = P.images.budget(frag, opts.maxImages);
    const s = P.sanitize.sanitize(frag, {
      images: opts.images,
      maxImages,
      baseUrl: opts.baseUrl || "",
      linkBase: opts.linkBase || "",
      pageHost: opts.pageHost || ""
    });
    out.listing = maxImages > P.config.MAX_IMAGES;
    out.tidied = P.tidy.tidy(frag);

    const text = P.text.squash(frag.textContent);
    if (text.length < P.config.MIN_ARTICLE_CHARS) {
      return stop(out, "furniture");
    }

    const density = P.tidy.linkDensity(frag);
    if (density > P.config.MAX_LINK_DENSITY && text.length < 2500) {
      return stop(out, "menu", { linkDensity: Math.round(density * 100) / 100 });
    }

    out.ok = true;
    out.images = s.images;
    out.textLength = text.length;
    out.minutes = Math.max(1, Math.round(text.length / 5 / 220));

    /* Crosses the message boundary as a node tree, never as markup, so the
     * content script never parses HTML that came off the network. */
    const tree = P.serialize.toTree(frag);
    out.nodes = tree.nodes;
    out.truncated = tree.truncated;
    return out;
  }

  function read(html, url, opts) {
    opts = opts || {};
    const out = blank();

    let doc;
    try { doc = P.platform.parse(html); }
    catch (_) { return stop(out, "parse-failed"); }

    /* Readability resolves relative links against the document base. */
    try {
      const head = doc.head || doc.documentElement;
      const base = doc.createElement("base");
      base.setAttribute("href", url);
      head.insertBefore(base, head.firstChild);
    } catch (_) { /* non-fatal */ }

    /* A page that builds itself in the browser has nothing to read on the wire. */
    const bodyText = P.text.squash(doc.body && doc.body.textContent);
    if (bodyText.length < 250 && doc.querySelectorAll("script").length > 3) {
      stop(out, "js-shell");
      return out;
    }

    /* A named selector beats a guess. */
    const site = selectorContent(doc, url);
    let frag;

    if (site) {
      /* Clone the element straight out of the parsed document. Going via
       * innerHTML would serialise it back to a string only to parse it again,
       * and Peek keeps markup strings out of its own code entirely. */
      out.via = site.sel;
      frag = site.node.cloneNode(true);
      out.title = P.text.squash((doc.querySelector("title") || {}).textContent).slice(0, 200);
    } else {
      let article = null;
      try {
        article = new Readability(doc, { charThreshold: 250, keepClasses: false }).parse();
      } catch (_) {
        return stop(out, "parse-failed");
      }
      out.via = "readability";

      if (!article || !article.content) {
        /* Truncation is the likeliest cause of a broken tree on a big page,
         * and blaming the site for it is both wrong and unhelpful. */
        return stop(out, opts.truncated ? "too-large"
                       : bodyText.length < 400 ? "thin" : "no-structure");
      }

      try { frag = P.platform.parse(article.content).body; }
      catch (_) { return stop(out, "parse-failed"); }

      out.byline = P.text.squash(article.byline).slice(0, 120);
      out.siteName = P.text.squash(article.siteName).slice(0, 60);
      out.excerpt = P.text.squash(article.excerpt).slice(0, 300);
      out.title = P.text.squash(article.title).slice(0, 200);
      out.lang = article.lang || "";
    }

    return finish(frag, out, Object.assign({ baseUrl: url, pageHost: P.url.hostOf(url) }, opts));
  }

  /* Clean a fragment a site handler fetched itself — a rendered README, say.
   * Same guarantees as read(). */
  function clean(html, opts) {
    opts = opts || {};
    const out = blank();
    let frag;
    try { frag = P.platform.parse(html).body; }
    catch (_) { return stop(out, "parse-failed"); }
    out.via = "handler";
    return finish(frag, out, opts);
  }

  P.reader = {
    OUTCOME, LIMITATION, read, clean };
})(self.Peek = self.Peek || {});
