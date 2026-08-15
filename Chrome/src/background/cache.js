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

  function get(url, opts) {
    const hit = store.get(key(url, opts));
    if (!hit) return null;
    if (Date.now() - hit.t > P.config.CACHE_MS) { store.delete(key(url, opts)); return null; }
    return hit.value;
  }

  function set(url, opts, value) {
    if (store.size >= MAX_ENTRIES) store.delete(store.keys().next().value);
    store.set(key(url, opts), { t: Date.now(), value });
  }

  function clear() { store.clear(); }

  P.cache = { get, set, clear, get size() { return store.size; } };
})(self.Peek = self.Peek || {});
