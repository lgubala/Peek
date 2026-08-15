/* Peek — common/text.js
 * Text helpers shared by the extractor and the reader.
 */
(function (P) {
  "use strict";

  const squash = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim();

  /* Sites routinely ship HTML-encoded text inside JSON-LD, e.g.
   * "R&uacute;ru rozohrejeme na 160&deg;C". Decode it once, on the way in. */
  function decodeEntities(str) {
    if (!str || str.indexOf("&") === -1) return str;
    try {
      const d = P.platform.parse("<!doctype html><body>" + str);
      return (d.body.textContent || str).trim();
    } catch (_) { return str; }
  }

  function stripTags(s) {
    return squash(String(s || "").replace(/<[^>]+>/g, " "));
  }

  /* ISO 8601 duration -> "1 h 30 min" */
  function duration(iso) {
    if (typeof iso !== "string") return "";
    const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
    if (!m) return "";
    const bits = [];
    if (m[1]) bits.push(m[1] + " d");
    if (m[2]) bits.push(m[2] + " h");
    if (m[3]) bits.push(m[3] + " min");
    return bits.join(" ");
  }

  /* 1266 -> "21:06" */
  function seconds(total) {
    total = parseInt(total, 10);
    if (!total || total < 0) return "";
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return h ? h + ":" + pad(m) + ":" + pad(s) : m + ":" + pad(s);
  }

  const CURRENCY = { EUR: "\u20ac", USD: "$", GBP: "\u00a3", CZK: "K\u010d", PLN: "z\u0142" };
  const SUFFIXED = { CZK: true, PLN: true };

  function money(amount, currency) {
    const raw = String(amount == null ? "" : amount);
    const n = parseFloat(raw.replace(/[^\d.,-]/g, "").replace(",", "."));
    if (!isFinite(n)) return "";
    const cur = squash(currency).toUpperCase();
    const sym = CURRENCY[cur];
    /* Keep the trailing zero when the source quoted cents: 549.90, not 549.9 */
    const cents = /[.,]\d\d?\s*$/.test(raw);
    const pretty = n.toLocaleString(undefined, {
      minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2
    });
    if (!sym) return cur ? pretty + " " + cur : pretty;
    return SUFFIXED[cur] ? pretty + " " + sym : sym + pretty;
  }

  P.text = { squash, decodeEntities, stripTags, duration, seconds, money };
})(self.Peek = self.Peek || {});
