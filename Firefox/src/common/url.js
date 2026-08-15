/* Peek — common/url.js
 * URL parsing that behaves inside a Firefox content script.
 *
 * URLSearchParams iterators are NOT iterable across Firefox's Xray wrappers, so
 * `[...url.searchParams.entries()]` throws in a content script even though it
 * works on a normal page. Everything here parses the query string by hand.
 */
(function (P) {
  "use strict";

  function plusDecode(v) {
    try { return decodeURIComponent(String(v).replace(/\+/g, " ")); }
    catch (_) { return String(v); }
  }

  function parseQuery(search) {
    const out = [];
    const s = String(search || "").replace(/^\?/, "");
    if (!s) return out;
    for (const part of s.split("&")) {
      if (!part) continue;
      const i = part.indexOf("=");
      out.push([
        plusDecode(i < 0 ? part : part.slice(0, i)),
        plusDecode(i < 0 ? "" : part.slice(i + 1))
      ]);
    }
    return out;
  }

  function qget(params, key) {
    const lk = String(key).toLowerCase();
    for (const [k, v] of params) if (k.toLowerCase() === lk) return v;
    return null;
  }

  function tryDecode(v) {
    try { return decodeURIComponent(v); } catch (_) { return v; }
  }

  const hostOf = (url) => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (_) { return ""; }
  };

  function registrable(host) {
    if (!host) return "";
    const h = String(host).replace(/^www\./, "");
    const parts = h.split(".");
    if (parts.length <= 2) return h;
    const two = parts.slice(-2).join(".");
    const three = parts.slice(-3).join(".");
    if (P.config.MULTI_SUFFIX.has(three)) return parts.slice(-4).join(".");
    if (P.config.MULTI_SUFFIX.has(two)) return parts.slice(-3).join(".");
    return two;
  }

  function subdomain(host, reg) {
    if (!host || !reg || host === reg) return "";
    return host.endsWith("." + reg) ? host.slice(0, -(reg.length + 1)) : "";
  }

  const isIpHost = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || /^\[[0-9a-f:]+\]$/i.test(h);

  function extension(pathname) {
    const last = String(pathname || "").split("/").pop() || "";
    const m = last.match(/\.([a-z0-9]{1,8})$/i);
    return m ? m[1].toLowerCase() : "";
  }

  const looksLikeUrl = (v) =>
    /^https?:\/\//i.test(v) || /^%2f%2f/i.test(v) || /^[a-z0-9-]+\.[a-z]{2,}\//i.test(v);

  /* Email click-trackers hide the destination in base64: ?r=aHR0cHM6Ly... */
  function base64Url(value) {
    const v = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    if (v.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(v)) return null;
    try {
      const pad = "===".slice(0, (4 - (v.length % 4)) % 4);
      const decoded = atob(v.replace(/=+$/, "") + pad);
      return /^https?:\/\/\S+$/i.test(decoded.trim()) ? decoded.trim() : null;
    } catch (_) { return null; }
  }

  /* Search engines and mailers wrap the real destination in a query parameter,
   * plainly or base64-encoded. Unwrap up to two hops. */
  function unwrap(u) {
    let from = null;
    for (let hop = 0; hop < 2; hop++) {
      const params = parseQuery(u.search);
      let found = null;
      for (const key of P.config.REDIRECT_KEYS) {
        const raw = qget(params, key);
        if (!raw) continue;
        const plain = tryDecode(raw);
        if (looksLikeUrl(plain)) { found = plain; break; }
        const decoded = base64Url(raw);
        if (decoded) { found = decoded; break; }
      }
      if (!found) break;
      try {
        const inner = new URL(found.startsWith("http")
          ? found : "https://" + found.replace(/^\/\//, ""));
        from = from || u.hostname.replace(/^www\./, "");
        u = inner;
      } catch (_) { break; }
    }
    return { url: u, from };
  }

  P.url = {
    plusDecode, parseQuery, qget, tryDecode, hostOf, registrable, subdomain,
    isIpHost, extension, looksLikeUrl, base64Url, unwrap
  };
})(self.Peek = self.Peek || {});
