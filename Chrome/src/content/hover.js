/* Peek — content/hover.js
 * Hover intent, card placement, and the request that fills it.
 */
(function (P) {
  "use strict";

  const api = (typeof browser !== "undefined" && browser.runtime) ? browser
            : (typeof chrome !== "undefined" && chrome.runtime) ? chrome : null;

  let dwellTimer = null, hideTimer = null;
  let currentAnchor = null, pendingAnchor = null;
  let currentData = null, state = null;
  let host = null, root = null, card = null;

  /* --- shadow host ----------------------------------------------------- */

  function ensureHost() {
    if (host && document.documentElement.contains(host)) return;

    host = document.createElement("div");
    host.setAttribute("data-peek", "");
    host.style.cssText = "all:initial;position:absolute;top:0;left:0;width:0;height:0;";
    root = host.attachShadow({ mode: "open" });

    /* Constructable stylesheets sidestep strict page CSP; the <style> element
     * is inserted as well because construction can succeed and still not apply. */
    try {
      if (self.CSSStyleSheet && "adoptedStyleSheets" in root) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(P.styles);
        root.adoptedStyleSheets = [sheet];
      }
    } catch (_) { /* the <style> below is the fallback */ }

    const style = document.createElement("style");
    style.textContent = P.styles;
    root.appendChild(style);

    card = document.createElement("div");
    card.className = "card";
    /* Critical layout inline, so a blocked stylesheet degrades to ugly
     * rather than invisible. */
    /* Critical layout inline, so a stylesheet blocked by a strict page CSP
     * degrades to ugly rather than invisible. Colours go through var() with a
     * literal fallback: when the sheet loaded the theme wins, and when it did
     * not the hex keeps the card readable. Plain hex here would beat the
     * stylesheet and light mode could never take effect. */
    card.style.cssText =
      "display:none;position:fixed;z-index:2147483647;" +
      "max-width:" + P.config.CARD_MAX_WIDTH + "px;" +
      "background:var(--bg,#131A21);color:var(--ink,#DCE5EC);" +
      "border:1px solid var(--border,#2A3742);border-radius:10px;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;" +
      "font-size:13px;";
    card.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    card.addEventListener("mouseleave", scheduleHide);
    root.appendChild(card);

    applyTheme();
    document.documentElement.appendChild(host);
  }

  /* "auto" leaves the attribute off so the stylesheet's prefers-color-scheme
   * media query decides. */
  function applyTheme() {
    if (!host) return;
    const t = P.settings.values.theme || "auto";
    if (t === "dark" || t === "light") host.setAttribute("data-theme", t);
    else host.removeAttribute("data-theme");
  }

  /* --- placement -------------------------------------------------------- */

  function place(rect) {
    card.style.display = "block";
    card.style.left = "-9999px";
    card.style.top = "0px";

    const cw = card.offsetWidth, ch = card.offsetHeight;
    const vw = window.innerWidth, vh = window.innerHeight, pad = 8;

    let left = rect.left;
    if (left + cw + pad > vw) left = vw - cw - pad;
    if (left < pad) left = pad;

    let top = rect.bottom + 6;
    if (top + ch + pad > vh) {
      const above = rect.top - ch - 6;
      top = above >= pad ? above : Math.max(pad, vh - ch - pad);
    }

    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";
    requestAnimationFrame(() => card.classList.add("in"));
  }

  function draw() {
    if (!currentData) return;
    const rect = currentAnchor ? currentAnchor.getBoundingClientRect() : null;
    P.card.render(card, currentData, state, P.settings.values);
    /* Every peek starts at the top, even after scrolling the previous one. */
    const scroller = card.querySelector(".scroll");
    if (scroller) scroller.scrollTop = 0;
    if (rect) place(rect);
  }

  /* --- lookup ----------------------------------------------------------- */

  function lookup() {
    if (!api || !api.runtime || state) return;
    state = "loading";
    const anchor = currentAnchor, data = currentData;
    draw();
    P.log.info("peeking", data.lookUrl);

    api.runtime.sendMessage({
      type: "peek:look",
      url: data.lookUrl,
      watchlist: P.settings.values.watchlist,
      images: P.settings.values.images
    }).then((res) => {
      if (currentAnchor !== anchor) return;   // the pointer moved on
      state = res || { ok: false, reason: "No answer from the background script." };
      draw();
    }).catch((err) => {
      if (currentAnchor !== anchor) return;
      state = { ok: false, reason: String((err && err.message) || err) };
      draw();
    });
  }

  /* --- show / hide ------------------------------------------------------ */

  /* The popup's per-site switch, read live from policy.js so flipping it takes
   * effect in already-open tabs without a reload. */
  function silencedHere() {
    return P.policy.forHost(P.url.hostOf(location.href)) === "disabled";
  }

  function show(anchor, opts) {
    if (silencedHere()) return;
    /* Also checked in eligible(), but guarded here so nothing can route
     * around it. `force` is how __peek.probe() looks at a nav link anyway. */
    if (P.settings.values.skipNav && !(opts && opts.force) && P.nav.isNavLink(anchor)) return;
    ensureHost();
    state = null;

    let data;
    try { data = P.analyze.analyze(anchor, location.href); }
    catch (e) { P.log.warn("analyze failed for", anchor.href, e); return; }

    /* Sites Peek stays silent on get nothing at all — no card, no request. */
    if (data.disabled && !(opts && opts.force)) return;

    currentData = data;
    currentAnchor = anchor;
    draw();

    /* pageNoFetch pages still get a card; they just never fetch on their own.
     * Pressing L is a deliberate act and still works. */
    const auto = P.settings.values.autoPeek && !data.pageNoFetch;
    if (data.lookable && (auto || (opts && opts.force))) lookup();
  }

  function hide() {
    if (!card) return;
    card.classList.remove("in");
    card.style.display = "none";
    currentAnchor = null;
    currentData = null;
    state = null;
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, P.config.GRACE_MS);
  }

  /* --- events ----------------------------------------------------------- */

  function eligible(a) {
    if (!a || !a.href) return false;
    if (a.closest("[data-peek]")) return false;

    /* Menus, breadcrumbs and footers: little to say, and the card would sit
     * on top of the row of links you are reading past. */
    if (P.settings.values.skipNav && P.nav.isNavLink(a)) return false;

    const r = a.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  }

  function attach() {
    document.addEventListener("mouseover", (e) => {
      if (!P.settings.values.enabled || silencedHere()) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (!eligible(a)) return;
      if (a === currentAnchor || a === pendingAnchor) { clearTimeout(hideTimer); return; }
      pendingAnchor = a;
      clearTimeout(dwellTimer);
      dwellTimer = setTimeout(() => { pendingAnchor = null; show(a); },
                              P.settings.values.dwell || P.config.DWELL_MS);
    }, true);

    document.addEventListener("mouseout", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      const to = e.relatedTarget;
      if (to && to.closest && to.closest("a[href]") === a) return;  // still inside the link
      pendingAnchor = null;
      clearTimeout(dwellTimer);
      scheduleHide();
    }, true);

    document.addEventListener("focusin", (e) => {
      if (!P.settings.values.enabled || silencedHere()) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (eligible(a)) show(a);
    }, true);
    document.addEventListener("focusout", scheduleHide, true);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { clearTimeout(dwellTimer); hide(); }

      if ((e.key === "l" || e.key === "L") && currentData && !state &&
          !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target;
        const typing = t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ""));
        if (!typing && currentData.lookable) { e.preventDefault(); lookup(); }
      }

      if (e.altKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
        P.settings.set("enabled", !P.settings.values.enabled);
        if (!P.settings.values.enabled) hide();
        P.log.info("peek " + (P.settings.values.enabled ? "on" : "off"));
      }
    }, true);

    window.addEventListener("scroll", () => { clearTimeout(dwellTimer); hide(); }, true);
    window.addEventListener("blur", hide);
  }

  P.hover = {
    attach, show, hide, lookup, applyTheme, silencedHere,
    get data() { return currentData; },
    get state() { return state; }
  };
})(self.Peek = self.Peek || {});
