/* Peek — link/nav.js
 * Is this link part of the furniture rather than the content?
 *
 * Two reasons to care. Navigation peeks are nearly worthless — you already
 * know what "Home" or "Products" is — and they are exactly where the card
 * gets in the way, because a menu is a row of links you are trying to read
 * past while the card sits on top of them.
 *
 * Detection is deliberately conservative. A false positive silently removes a
 * peek the user wanted, which is worse than an occasional unwanted card, so
 * every rule here needs a clear signal: real markup, a strong class name, or a
 * list that is almost entirely links.
 */
(function (P) {
  "use strict";

  /* Markup that says "navigation" outright. */
  const NAV_ROLES =
    'nav, [role="navigation"], [role="menubar"], [role="menu"], ' +
    '[role="tablist"], [role="tab"], [role="banner"], [role="contentinfo"]';

  /* Whole-word matches only, so "menu" hits class="main-menu" but not
   * class="menuitem-description" or a restaurant's "menuCard". */
  const NAV_CLASS = new RegExp(
    "(^|[\\s_-])(" + [
      "nav", "navbar", "navigation", "topnav", "subnav", "menu", "mainmenu",
      "topbar", "top-bar", "breadcrumb", "breadcrumbs", "sidebar", "side-nav",
      "toolbar", "tabbar", "tabs", "pagination", "pager", "masthead",
      "site-header", "global-header", "site-footer", "global-footer"
    ].join("|") + ")([\\s_-]|$)", "i");

  /* A list that is almost all link text is a menu, whatever it is called. */
  const DENSE_MIN_ITEMS = 3;
  const DENSE_MAX_CHARS = 600;
  const DENSE_RATIO = 0.7;

  function classAndId(el) {
    /* className is an SVGAnimatedString on SVG elements, not a string. */
    const cls = (el.className && typeof el.className === "string") ? el.className : "";
    return cls + " " + (el.id || "");
  }

  function isLinkDense(list) {
    const items = list.querySelectorAll("li");
    if (items.length < DENSE_MIN_ITEMS) return false;
    const all = (list.textContent || "").replace(/\s+/g, " ").trim();
    if (!all || all.length > DENSE_MAX_CHARS) return false;
    let linked = 0;
    for (const a of list.querySelectorAll("a")) {
      linked += (a.textContent || "").replace(/\s+/g, " ").trim().length;
    }
    return linked / all.length > DENSE_RATIO;
  }

  function isNavLink(a) {
    if (!a || !a.closest) return false;

    try {
      if (a.closest(NAV_ROLES)) return true;
    } catch (_) { /* very old selector engines */ }

    let n = a.parentElement;
    for (let i = 0; i < 6 && n; i++, n = n.parentElement) {
      const tag = (n.tagName || "").toLowerCase();
      if (tag === "footer") return true;
      if (NAV_CLASS.test(classAndId(n))) return true;
    }

    const list = a.closest("ul, ol");
    if (list && isLinkDense(list)) return true;

    return false;
  }

  /* Why it matched, for the console. Debugging a false positive is otherwise
   * guesswork on someone else's markup. */
  function explain(a) {
    if (!a || !a.closest) return "";
    try {
      const role = a.closest(NAV_ROLES);
      if (role) return "inside <" + role.tagName.toLowerCase() + ">";
    } catch (_) { /* ignore */ }

    let n = a.parentElement;
    for (let i = 0; i < 6 && n; i++, n = n.parentElement) {
      if ((n.tagName || "").toLowerCase() === "footer") return "inside <footer>";
      const c = classAndId(n);
      if (NAV_CLASS.test(c)) return 'class/id "' + c.trim().slice(0, 40) + '"';
    }
    const list = a.closest("ul, ol");
    if (list && isLinkDense(list)) return "link-dense list";
    return "";
  }

  P.nav = { isNavLink, explain, NAV_CLASS, NAV_ROLES };
})(self.Peek = self.Peek || {});
