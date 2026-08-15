/* Peek — background/fetcher.js
 * The only place in this extension that touches the network.
 *
 * Every request: no cookies sent or stored, no referrer, no caching, a byte
 * cap enforced by cancelling the stream, a timeout, and a concurrency limit.
 * The destination's JavaScript never runs, so its trackers never fire.
 */
(function (P) {
  "use strict";

  let inFlight = 0;

  const BASE_INIT = {
    method: "GET",
    credentials: "omit",          // no cookies out, none stored coming back
    referrerPolicy: "no-referrer",
    redirect: "follow",
    cache: "no-store"
  };

  async function readCapped(res, cap) {
    cap = cap || P.config.BYTE_CAP;

    /* Stream so the connection closes as soon as we have enough. */
    if (res.body && res.body.getReader) {
      const reader = res.body.getReader();
      const chunks = [];
      let total = 0;
      while (total < cap) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
      }
      try { await reader.cancel(); } catch (_) { /* already closed */ }

      const buf = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        buf.set(c.subarray(0, Math.min(c.length, total - off)), off);
        off += c.length;
      }
      return {
        text: new TextDecoder("utf-8", { fatal: false }).decode(buf),
        bytes: total,
        truncated: total >= cap
      };
    }

    const text = await res.text();
    return { text: text.slice(0, cap), bytes: text.length, truncated: text.length > cap };
  }

  /* Raw fetch with all the guarantees applied. Returns null on any failure. */
  async function request(url, headers, cap) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), P.config.FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, Object.assign({}, BASE_INIT, {
        signal: ctrl.signal,
        headers: Object.assign({ Accept: "text/html,application/xhtml+xml" }, headers || {})
      }));
      return res;
    } catch (e) {
      P.log.warn("fetch failed", url, e && e.name);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchText(url, headers, cap) {
    const res = await request(url, headers, cap);
    if (!res || !res.ok) return null;
    const { text, bytes, truncated } = await readCapped(res, cap);
    return { text, bytes, truncated, status: res.status, url: res.url || url };
  }

  async function fetchJson(url, headers) {
    const res = await request(url, headers);
    if (!res || !res.ok) return null;
    try { return await res.json(); } catch (_) { return null; }
  }

  function slotsFree() { return inFlight < P.config.MAX_PARALLEL; }
  function acquire() { inFlight++; }
  function release() { inFlight = Math.max(0, inFlight - 1); }

  P.fetcher = { request, fetchText, fetchJson, readCapped, slotsFree, acquire, release };
})(self.Peek = self.Peek || {});
