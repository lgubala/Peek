/* Peek — content/sidebar.js
 * Where kept items live.
 *
 * The collection needs somewhere visible. Thirty things kept across a hundred
 * tabs, with no way to see or clear them, is exactly how an extension earns
 * "it slowed my browser down" — not because the bytes matter, but because
 * invisible accumulated state always eventually does.
 *
 * The panel is its own shadow host, separate from the card's, so the card can
 * open and close underneath it without either disturbing the other.
 */
(function (P) {
  "use strict";

  let host = null, root = null, panel = null, open = false;

  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  function ensure() {
    if (host && document.documentElement.contains(host)) return;

    host = document.createElement("div");
    host.setAttribute("data-peek-sidebar", "");
    host.style.cssText = "all:initial;position:fixed;top:0;right:0;z-index:2147483646;";
    root = host.attachShadow({ mode: "open" });

    try {
      if (self.CSSStyleSheet && "adoptedStyleSheets" in root) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(P.styles);
        root.adoptedStyleSheets = [sheet];
      }
    } catch (_) { /* the <style> below covers it */ }

    const style = document.createElement("style");
    style.textContent = P.styles;
    root.appendChild(style);

    panel = document.createElement("aside");
    panel.className = "panel";
    panel.setAttribute("role", "complementary");
    panel.setAttribute("aria-label", "Kept pages");
    panel.style.cssText =
      "display:none;position:fixed;top:0;right:0;bottom:0;width:340px;" +
      "background:var(--bg,#131A21);color:var(--ink,#DCE5EC);" +
      "border-left:1px solid var(--border,#2A3742);" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;";
    root.appendChild(panel);

    applyTheme();
    document.documentElement.appendChild(host);
  }

  function applyTheme() {
    if (!host) return;
    const t = P.settings.values.theme || "auto";
    if (t === "dark" || t === "light") host.setAttribute("data-theme", t);
    else host.removeAttribute("data-theme");
  }

  function itemRow(item) {
    const row = el("div", "kept-item");

    const head = el("div", "kept-head");
    head.appendChild(el("span", "kept-domain", P.url.hostOf(item.url)));
    if (item.kind) head.appendChild(el("span", "kept-kind", item.kind));
    row.appendChild(head);

    const title = el("a", "kept-title", item.heading || item.title || item.url);
    title.href = item.url;
    title.target = "_blank";
    title.rel = "noreferrer noopener";
    row.appendChild(title);

    if (item.flags.length) {
      const warn = el("div", "kept-flag", item.flags[0].text);
      warn.classList.add(item.flags[0].tone === "bad" ? "bad" : "warn");
      row.appendChild(warn);
    }

    if (item.metrics && item.metrics.length) {
      const m = el("div", "kept-metrics");
      item.metrics.slice(0, 3).forEach((x) => m.appendChild(el("span", null, x)));
      row.appendChild(m);
    } else if (item.description) {
      row.appendChild(el("div", "kept-desc", item.description.slice(0, 160)));
    }

    const foot = el("div", "kept-foot");
    foot.appendChild(el("span", "kept-when", "from " + item.from));

    const copy = el("button", "act", "Copy link");
    copy.addEventListener("click", () => {
      P.card.copy(item.cleanUrl).then(() => { copy.textContent = "Copied"; })
        .catch(() => { copy.textContent = "Press Ctrl+C"; })
        .then(() => setTimeout(() => { copy.textContent = "Copy link"; }, 1400));
    });
    foot.appendChild(copy);

    const drop = el("button", "act", "Remove");
    drop.addEventListener("click", () => P.kept.remove(item.id));
    foot.appendChild(drop);

    row.appendChild(foot);
    return row;
  }

  function paint() {
    if (!panel) return;
    panel.textContent = "";

    const header = el("header", "panel-head");
    header.appendChild(el("h2", null, "Kept"));
    const count = el("span", "panel-count",
      P.kept.count + (P.kept.count === 1 ? " page" : " pages"));
    header.appendChild(count);

    const close = el("button", "panel-close", "\u00d7");
    close.title = "Close (Esc)";
    close.setAttribute("aria-label", "Close kept pages");
    close.addEventListener("click", hide);
    header.appendChild(close);
    panel.appendChild(header);

    const body = el("div", "panel-body");
    if (!P.kept.count) {
      body.appendChild(el("p", "panel-empty",
        "Nothing kept yet. Press Keep on a card and it will wait here \u2014 " +
        "through scrolling, closing the tab, and restarting the browser."));
    } else {
      P.kept.all.forEach((item) => body.appendChild(itemRow(item)));
    }
    panel.appendChild(body);

    if (P.kept.count) {
      const foot = el("footer", "panel-foot");
      foot.appendChild(el("span", null,
        P.kept.count >= P.kept.MAX_ITEMS
          ? "Full \u2014 keeping another drops the oldest"
          : "Kept pages are stored on this machine only"));
      const clear = el("button", "act", "Remove all");
      clear.addEventListener("click", () => P.kept.clear());
      foot.appendChild(clear);
      panel.appendChild(foot);
    }
  }

  function show() {
    ensure();
    open = true;
    paint();
    panel.style.display = "flex";
    requestAnimationFrame(() => panel.classList.add("in"));
  }

  function hide() {
    if (!panel) return;
    open = false;
    panel.classList.remove("in");
    panel.style.display = "none";
  }

  const toggle = () => (open ? hide() : show());

  function attach() {
    P.kept.onChange(() => { if (open) paint(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && open) { e.stopPropagation(); hide(); }
    }, true);
  }

  P.sidebar = { attach, show, hide, toggle, applyTheme, get open() { return open; } };
})(self.Peek = self.Peek || {});
