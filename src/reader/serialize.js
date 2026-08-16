/* Peek — reader/serialize.js
 * Turns the sanitized fragment into a plain node tree.
 *
 * The content script used to receive an HTML string and assign it to
 * innerHTML. That was safe — the sanitizer had already rebuilt it against an
 * allowlist — but it meant the page context parsed HTML that came off the
 * network, and it is impossible to prove that safe by reading one line.
 *
 * So nothing crosses the message boundary as markup. What crosses is:
 *
 *   text node   "some words"
 *   element     { t: "p", a: { href: "…" }, c: [ … ] }
 *
 * The content script rebuilds it with createElement and textContent, checking
 * every tag and attribute against the allowlist a second time. No HTML parser
 * runs in the page, and no innerHTML is used anywhere in the extension.
 */
(function (P) {
  "use strict";

  const MAX_NODES = 4000;
  const MAX_DEPTH = 32;

  function toTree(root) {
    let budget = MAX_NODES;

    function walk(node, depth) {
      if (budget <= 0 || depth > MAX_DEPTH) return null;

      if (node.nodeType === 3) {
        const text = node.nodeValue;
        if (!text || !text.trim()) return null;
        budget--;
        return text;
      }
      if (node.nodeType !== 1) return null;

      const tag = node.tagName.toLowerCase();
      if (!P.config.ALLOWED_TAGS.has(tag)) return null;
      budget--;

      const spec = { t: tag };

      const allowed = P.config.ALLOWED_ATTRS[tag];
      if (allowed) {
        const attrs = {};
        let any = false;
        for (const name of allowed) {
          const v = node.getAttribute(name);
          if (v != null && v !== "") { attrs[name] = v; any = true; }
        }
        if (any) spec.a = attrs;
      }

      const kids = [];
      for (let c = node.firstChild; c; c = c.nextSibling) {
        const built = walk(c, depth + 1);
        if (built !== null) kids.push(built);
      }
      if (kids.length) spec.c = kids;

      return spec;
    }

    const out = [];
    for (let c = root.firstChild; c; c = c.nextSibling) {
      const built = walk(c, 0);
      if (built !== null) out.push(built);
    }
    return { nodes: out, truncated: budget <= 0 };
  }

  P.serialize = { toTree, MAX_NODES };
})(self.Peek = self.Peek || {});
