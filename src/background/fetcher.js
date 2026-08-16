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

  /* A page is not necessarily UTF-8. Central European, Cyrillic and older CMS
   * sites still serve windows-1250, ISO-8859-2, windows-1251 and friends —
   * sme.sk, the worked example in Peek's own README, is exactly that kind of
   * site. Decoding those as UTF-8 produces "Ä?ÃtajĂş", and a card full of
   * mojibake reads as the *site* being broken. */
  function charsetFrom(headerValue, bytes) {
    /* 1. The header is authoritative when it says anything. */
    const fromHeader = /charset\s*=\s*["']?([\w-]+)/i.exec(headerValue || "");
    if (fromHeader) return fromHeader[1];

    /* 2. A BOM outranks anything the document claims. */
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return "utf-8";
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return "utf-16le";
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return "utf-16be";

    /* 3. The document's own declaration, read from the first couple of KB.
     *    latin1 is safe for sniffing: every byte maps to a character, so the
     *    ASCII tag names survive whatever the real encoding turns out to be. */
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 2048));
    const meta = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(head) ||
                 /<meta[^>]+content\s*=\s*["'][^"']*charset=([\w-]+)/i.exec(head);
    if (meta) return meta[1];

    return "utf-8";
  }

  function decode(bytes, headerValue) {
    const label = charsetFrom(headerValue, bytes);
    try {
      return new TextDecoder(label, { fatal: false }).decode(bytes);
    } catch (_) {
      /* An unrecognised label throws rather than falling back. */
      P.log.warn("unknown charset", label);
      return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    }
  }

  async function readCapped(res, cap) {
    const ctype = res.headers && res.headers.get ? res.headers.get("content-type") : "";
    /* HTML gets the larger budget; a JSON API answering in megabytes is not
     * answering the question the card asked. */
    cap = cap || (/html/i.test(ctype || "") ? P.config.BYTE_CAP : P.config.BYTE_CAP_OTHER);

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
      return { text: decode(buf, ctype), bytes: total, truncated: total >= cap };
    }

    /* No streaming body: the browser has already decoded, using the same
     * header we would have read. */
    const text = await res.text();
    return { text: text.slice(0, cap), bytes: text.length, truncated: text.length > cap };
  }

  /* Follows redirects by hand so the hops can be shown. `redirect: "follow"`
   * hides them: you get the final URL and nothing about the route, and the
   * route is often the interesting part — a link that visits a tracker in
   * another country before arriving somewhere respectable. */
  const MAX_HOPS = 6;

  async function requestChain(url, headers, signal) {
    const chain = [url];
    let current = url;

    /* Six hops at the per-request timeout is 42 seconds before the card
     * resolves. The whole chain gets one budget. */
    const deadline = Date.now() + P.config.CHAIN_BUDGET_MS;

    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const left = deadline - Date.now();
      if (left <= 0) return { res: null, chain, timedOut: true };

      const attempt = P.inflight.withTimeout(signal, Math.min(P.config.FETCH_TIMEOUT_MS, left));
      let res;
      try {
        res = await fetch(current, Object.assign({}, BASE_INIT, {
          redirect: "manual",
          signal: attempt.signal,
          headers: Object.assign({ Accept: "text/html,application/xhtml+xml" }, headers || {})
        }));
      } catch (e) {
        if (signal && signal.aborted) return { res: null, chain, cancelled: true };
        P.log.warn("fetch failed", current, e && e.name);
        return { res: null, chain };
      } finally {
        attempt.done();
      }

      /* An opaque redirect tells us nothing and cannot be followed. Fall back
       * to letting the browser do it, losing the chain but keeping the page. */
      if (res.type === "opaqueredirect") {
        const followed = await request(current, headers, signal);
        return { res: followed, chain };
      }

      const location = res.status >= 300 && res.status < 400 && res.headers.get("location");
      if (!location) return { res, chain };

      let next;
      try { next = new URL(location, current).href; }
      catch (_) { return { res, chain }; }

      /* Every hop passes the gate. A redirect must not be a way in. */
      const gated = P.gate.check(next);
      if (!gated.ok) {
        return { res: null, chain, blocked: gated.reason };
      }

      chain.push(next);
      current = next;
    }
    return { res: null, chain, tooManyHops: true };
  }

  /* Raw fetch with all the guarantees applied. Returns null on any failure. */
  async function request(url, headers, signal) {
    const attempt = P.inflight.withTimeout(signal, P.config.FETCH_TIMEOUT_MS);
    try {
      return await fetch(url, Object.assign({}, BASE_INIT, {
        signal: attempt.signal,
        headers: Object.assign({ Accept: "text/html,application/xhtml+xml" }, headers || {})
      }));
    } catch (e) {
      if (!(signal && signal.aborted)) P.log.warn("fetch failed", url, e && e.name);
      return null;
    } finally {
      attempt.done();
    }
  }

  async function fetchText(url, headers, cap, signal) {
    const res = await request(url, headers, signal);
    if (!res || !res.ok) return null;
    const { text, bytes, truncated } = await readCapped(res, cap);
    return { text, bytes, truncated, status: res.status, url: res.url || url };
  }

  async function fetchJson(url, headers, signal) {
    const res = await request(url, headers, signal);
    if (!res || !res.ok) return null;
    try { return await res.json(); } catch (_) { return null; }
  }

  function slotsFree() { return inFlight < P.config.MAX_PARALLEL; }
  function acquire() { inFlight++; }
  function release() { inFlight = Math.max(0, inFlight - 1); }

  P.fetcher = { request, requestChain, fetchText, fetchJson, readCapped, slotsFree, acquire, release };
})(self.Peek = self.Peek || {});
