/* Peek — content/index.js
 * Content script entry point. Everything else is already loaded by the time
 * this runs; see the `js` array in the manifest for the order.
 */
(function (P) {
  "use strict";

  const api = (typeof browser !== "undefined" && browser.storage) ? browser
            : (typeof chrome !== "undefined" && chrome.storage) ? chrome : null;

  Promise.all([P.settings.load(), P.policy.load(api)]).then(() => {
    /* Peek does nothing at all on hosts the config or the user switched off. */
    if (P.policy.forHost(P.url.hostOf(location.href)) === "disabled") {
      P.log.info("switched off on", location.hostname);
      return;
    }
    P.hover.attach();
    P.settings.watch((v) => {
      if (!v.enabled) P.hover.hide();
      P.hover.applyTheme();
    });
    P.log.info("loaded on", location.hostname, "\u00b7 hover a link \u00b7 __peek.settings");
  });

  /* Console handle for debugging. */
  try {
    self.__peek = {
      get settings() { return Object.assign({}, P.settings.values); },
      set: (k, v) => P.settings.set(k, v),
      setWatchlist: (list) => P.settings.set("watchlist", (list || []).map(String)),
      /* Why was this link skipped? __peek.why("nav a") on any page. */
      why(sel) {
        const a = document.querySelector(sel || "a[href]");
        if (!a) return "no link matched " + (sel || "a[href]");
        const nav = P.nav.isNavLink(a);
        return {
          href: a.href,
          navigation: nav,
          because: nav ? P.nav.explain(a) : "",
          skipped: nav && P.settings.values.skipNav
        };
      },
      probe(sel) {
        const a = document.querySelector(sel || "a[href]");
        if (!a) return P.log.warn("no link matched", sel || "a[href]");
        P.hover.show(a, { force: true });
        return P.analyze.analyze(a, location.href);
      },
      last: () => P.hover.state,
      peek: P.hover
    };
  } catch (e) { P.log.warn("could not expose __peek:", e.message); }
})(self.Peek = self.Peek || {});
