/* Peek — content/kept.js
 * Things you decided to come back to.
 *
 * "Pin" used to mean only "stay open until I move away", which is a modal, not
 * a collection — the card was still anchored to a link, so scrolling past it
 * or leaving the page lost it. Keeping something has to outlive the pointer,
 * the scroll position and the tab, or it is not keeping.
 *
 * The stored form is the finished card: the analysis, and the sanitized node
 * tree that was already rendered. Storing the URL and re-fetching on open
 * would mean a second request the user never asked for, and would quietly
 * announce to that site that they came back.
 *
 * Capped, because invisible state that grows without bound is how an extension
 * becomes "the thing that made my browser slow". The cap is on count and on
 * total size, since one long article can outweigh forty short ones.
 */
(function (P) {
  "use strict";

  const api = (typeof browser !== "undefined" && browser.storage) ? browser
            : (typeof chrome !== "undefined" && chrome.storage) ? chrome : null;

  const KEY = "kept";
  const MAX_ITEMS = 50;
  const MAX_BYTES = 2 * 1024 * 1024;   // the whole collection, not each item

  let items = [];
  const listeners = [];

  const notify = () => listeners.forEach((f) => { try { f(items); } catch (_) {} });

  function load() {
    if (!api) return Promise.resolve(items);
    return api.storage.local.get([KEY]).then((stored) => {
      const raw = stored && stored[KEY];
      items = Array.isArray(raw) ? raw : [];
      notify();
      return items;
    }).catch(() => items);
  }

  function persist() {
    notify();
    if (!api) return Promise.resolve();
    return api.storage.local.set({ [KEY]: items }).catch((e) => {
      P.log.warn("could not save kept items", e && e.message);
    });
  }

  /* Oldest out first, by count and by weight. */
  function trim() {
    if (items.length > MAX_ITEMS) items = items.slice(0, MAX_ITEMS);

    let bytes = 0;
    const fits = [];
    for (const item of items) {
      bytes += JSON.stringify(item).length;
      if (bytes > MAX_BYTES) break;
      fits.push(item);
    }
    items = fits;
  }

  /* What the card was showing, small enough to keep. */
  function snapshot(data, result) {
    const summary = (result && result.ok && result.summary) || null;
    const article = (result && result.ok && result.article) || null;

    return {
      id: String(Date.now()) + "-" + Math.random().toString(36).slice(2, 8),
      url: data.lookUrl,
      cleanUrl: P.trackers.clean(data.lookUrl),
      title: data.title || "",
      linkText: (data.linkText || "").slice(0, 120),
      kept: Date.now(),
      from: location.hostname.replace(/^www\./, ""),
      kind: (summary && summary.kind) || "",
      heading: (summary && summary.heading) || "",
      description: (summary && summary.description) || "",
      metrics: (summary && summary.metrics) || [],
      image: (summary && summary.image) || "",
      flags: (data.flags || []).concat((result && result.signals && result.signals.flags) || [])
        .filter((f) => f.tone === "bad" || f.tone === "warn").slice(0, 3),
      /* The article is the big part; kept only when there is one. */
      nodes: (article && article.ok && article.nodes) || null,
      minutes: (article && article.minutes) || 0
    };
  }

  function has(url) {
    return items.some((i) => i.url === url);
  }

  function add(data, result) {
    if (has(data.lookUrl)) return false;
    items.unshift(snapshot(data, result));
    trim();
    persist();
    return true;
  }

  function remove(id) {
    const before = items.length;
    items = items.filter((i) => i.id !== id);
    if (items.length !== before) persist();
    return items.length !== before;
  }

  function removeUrl(url) {
    const before = items.length;
    items = items.filter((i) => i.url !== url);
    if (items.length !== before) persist();
    return items.length !== before;
  }

  function clear() {
    items = [];
    return persist();
  }

  function onChange(fn) { listeners.push(fn); }

  P.kept = {
    load, add, remove, removeUrl, clear, has, onChange, snapshot,
    MAX_ITEMS,
    get all() { return items; },
    get count() { return items.length; }
  };
})(self.Peek = self.Peek || {});
