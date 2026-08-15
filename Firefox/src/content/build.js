/* Peek — content/build.js
 * Rebuilds the node tree from reader/serialize.js into real elements.
 *
 * Every tag and attribute is checked against the allowlist again here. The
 * background already did it, but this side is where the nodes actually enter
 * a document, so it re-checks rather than trusting a message.
 *
 * createElement and textContent only. Peek uses innerHTML nowhere.
 */
(function (P) {
  "use strict";

  const SAFE_URL = /^https?:\/\//i;

  function build(spec, doc, depth) {
    depth = depth || 0;
    if (depth > 40) return null;

    if (typeof spec === "string") return doc.createTextNode(spec);
    if (!spec || typeof spec !== "object" || typeof spec.t !== "string") return null;

    const tag = spec.t.toLowerCase();
    if (!P.config.ALLOWED_TAGS.has(tag)) return null;

    const el = doc.createElement(tag);

    const allowed = P.config.ALLOWED_ATTRS[tag] || [];
    const attrs = spec.a || {};
    for (const name of allowed) {
      const v = attrs[name];
      if (typeof v !== "string" || !v) continue;
      if ((name === "href" || name === "src") && !SAFE_URL.test(v)) continue;
      el.setAttribute(name, v);
    }

    if (tag === "a") {
      if (!el.getAttribute("href")) return null;
      el.setAttribute("rel", "noreferrer noopener nofollow");
      el.setAttribute("target", "_blank");
    }
    if (tag === "img") {
      if (!el.getAttribute("src")) return null;
      el.setAttribute("referrerpolicy", "no-referrer");
      el.setAttribute("loading", "lazy");
    }

    const kids = spec.c || [];
    for (const k of kids) {
      const child = build(k, doc, depth + 1);
      if (child) el.appendChild(child);
    }
    return el;
  }

  /* nodes -> DocumentFragment */
  function fragment(nodes, doc) {
    doc = doc || document;
    const frag = doc.createDocumentFragment();
    for (const spec of (nodes || [])) {
      const el = build(spec, doc);
      if (el) frag.appendChild(el);
    }
    return frag;
  }

  P.build = { build, fragment };
})(self.Peek = self.Peek || {});
