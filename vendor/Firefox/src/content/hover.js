/* Peek — content/hover.js
 * Hover intent, card placement, and the request that fills it.
 */
(function (P) {
  "use strict";

  const api = (typeof browser !== "undefined" && browser.runtime) ? browser
            : (typeof chrome !== "undefined" && chrome.runtime) ? chrome : null;

  /* Set once the extension has been reloaded, updated or disabled underneath
   * this page. Everything the content script owns still works — it is only the
   * bridge to the background that is gone. */
  let orphaned = false, orphanNotified = false;

  let dwellTimer = null, hideTimer = null;
  let currentAnchor = null, pendingAnchor = null;
  let currentData = null, state = null;

  /* Each lookup carries an id so it can be called off. Moving on used to leave
   * the fetch running: the answer was discarded, but the site had already been
   * asked. Hovering down a page of results told ten sites you looked when you
   * looked at one. */
  let requestSeq = 0, requestId = null;
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

  /* When an extension is reloaded, updated or switched off, the content
   * scripts already running in open tabs keep running but lose their bridge to
   * the background. runtime.id goes undefined and sendMessage throws
   * *synchronously*, so a .catch() on the returned promise never sees it. */
  function bridgeAlive() {
    try { return !!(api && api.runtime && api.runtime.id); }
    catch (_) { return false; }
  }

  const isInvalidated = (err) =>
    /context invalidated|receiving end does not exist|message port closed/i
      .test(String((err && err.message) || err));

  /* Explain it once, on the card the user is looking at, then go quiet. A
   * card on every hover saying "reload" would be worse than the silence. */
  function announceOrphan() {
    const first = !orphanNotified;
    orphanNotified = true;

    if (first) {
      P.log.warn("the extension was reloaded or updated \u2014 reload this page to use Peek here");
      if (currentData) {
        state = { ok: false, reason:
          "Peek was reloaded or updated. Reload this page to use it here." };
        draw();                       // before `orphaned`, so this one still renders
      }
    } else {
      hide();
    }

    orphaned = true;
  }

  /* Fire-and-forget: there is nothing useful to do if it fails. */
  function abandon() {
    if (requestId === null) return;
    const id = requestId;
    requestId = null;
    if (!bridgeAlive()) return;
    try {
      const p = api.runtime.sendMessage({ type: "peek:cancel", id });
      if (p && p.catch) p.catch(() => {});
    } catch (_) { /* the bridge went away */ }
  }

  function lookup() {
    if (state || orphaned) return;
    if (!bridgeAlive()) { announceOrphan(); return; }

    state = "loading";
    const anchor = currentAnchor, data = currentData;
    const id = ++requestSeq;
    requestId = id;
    draw();
    P.log.info("peeking", data.lookUrl);

    let pending;
    try {
      pending = api.runtime.sendMessage({
        type: "peek:look",
        id,
        url: data.lookUrl,
        images: P.settings.values.images
      });
    } catch (err) {
      if (isInvalidated(err)) { announceOrphan(); return; }
      state = { ok: false, reason: String((err && err.message) || err) };
      draw();
      return;
    }

    Promise.resolve(pending).then((res) => {
      if (id === requestId) requestId = null;
      if (currentAnchor !== anchor) return;   // the pointer moved on
      if (res && res.cancelled) return;       // we called it off ourselves
      state = res || { ok: false, reason: "No answer from the background script." };
      draw();
    }).catch((err) => {
      if (id === requestId) requestId = null;
      if (isInvalidated(err)) { announceOrphan(); return; }
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
    if (orphaned || silencedHere()) return;
    abandon();                                 // whatever we were fetching, we are not now
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
    abandon();
    if (!card) return;
    card.classList.remove("in");
    card.style.display = "none";
    currentAnchor = null;
    currentData = null;
    state = null;
  }

  /* True when the event came from inside our own card. composedPath crosses
   * the shadow boundary; the target check covers engines that do not have it. */
  function insideCard(e) {
    if (!card) return false;
    if (e.composedPath) {
      const p = e.composedPath();
      return p.indexOf(card) !== -1 || (host && p.indexOf(host) !== -1);
    }
    return e.target === card || (card.contains && card.contains(e.target));
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
      if (orphaned || !P.settings.values.enabled || silencedHere()) return;
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
      if (orphaned || !P.settings.values.enabled || silencedHere()) return;
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

    /* A capture-phase listener on window fires for scrolls on descendants too,
     * and after shadow-DOM retargeting that includes the card's own scroll
     * container — so scrolling a long article inside the card used to dismiss
     * it. Since scrolling the content is the whole point of holding real
     * content, that was the worst possible thing to get wrong.
     *
     * Page scrolls now reposition rather than hide, which is what Wikipedia's
     * Page Previews does and feels far less twitchy. The card only goes when
     * its link has scrolled out of view. */
    let scrollFrame = null;
    window.addEventListener("scroll", (e) => {
      if (insideCard(e)) return;
      clearTimeout(dwellTimer);
      if (!currentAnchor || card.style.display !== "block") return;

      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = null;
        if (!currentAnchor) return;
        const rect = currentAnchor.getBoundingClientRect();
        const visible = rect.bottom > 0 && rect.top < window.innerHeight &&
                        rect.right > 0 && rect.left < window.innerWidth;
        if (visible) place(rect);
        else hide();
      });
    }, true);
    window.addEventListener("blur", hide);
  }

  P.hover = {
    attach, show, hide, lookup, applyTheme, silencedHere, abandon,
    get requestId() { return requestId; },
    get orphaned() { return orphaned; },
    get data() { return currentData; },
    get state() { return state; }
  };
})(self.Peek = self.Peek || {});
