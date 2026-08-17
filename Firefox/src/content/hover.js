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

  /* The link under the pointer, whether or not the trigger is satisfied. Kept
   * so that pressing the modifier while already resting on a link summons the
   * card, instead of demanding you move the mouse again. */
  let underPointer = null;
  let modifierUsed = false;

  /* Pointer speed, a mouse button held down, and an active text selection are
   * all evidence that the user is doing something other than considering a
   * link. Every hover-preview extension collects one-star reviews for
   * appearing when it was not wanted. */
  let lastMove = null, speed = 0, dragging = false;
  let host = null, root = null, card = null, announcer = null;
  let returnFocusTo = null;

  /* Escape hides the card and hands focus back to the link — which fires
   * focusin, which shows the card again. Without this, Escape does nothing at
   * all for a keyboard user. Cleared as soon as focus goes anywhere else. */
  let dismissed = null;

  /* A pinned card stays until dismissed. Without it, reading a long article
   * means never letting the pointer stray, which is not reading. */
  let pinned = false;

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
    /* Reachable, announced, and dismissible. Keyboard focus already summoned
     * the card, but it was a half-feature: nothing said it had appeared, and
     * nothing could get into it. */
    card.setAttribute("role", "dialog");
    card.setAttribute("aria-label", "Link preview");
    card.setAttribute("tabindex", "-1");
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

    /* Screen readers do not notice a shadow-root subtree appearing. A polite
     * live region says so, without stealing focus from what the user is doing. */
    announcer = document.createElement("div");
    announcer.setAttribute("aria-live", "polite");
    announcer.setAttribute("role", "status");
    announcer.style.cssText =
      "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;" +
      "clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;";
    root.appendChild(announcer);

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

  /* Said once per card, and kept short: a screen reader user does not want the
   * whole article read out because they tabbed past a link. */
  function announce(data, result) {
    if (!announcer) return;
    const parts = ["Preview of " + data.title];
    if (result && result.ok && result.summary && result.summary.kind) {
      parts.push(result.summary.kind.toLowerCase());
    }
    if (data.flags.length) parts.push("warning: " + data.flags[0].text);
    parts.push("press F6 to read it");
    announcer.textContent = parts.join(". ");
  }

  function draw() {
    if (!currentData) return;
    const rect = currentAnchor ? currentAnchor.getBoundingClientRect() : null;
    P.card.render(card, currentData, state, P.settings.values);
    announce(currentData, state && state !== "loading" ? state : null);
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
    /* A pinned card is the user's; a passing hover must not replace it. */
    if (pinned && anchor !== currentAnchor) return;
    abandon();                                 // whatever we were fetching, we are not now
    const asked = deliberate() || (opts && opts.force);
    /* Also checked in eligible(), but guarded here so nothing can route
     * around it. `force` is how __peek.probe() looks at a nav link anyway. */
    if (!asked && P.settings.values.skipNav && P.nav.isNavLink(anchor)) return;
    ensureHost();
    state = null;

    let data;
    try { data = P.analyze.analyze(anchor, location.href); }
    catch (e) { P.log.warn("analyze failed for", anchor.href, e); return; }

    /* Sites Peek stays silent on get nothing at all — unless you asked. */
    if (data.disabled && !asked) return;

    currentData = data;
    currentAnchor = anchor;
    draw();

    /* pageNoFetch pages still get a card; they just never fetch on their own.
     * Holding the trigger, or pressing L, is a deliberate act and still does. */
    const auto = P.settings.values.autoPeek && (!data.pageNoFetch || deliberate());
    if (data.lookable && (auto || asked)) lookup();
  }

  function hide() {
    abandon();
    pinned = false;
    if (!card) return;
    if (announcer) announcer.textContent = "";
    returnFocusTo = null;
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

  /* Start the dwell timer for a link. */
  function arm(a) {
    if (a === currentAnchor || a === pendingAnchor) { clearTimeout(hideTimer); return; }
    const why = busy();
    if (why) { P.log.info("not now:", why); return; }
    if (deliberate()) modifierUsed = true;
    pendingAnchor = a;
    clearTimeout(dwellTimer);
    dwellTimer = setTimeout(() => { pendingAnchor = null; show(a); },
                            P.settings.values.dwell || P.config.DWELL_MS);
  }

  function scheduleHide() {
    if (pinned) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, P.config.GRACE_MS);
  }

  /* Re-render in place, for when something the card shows has changed but the
   * lookup has not. */
  function redraw() { if (currentData) draw(); }

  function setPinned(on) {
    pinned = !!on;
    if (pinned) clearTimeout(hideTimer);
    draw();
  }

  /* --- what summons the card ---------------------------------------------- */

  const MODIFIER = { alt: "altKey", shift: "shiftKey", ctrl: "ctrlKey" };
  const KEY_NAME = { alt: "Alt", shift: "Shift", ctrl: "Control" };

  const triggerKey = () => MODIFIER[P.settings.values.trigger] || null;

  /* Reasons not to react, however long the pointer rests. */
  function busy() {
    if (dragging) return "dragging";
    if (speed > P.config.PASSING_SPEED) return "passing through";
    try {
      const sel = window.getSelection();
      /* Selecting text often ends with the pointer parked on a link. */
      if (sel && !sel.isCollapsed && String(sel).trim()) return "text is selected";
    } catch (_) { /* no selection API */ }
    return null;
  }

  /* True when the user has asked for a peek, rather than merely moved the
   * mouse across a link. */
  function summoned(e) {
    const key = triggerKey();
    if (!key) return true;                     // plain hover
    return !!(e && e[key]);
  }

  /* A held modifier is an explicit request, so the guesses Peek makes in hover
   * mode — skip navigation, stay off some sites, never fetch from webmail —
   * all give way to it. The safety gate does not: a link that logs you out is
   * still not fetched, however deliberately you hovered it. */
  const deliberate = () => !!triggerKey();

  /* --- events ----------------------------------------------------------- */

  function eligible(a) {
    if (!a || !a.href) return false;
    if (a.closest("[data-peek]")) return false;

    /* Menus, breadcrumbs and footers: little to say, and the card would sit
     * on top of the row of links you are reading past. Skipped only when Peek
     * is guessing; if you held the key, you meant this link. */
    if (!deliberate() && P.settings.values.skipNav && P.nav.isNavLink(a)) return false;

    const r = a.getBoundingClientRect();
    return r.width >= 4 && r.height >= 4;
  }

  function attach() {
    document.addEventListener("mouseover", (e) => {
      if (orphaned || !P.settings.values.enabled || silencedHere()) return;
      const a = e.target.closest && e.target.closest("a[href]");
      underPointer = a && a.href ? a : null;
      if (!eligible(a) || !summoned(e)) return;
      arm(a);
    }, true);

    /* Pressing the modifier while already resting on a link should work.
     * Requiring the mouse to move first makes the feature feel broken. */
    document.addEventListener("keydown", (e) => {
      if (orphaned || !P.settings.values.enabled || silencedHere()) return;
      const key = triggerKey();
      if (!key || !e[key] || e.repeat) return;
      if (!underPointer || !eligible(underPointer)) return;
      if (underPointer === currentAnchor) return;
      arm(underPointer);
    }, true);

    /* Firefox on Windows and Linux focuses the menu bar when Alt is tapped on
     * its own. If Peek used the key, swallow the release so the menu does not
     * appear. Nothing to do about the platforms where the OS gets there first,
     * which is why "shift" exists in the settings. */
    document.addEventListener("keyup", (e) => {
      if (!modifierUsed) return;
      if (e.key === KEY_NAME[P.settings.values.trigger]) {
        modifierUsed = false;
        e.preventDefault();
      }
    }, true);

    document.addEventListener("mouseout", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      if (a === underPointer) underPointer = null;
      const to = e.relatedTarget;
      if (to && to.closest && to.closest("a[href]") === a) return;  // still inside the link
      pendingAnchor = null;
      clearTimeout(dwellTimer);
      scheduleHide();
    }, true);

    document.addEventListener("focusin", (e) => {
      if (orphaned || !P.settings.values.enabled || silencedHere()) return;
      const a = e.target.closest && e.target.closest("a[href]");
      if (a !== dismissed) dismissed = null;
      if (a && a === dismissed) return;        // just dismissed; do not spring back
      if (eligible(a)) show(a);
    }, true);
    document.addEventListener("focusout", scheduleHide, true);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        clearTimeout(dwellTimer);
        const back = returnFocusTo || currentAnchor;
        hide();
        dismissed = back || null;
        /* Put the caret back where it came from, or Escape strands the user
         * at the top of the document. */
        if (back && back.focus) { try { back.focus(); } catch (_) { /* gone */ } }
      }

      /* F6 moves between panes in both browsers, which is what this is. Tab is
       * left alone: hijacking it would break the page's own tab order. */
      if (e.key === "F6" && card && card.style.display === "block") {
        e.preventDefault();
        if (root && root.activeElement) {
          const back = returnFocusTo;
          if (back && back.focus) back.focus();
        } else {
          /* The link, not whatever happened to have focus. If the card was
           * summoned by the mouse, activeElement is the body, and Escape
           * would strand the user at the top of the document. */
          returnFocusTo = currentAnchor || document.activeElement;
          card.focus();
        }
      }

      if ((e.key === "l" || e.key === "L") && currentData && !state &&
          !e.ctrlKey && !e.metaKey && !e.altKey) {
        const t = e.target;
        const typing = t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName || ""));
        if (!typing && currentData.lookable) { e.preventDefault(); lookup(); }
      }

      /* Alt+Shift+K opens the panel from anywhere, since the toolbar button
       * belongs to the popup. */
      if (e.altKey && e.shiftKey && (e.key === "K" || e.key === "k")) {
        e.preventDefault();
        P.sidebar.toggle();
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

      /* A pinned card has stopped being about the link. Following the anchor
       * meant scrolling past it closed the one card the user explicitly asked
       * to keep — so it stays where it is, and only Escape or Unpin closes it. */
      if (pinned) return;

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
    /* Speed is measured from the moves themselves rather than from a timer,
     * so a stationary pointer decays to zero on the next move. */
    document.addEventListener("mousemove", (e) => {
      const now = Date.now();
      if (lastMove) {
        const dt = now - lastMove.t;
        if (dt > 0) {
          const dx = e.clientX - lastMove.x, dy = e.clientY - lastMove.y;
          const px = Math.sqrt(dx * dx + dy * dy);
          /* Smoothed, so one jumpy sample does not suppress a real hover. */
          speed = speed * 0.4 + (px / dt) * 1000 * 0.6;
        }
      }
      lastMove = { x: e.clientX, y: e.clientY, t: now };
    }, { passive: true, capture: true });

    document.addEventListener("mousedown", () => { dragging = true; }, true);
    document.addEventListener("mouseup", () => { dragging = false; }, true);
    window.addEventListener("blur", () => { dragging = false; hide(); });
  }

  P.hover = {
    attach, show, hide, lookup, applyTheme, silencedHere, abandon, summoned, busy, setPinned, redraw,
    get pinned() { return pinned; },
    get requestId() { return requestId; },
    get orphaned() { return orphaned; },
    get data() { return currentData; },
    get state() { return state; }
  };
})(self.Peek = self.Peek || {});
