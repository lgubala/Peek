/* Peek — reader/sanitize.js
 * Rebuilds fetched HTML against a tag and attribute allowlist.
 *
 * This is the security boundary. Whatever comes out of here is inserted into
 * the card, so nothing that can execute may survive: no <script>, no <iframe>,
 * no on* handlers, no javascript: URLs, no inline styles.
 *
 * Options:
 *   images     boolean  keep images at all
 *   maxImages  number   how many to keep
 *   baseUrl    string   resolve relative src against this
 *   linkBase   string   resolve relative href against this (defaults to baseUrl)
 */
(function (P) {
  "use strict";

  /* Resolves against `base` when one is given. GitHub's API returns READMEs
   * with relative image paths exactly as written — src="docs/screenshots/1.png"
   * — so without a base every README screenshot loses its src and vanishes. */
  function safeUrl(raw, base) {
    if (!raw) return null;
    const v = String(raw).trim();
    if (/^(javascript|data|vbscript|file|blob):/i.test(v)) return null;
    if (/^https?:\/\//i.test(v)) return v;
    if (!base) return null;
    try {
      const u = new URL(v, base);
      return (u.protocol === "https:" || u.protocol === "http:") ? u.href : null;
    } catch (_) { return null; }
  }

  /* Replaces an element with its children and returns the first of them, so
   * the caller can resume scanning there. Returns null when it had none. */
  function unwrap(parent, el) {
    const first = el.firstChild;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    el.remove();
    return first;
  }

  function sanitize(root, opts) {
    opts = opts || {};
    const showImages = !!opts.images;
    const maxImages = opts.maxImages || P.config.MAX_IMAGES;
    const imgBase = opts.baseUrl || "";
    const linkBase = opts.linkBase || opts.baseUrl || "";

    let dropped = 0, images = 0;

    /* Walks the live tree rather than a snapshot. When an element is unwrapped
     * its children are hoisted into the parent, and those children must be
     * scanned too — otherwise a <script> inside an unknown tag would be moved
     * out and never checked. Resuming at the first hoisted node guarantees
     * every node is inspected exactly once. */
    (function walk(node) {
      let child = node.firstChild;

      while (child) {
        const next = child.nextSibling;

        if (child.nodeType === 3) { child = next; continue; }    // text stays
        if (child.nodeType !== 1) { child.remove(); child = next; continue; }

        const tag = child.tagName.toLowerCase();

        if (P.config.DROPPED_TAGS.has(tag)) {
          child.remove(); dropped++; child = next; continue;
        }

        if (!P.config.ALLOWED_TAGS.has(tag)) {
          child = unwrap(node, child) || next;                   // keep the text, lose the element
          continue;
        }

        /* Images are judged BEFORE attributes are stripped. class, srcset and
         * data-canonical-src all carry size and identity information that the
         * allowlist is about to discard — GitHub hides shields.io badges
         * behind a camo URL, and only data-canonical-src gives them away. */
        if (tag === "img") {
          if (!showImages || images >= maxImages || P.images.isDecorative(child)) {
            child.remove(); dropped++; child = next; continue;
          }
        }

        /* Strip every attribute, then restore only what is allowed. */
        const allowed = P.config.ALLOWED_ATTRS[tag] || [];
        for (const name of Array.prototype.map.call(child.attributes, (a) => a.name)) {
          if (allowed.indexOf(name) === -1) { child.removeAttribute(name); continue; }
          if (name === "href" || name === "src") {
            const ok = safeUrl(child.getAttribute(name), name === "src" ? imgBase : linkBase);
            if (ok) child.setAttribute(name, ok);
            else child.removeAttribute(name);
          }
        }

        if (tag === "a") {
          if (!child.getAttribute("href")) {
            child = unwrap(node, child) || next;
            continue;
          }
          child.setAttribute("rel", "noreferrer noopener nofollow");
          child.setAttribute("target", "_blank");
        }

        if (tag === "img") {
          /* Dropped outright rather than left as an alt-text stub: a card full
           * of alt strings is worse than a card with no pictures. */
          if (!child.getAttribute("src")) { child.remove(); dropped++; child = next; continue; }
          images++;
        }

        walk(child);
        child = next;
      }
    })(root);

    return { dropped, images };
  }

  P.sanitize = { sanitize, safeUrl, unwrap };
})(self.Peek = self.Peek || {});
