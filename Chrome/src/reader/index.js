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

  function blank() {
    return {
      ok: false, title: "", byline: "", siteName: "", excerpt: "",
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
      linkBase: opts.linkBase || ""
    });
    out.listing = maxImages > P.config.MAX_IMAGES;
    out.tidied = P.tidy.tidy(frag);

    const text = P.text.squash(frag.textContent);
    if (text.length < P.config.MIN_ARTICLE_CHARS) {
      out.reason = "Only page furniture here \u2014 no real article text.";
      return out;
    }

    const density = P.tidy.linkDensity(frag);
    if (density > P.config.MAX_LINK_DENSITY && text.length < 2500) {
      out.reason = "Mostly links \u2014 this is a menu or an index, not an article.";
      out.linkDensity = Math.round(density * 100) / 100;
      return out;
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
    catch (_) { out.reason = "Could not parse the page."; return out; }

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
      out.reason = "This page builds itself with JavaScript \u2014 the HTML holds no article.";
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
        out.reason = "Could not find an article on this page.";
        return out;
      }
      out.via = "readability";

      if (!article || !article.content) {
        out.reason = bodyText.length < 400
          ? "Nothing readable in the HTML."
          : "No article structure \u2014 this looks like a listing or an app, not a page to read.";
        return out;
      }

      try { frag = P.platform.parse(article.content).body; }
      catch (_) { out.reason = "Could not process the article."; return out; }

      out.byline = P.text.squash(article.byline).slice(0, 120);
      out.siteName = P.text.squash(article.siteName).slice(0, 60);
      out.excerpt = P.text.squash(article.excerpt).slice(0, 300);
      out.title = P.text.squash(article.title).slice(0, 200);
      out.lang = article.lang || "";
    }

    return finish(frag, out, Object.assign({ baseUrl: url }, opts));
  }

  /* Clean a fragment a site handler fetched itself — a rendered README, say.
   * Same guarantees as read(). */
  function clean(html, opts) {
    opts = opts || {};
    const out = blank();
    let frag;
    try { frag = P.platform.parse(html).body; }
    catch (_) { out.reason = "Could not parse the content."; return out; }
    out.via = "handler";
    return finish(frag, out, opts);
  }

  P.reader = { read, clean };
})(self.Peek = self.Peek || {});
