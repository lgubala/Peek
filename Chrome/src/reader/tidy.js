/* Peek — reader/tidy.js
 * Readability is tuned for reading a whole page, not for a card, so it keeps
 * things a peek does not want: ad separators, font-size widgets, share
 * prompts, navigation. This removes them.
 *
 * Add new patterns to JUNK_TEXT in config/rules.js, not here.
 */
(function (P) {
  "use strict";

  function isJunk(text) {
    const t = P.text.squash(text);
    if (!t) return true;
    return P.config.JUNK_TEXT.some((re) => re.test(t));
  }

  /* A list where nearly all the text sits inside links is navigation. */
  function isNavList(node) {
    if (!/^(ul|ol)$/i.test(node.tagName)) return false;
    if (node.querySelectorAll("li").length < 3) return false;
    const all = P.text.squash(node.textContent);
    if (!all || all.length > 1200) return false;
    let linked = 0;
    for (const a of node.querySelectorAll("a")) linked += P.text.squash(a.textContent).length;
    return linked / all.length > 0.7;
  }

  /* Content that is mostly link text is a menu or an index, not an article. */
  function linkDensity(root) {
    const all = P.text.squash(root.textContent).length;
    if (!all) return 1;
    let linked = 0;
    for (const a of root.querySelectorAll("a")) linked += P.text.squash(a.textContent).length;
    return linked / all;
  }

  function tidy(root) {
    let removed = 0;

    /* Navigation lists, wherever they nest. GitHub's mega menu is deep. */
    for (const list of Array.prototype.slice.call(root.querySelectorAll("ul, ol"))) {
      if (list.parentNode && isNavList(list)) { list.remove(); removed++; }
    }

    /* Boilerplate lines and verbatim repeats. Several sites print the ad
     * separator or the timestamp twice. */
    const seen = new Set();
    const blocks = root.querySelectorAll("p, li, h1, h2, h3, h4, h5, h6, blockquote, div, figcaption");
    for (const b of Array.prototype.slice.call(blocks)) {
      if (!b.parentNode) continue;
      const t = P.text.squash(b.textContent);

      if (b.children.length === 0 && isJunk(t)) { b.remove(); removed++; continue; }

      if (t.length > 18 && b.children.length === 0) {
        const key = t.toLowerCase();
        if (seen.has(key)) { b.remove(); removed++; continue; }
        seen.add(key);
      }
    }

    /* Anything left with no text and no media is scaffolding. */
    for (const n of Array.prototype.slice.call(root.querySelectorAll("div, span, section, article, p"))) {
      if (!n.parentNode) continue;
      if (!n.querySelector("img, table, pre") && !P.text.squash(n.textContent)) {
        n.remove(); removed++;
      }
    }

    return removed;
  }

  P.tidy = { tidy, isJunk, isNavList, linkDensity };
})(self.Peek = self.Peek || {});
