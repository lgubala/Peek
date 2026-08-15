/* Peek — extract/jsonld.js
 * Reads the structured data sites already publish for search engines.
 */
(function (P) {
  "use strict";

  function typesOf(o) {
    const t = o && o["@type"];
    if (!t) return [];
    return (Array.isArray(t) ? t : [t]).map((x) => String(x).toLowerCase());
  }

  /* Walk arbitrarily nested JSON-LD, including @graph, into a flat list. */
  function flatten(node, out, depth) {
    depth = depth || 0;
    if (!node || depth > 6) return out;
    if (Array.isArray(node)) { node.forEach((n) => flatten(n, out, depth + 1)); return out; }
    if (typeof node !== "object") return out;
    out.push(node);
    if (node["@graph"]) flatten(node["@graph"], out, depth + 1);
    if (node.mainEntity) flatten(node.mainEntity, out, depth + 1);
    if (node.mainEntityOfPage && typeof node.mainEntityOfPage === "object") {
      flatten(node.mainEntityOfPage, out, depth + 1);
    }
    if (node.hasPart) flatten(node.hasPart, out, depth + 1);
    return out;
  }

  function collect(doc) {
    const nodes = [];
    for (const block of doc.querySelectorAll('script[type="application/ld+json"]')) {
      const raw = (block.textContent || "").trim();
      if (!raw) continue;
      try {
        flatten(JSON.parse(raw), nodes);
      } catch (_) {
        /* Some sites wrap in CDATA or leave a trailing comma. One salvage try. */
        try { flatten(JSON.parse(raw.replace(/^\s*\/\/<!\[CDATA\[|\]\]>\s*$/g, "")), nodes); }
        catch (__) { /* skip this block */ }
      }
    }
    return nodes;
  }

  /* A typed entity beats WebPage/Organization boilerplate. */
  const RANK = [
    "recipe", "product", "jobposting", "event", "videoobject",
    "softwareapplication", "newsarticle", "article", "blogposting"
  ];

  function best(nodes) {
    let winner = null, rank = 99;
    for (const o of nodes) {
      const ts = typesOf(o);
      for (let i = 0; i < RANK.length; i++) {
        if (ts.indexOf(RANK[i]) !== -1 && i < rank) { winner = o; rank = i; }
      }
    }
    return winner;
  }

  P.jsonld = { typesOf, flatten, collect, best, RANK };
})(self.Peek = self.Peek || {});
