/* Peek — sites/index.js
 * Registry for site handlers. See README.md in this folder.
 */
(function (P) {
  "use strict";

  const handlers = [];

  function register(handler) {
    if (!handler || typeof handler.run !== "function" || typeof handler.match !== "function") {
      P.log.warn("ignoring malformed site handler", handler && handler.name);
      return;
    }
    handlers.push(handler);
  }

  /* Returns a result from the first handler that claims the URL and succeeds,
   * or null so the caller falls through to the generic fetch. */
  async function run(url, opts, ctx) {
    for (const h of handlers) {
      let owns = false;
      try { owns = !!h.match(url); } catch (_) { owns = false; }
      if (!owns) continue;
      try {
        const result = await h.run(url, opts, ctx);
        if (result) { P.log.info("handler", h.name); return result; }
      } catch (e) {
        P.log.warn("handler failed:", h.name, e && e.message);
      }
    }
    return null;
  }

  /* --- the declarative form -------------------------------------------- */
  /* Most handlers do the same four things: match a URL, call a keyless public
   * API, map some fields, hand back a summary. Writing that as code each time
   * is ceremony — the GitHub handler is 90 lines and only about 15 of them are
   * about GitHub. A data description keeps the interesting part visible and
   * makes adding a site something you can do without reading the pipeline.
   *
   *   name     for the log
   *   match    RegExp against the URL; its captures are passed on
   *   api      (matches, url) -> the endpoint to call
   *   map      (json, matches, url) -> { kind, heading, description, image,
   *                                      metrics[], flags[] }, or null to
   *                                      fall through to the generic fetch
   *   article  optional (json) -> HTML string, cleaned like any other content
   */
  function describe(spec) {
    register({
      name: spec.name,

      match(url) {
        return spec.match.test(url);
      },

      async run(url, opts, ctx) {
        spec.match.lastIndex = 0;
        const m = url.match(spec.match);
        if (!m) return null;

        let endpoint;
        try { endpoint = spec.api(m, url); } catch (_) { return null; }
        if (!endpoint) return null;

        const json = await ctx.fetchJson(endpoint, spec.headers || null);
        if (!json) return null;                 // rate limited, offline, 404

        let mapped;
        try { mapped = spec.map(json, m, url); } catch (e) {
          P.log.warn(spec.name + ": mapping failed", e && e.message);
          return null;
        }
        if (!mapped || !mapped.heading) return null;

        const summary = Object.assign({
          kind: "", heading: "", description: "", image: "",
          metrics: [], flags: [], ingredients: null, steps: null,
          source: [spec.name], lang: "", canonical: url
        }, mapped);
        summary.metrics = (summary.metrics || []).filter(Boolean).slice(0, 6);

        let article = { ok: false, reason: "" };
        if (spec.article) {
          let html = null;
          try { html = spec.article(json, m, url); } catch (_) { html = null; }
          if (html) {
            article = ctx.clean(html, {
              images: opts.images, maxImages: 1, baseUrl: url, pageHost: hostOf(url)
            });
          }
        }

        return { ok: true, status: 200, handler: spec.name, finalUrl: url, summary, article };
      }
    });
  }

  function hostOf(url) {
    try { return new URL(url).hostname; } catch (_) { return ""; }
  }

  P.siteHandlers = { register, describe, run, list: handlers };
})(self.Peek = self.Peek || {});
