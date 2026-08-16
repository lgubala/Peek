/* Peek — extract/types.js
 * One handler per schema.org type. Each fills `metrics` (short pills shown
 * across the top of the card) and, where it makes sense, richer fields.
 *
 * To support a new type: write a handler and register it in HANDLERS.
 */
(function (P) {
  "use strict";

  const T = () => P.text;
  const typesOf = (o) => P.jsonld.typesOf(o);

  /* --- value coercion -------------------------------------------------- */

  function txt(v) {
    if (v == null) return "";
    if (typeof v === "string") return T().decodeEntities(v.trim());
    if (typeof v === "number") return String(v);
    if (Array.isArray(v)) return v.map(txt).filter(Boolean).join(", ");
    if (typeof v === "object") {
      if (v.addressLocality || v.addressRegion || v.addressCountry) {
        return [v.addressLocality, v.addressRegion, txt(v.addressCountry)]
          .map(txt).filter(Boolean).join(", ");
      }
      return txt(v.name || v["@value"] || v.text || v.address || "");
    }
    return "";
  }

  function num(v) {
    const n = parseFloat(txt(v).replace(/[^\d.,-]/g, "").replace(",", "."));
    return isFinite(n) ? n : null;
  }

  /* recipeInstructions arrives in four shapes in the wild. */
  function instructions(v, depth) {
    depth = depth || 0;
    const out = [];
    if (!v || depth > 3) return out;

    if (typeof v === "string") {
      const parts = v.split(/\s*(?:<br\s*\/?>|<\/p>|\n)+\s*/i)
        .map((x) => T().decodeEntities(x.replace(/<[^>]+>/g, "").trim()))
        .filter((x) => x.length > 3);
      return parts.length ? parts : [T().decodeEntities(v.replace(/<[^>]+>/g, "").trim())];
    }
    if (Array.isArray(v)) {
      for (const item of v) out.push.apply(out, instructions(item, depth + 1));
      return out;
    }
    if (typeof v === "object") {
      if (typesOf(v).indexOf("howtosection") !== -1) {
        const name = txt(v.name);
        const inner = instructions(v.itemListElement, depth + 1);
        if (name && inner.length) out.push("\u00a7 " + name);
        return out.concat(inner);
      }
      const t = txt(v.text || v.name || v.description);
      if (t) out.push(t);
      return out;
    }
    return out;
  }

  function availability(v) {
    const s = txt(v).toLowerCase();
    if (!s) return "";
    if (s.indexOf("instock") !== -1) return "In stock";
    if (s.indexOf("outofstock") !== -1) return "Out of stock";
    if (s.indexOf("preorder") !== -1) return "Pre-order";
    if (s.indexOf("backorder") !== -1) return "Backordered";
    if (s.indexOf("discontinued") !== -1) return "Discontinued";
    if (s.indexOf("limited") !== -1) return "Limited stock";
    return "";
  }

  /* --- handlers -------------------------------------------------------- */

  const HANDLERS = [
    {
      types: ["recipe"],
      kind: "Recipe",
      read(o, r) {
        if (o.name) r.heading = txt(o.name);
        const ing = Array.isArray(o.recipeIngredient) ? o.recipeIngredient
                  : Array.isArray(o.ingredients) ? o.ingredients : [];
        const list = ing.map(txt).filter(Boolean);
        if (list.length) { r.ingredients = list; r.metrics.push(list.length + " ingredients"); }

        r.steps = instructions(o.recipeInstructions).slice(0, 30);

        const total = T().duration(o.totalTime) || T().duration(o.cookTime) || T().duration(o.prepTime);
        if (total) r.metrics.push(total);
        const yld = txt(o.recipeYield);
        if (yld && /\d/.test(yld)) r.metrics.push(yld);
        const cal = txt(o.nutrition && o.nutrition.calories);
        if (cal) r.metrics.push(cal);
      }
    },
    {
      types: ["product"],
      kind: "Product",
      read(o, r) {
        if (o.name) r.heading = txt(o.name);
        const brand = txt(o.brand);
        if (brand) r.metrics.push(brand);

        let offers = Array.isArray(o.offers) ? o.offers[0] : o.offers;
        if (offers && typeof offers === "object") {
          const one = T().money(offers.price, offers.priceCurrency);
          const lo = T().money(offers.lowPrice, offers.priceCurrency);
          const hi = T().money(offers.highPrice, offers.priceCurrency);
          if (one) r.metrics.unshift(one);
          else if (lo) r.metrics.unshift(hi ? lo + " \u2013 " + hi : "from " + lo);

          const av = availability(offers.availability);
          if (av) r.metrics.push(av);
          const count = num(offers.offerCount);
          if (count) r.metrics.push(count + " sellers");
        }
      }
    },
    {
      types: ["jobposting"],
      kind: "Job posting",
      read(o, r) {
        if (o.title) r.heading = txt(o.title);
        const org = txt(o.hiringOrganization);
        if (org) r.metrics.push(org);
        const loc = txt(o.jobLocation && (o.jobLocation.address || o.jobLocation));
        if (loc) r.metrics.push(loc.slice(0, 40));
        const sal = o.baseSalary && o.baseSalary.value;
        if (sal) {
          const v = T().money(sal.value || sal.minValue, o.baseSalary.currency || sal.currency);
          const unit = txt(sal.unitText).toLowerCase();
          if (v) r.metrics.unshift(v + (unit ? " / " + unit : ""));
        }
        const posted = txt(o.datePosted);
        if (posted) r.metrics.push(posted.slice(0, 10));
      }
    },
    {
      types: ["event"],
      kind: "Event",
      read(o, r) {
        if (o.name) r.heading = txt(o.name);
        const start = txt(o.startDate);
        if (start) r.metrics.push(start.slice(0, 16).replace("T", " "));
        const loc = txt(o.location);
        if (loc) r.metrics.push(loc.slice(0, 40));
      }
    },
    {
      types: ["videoobject"],
      kind: "Video",
      read(o, r) {
        if (o.name) r.heading = txt(o.name);
        const d = T().duration(o.duration);
        if (d) r.metrics.push(d);
        const up = txt(o.uploadDate);
        if (up) r.metrics.push(up.slice(0, 10));
      }
    },
    {
      types: ["softwareapplication"],
      kind: "Software",
      read(o, r) {
        if (o.name) r.heading = txt(o.name);
        const cat = txt(o.applicationCategory);
        if (cat) r.metrics.push(cat.replace(/Application$/, ""));
        const os = txt(o.operatingSystem);
        if (os) r.metrics.push(os.slice(0, 30));
      }
    },
    {
      types: ["newsarticle", "article", "blogposting"],
      kind: "Article",
      read(o, r) {
        if (typesOf(o).indexOf("newsarticle") !== -1) r.kind = "News article";
        if (o.headline || o.name) r.heading = txt(o.headline || o.name);
        const author = txt(o.author);
        if (author) r.metrics.push(author);
        const pub = txt(o.datePublished);
        if (pub) r.metrics.push(pub.slice(0, 10));
        const wc = num(o.wordCount);
        if (wc) r.metrics.push("~" + Math.max(1, Math.round(wc / 220)) + " min");
        const sec = txt(o.articleSection);
        if (sec) r.metrics.push(sec);
      }
    }
  ];

  function rating(o, r) {
    const ar = o && o.aggregateRating;
    if (!ar || typeof ar !== "object") return;
    const val = num(ar.ratingValue);
    if (val == null) return;
    const best = num(ar.bestRating) || 5;
    const count = num(ar.ratingCount) || num(ar.reviewCount);
    r.metrics.push("\u2605 " + val + "/" + best + (count ? " (" + count.toLocaleString() + ")" : ""));
  }

  function apply(node, r) {
    const ts = typesOf(node);
    for (const h of HANDLERS) {
      if (!h.types.some((t) => ts.indexOf(t) !== -1)) continue;
      r.kind = h.kind;
      try { h.read(node, r); } catch (_) { /* a bad handler must not break the card */ }
      rating(node, r);
      return true;
    }
    return false;
  }

  P.types = { HANDLERS, apply, txt, num, instructions, availability, rating };
})(self.Peek = self.Peek || {});
