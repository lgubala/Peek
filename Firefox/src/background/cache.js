/* Peek — background/cache.js
 * Short-lived in-memory cache. Nothing is written to disk: re-hovering a link
 * should be free, but Peek should not accumulate a record of what you looked at.
 */
(function (P) {
  "use strict";

  const store = new Map();
  const MAX_ENTRIES = 120;

  const key = (url, opts) =>
    (opts.images ? "img" : "noimg") + "|" + url;

  /* A Map iterates in insertion order, so deleting and re-inserting on every
   * touch turns eviction from FIFO into LRU for free. Without it, re-hovering
   * the same link on a long page could evict the entry you keep using. */
  function get(url, opts) {
    const k = key(url, opts);
    const hit = store.get(k);
    if (!hit) return null;
    if (Date.now() - hit.t > P.config.CACHE_MS) { store.delete(k); return null; }
    store.delete(k);
    store.set(k, hit);
    return hit.value;
  }

  function set(url, opts, value) {
    const k = key(url, opts);
    store.delete(k);
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
    store.set(k, { t: Date.now(), value });
  }

  /* PRIVACY.md says responses "live in memory for five minutes, then vanish".
   * Expiring only on read made that untrue for anything never re-requested, so
   * a sweep makes the document match the behaviour. */
  function sweep() {
    const now = Date.now();
    for (const [k, v] of store) {
      if (now - v.t > P.config.CACHE_MS) store.delete(k);
    }
  }

  /* Nothing calls this today. It stays because a cache with no way to empty it
   * is a debugging dead end, and it is one line. */
  function clear() { store.clear(); }

  try { setInterval(sweep, 60 * 1000); } catch (_) { /* no timers here */ }

  P.cache = { get, set, clear, sweep, get size() { return store.size; } };
})(self.Peek = self.Peek || {});
