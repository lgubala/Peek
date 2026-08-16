/* Peek — background/pipeline.js
 * One lookup, start to finish:
 *
 *   gate -> cache -> site handler -> generic fetch -> extract + read
 *
 * Returns a plain object the content script can render. Never throws.
 */
(function (P) {
  "use strict";

  /* What a site handler is allowed to do. Deliberately small. */
  function handlerContext() {
    return {
      fetchText: (url, headers) => P.fetcher.fetchText(url, headers),
      fetchJson: (url, headers) => P.fetcher.fetchJson(url, headers),
      clean: (html, opts) => P.reader.clean(html, opts || {}),
      extract: (html, opts) => P.extract.extract(html, opts || {})
    };
  }

  function statusFlag(status) {
    if (status === 403 || status === 401 || status === 429) {
      return { tone: "bad", text: "The site refused the request (" + status +
        "). Many publishers block reads that are not a real browser visit." };
    }
    return { tone: "bad", text: "The server answered " + status + "." };
  }

  async function look(rawUrl, opts) {
    opts = opts || {};

    const gate = P.gate.check(rawUrl);
    if (!gate.ok) return { ok: false, blocked: true, reason: gate.reason };

    const cached = P.cache.get(gate.url, opts);
    if (cached) return Object.assign({ cached: true }, cached);

    if (!P.fetcher.slotsFree()) {
      return { ok: false, reason: "Too many lookups at once. Try again." };
    }
    P.fetcher.acquire();

    try {
      /* A handler knows where the content actually lives. */
      const special = await P.siteHandlers.run(gate.url, opts, handlerContext());
      if (special) { P.cache.set(gate.url, opts, special); return special; }

      const hopped = await P.fetcher.requestChain(gate.url);
      const res = hopped.res;
      if (hopped.blocked) {
        return { ok: false, blocked: true,
          reason: "The link redirects to something Peek will not fetch: " + hopped.blocked };
      }
      if (hopped.tooManyHops) {
        return { ok: false, reason: "Too many redirects to follow." };
      }
      if (!res) return { ok: false, reason: "Could not reach the site." };

      const ctype = (res.headers.get("content-type") || "").toLowerCase();
      const finalUrl = hopped.chain[hopped.chain.length - 1] || res.url || gate.url;
      const result = {
        ok: true,
        status: res.status,
        finalUrl,
        chain: hopped.chain,
        redirected: hopped.chain.length > 1,
        contentType: ctype.split(";")[0] || ""
      };

      if (res.status >= 400) {
        result.summary = null;
        result.flags = [statusFlag(res.status)];
        P.cache.set(gate.url, opts, result);
        return result;
      }
      if (ctype && ctype.indexOf("html") === -1 && ctype.indexOf("xml") === -1) {
        result.summary = null;
        result.flags = [{ tone: "warn", text: "Not a web page \u2014 served as " + result.contentType + "." }];
        P.cache.set(gate.url, opts, result);
        return result;
      }

      const { text, bytes, truncated } = await P.fetcher.readCapped(res);
      result.bytes = bytes;
      result.truncated = truncated;
      result.summary = P.extract.extract(text);
      result.article = P.reader.read(text, result.finalUrl, { images: !!opts.images });

      /* What the page says about itself, and the route it took. */
      result.signals = { level: "", flags: [] };
      try {
        const doc = P.platform.parse(text);
        const page = P.signals.inspect(doc, result.finalUrl);
        const route = P.signals.describeChain(hopped.chain);
        result.signals.flags = page.flags.concat(route.flags);
        result.signals.level =
          page.level === "danger" || route.level === "danger" ? "danger"
          : (page.level || route.level) ? "caution" : "";
      } catch (e) {
        P.log.warn("signals failed", e && e.message);
      }

      P.cache.set(gate.url, opts, result);
      return result;

    } catch (e) {
      P.log.warn("lookup failed", e && e.message);
      return { ok: false, reason: "Could not read this page." };
    } finally {
      P.fetcher.release();
    }
  }

  P.pipeline = { look };
})(self.Peek = self.Peek || {});
