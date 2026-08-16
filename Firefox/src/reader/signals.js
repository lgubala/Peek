/* Peek — reader/signals.js
 * What the fetched page says about itself.
 *
 * Peek is in an unusual position: it has already downloaded the page. So
 * rather than asking "is this URL on a blocklist" — which needs a feed that is
 * stale within hours, and a lookup that would leak what you are about to open
 * — it can ask what the page actually *is* and whether that matches where it
 * is served from.
 *
 * These are observations, never verdicts. "This page calls itself PayPal and
 * is served from paypal-secure.xyz" is a fact the user can check. "This is
 * malware" is an accusation Peek is not entitled to make.
 */
(function (P) {
  "use strict";

  const squash = (s) => String(s || "").replace(/\s+/g, " ").trim();

  /* Words that make a page a place you type a secret into. */
  const CREDENTIAL_HINT = /(sign[\s-]?in|log[\s-]?in|logon|password|passwort|prihlás|přihlás|anmelden|connexion|accedi|iniciar sesión|verify your|confirm your|account suspended|unusual activity|re-?activate|update your (billing|payment|account))/i;

  function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); }
    catch (_) { return ""; }
  }

  function registrable(host) { return P.url.registrable(host); }

  /* Does this domain belong to the brand, or to nobody in particular? */
  function ownedBy(host, brand) {
    const owners = P.config.BRAND_DOMAINS[brand] || [];
    const reg = registrable(host);
    return owners.some((d) => reg === d || host === d || host.endsWith("." + d));
  }

  /* The brand a page announces itself as, from the places a page announces
   * itself: <title>, og:site_name, og:title, the first heading. */
  /* The brand used as an identity rather than a noun: "Apple ID",
   * "Amazon account", "sign in to Steam". */
  function qualifiedUse(text, brand) {
    return new RegExp(
      "(" + brand + "\\s+(id|account|login|sign[\\s-]?in|wallet|billing|support)" +
      "|(log|sign)[\\s-]?in\\s+to\\s+" + brand +
      "|your\\s+" + brand + "\\s+(account|id))", "i").test(text);
  }

  function claimedBrand(doc) {
    const parts = [
      (doc.querySelector("title") || {}).textContent,
      (doc.querySelector('meta[property="og:site_name"]') || { getAttribute: () => "" }).getAttribute("content"),
      (doc.querySelector('meta[property="og:title"]') || { getAttribute: () => "" }).getAttribute("content"),
      (doc.querySelector("h1") || {}).textContent
    ].map(squash).filter(Boolean).join(" | ").toLowerCase();

    if (!parts) return null;

    for (const brand of Object.keys(P.config.BRAND_DOMAINS)) {
      /* Whole word, so "apple" does not match "applesauce" and "ups" does not
       * match "groups". */
      const re = new RegExp("(^|[^a-z0-9])" + brand + "([^a-z0-9]|$)", "i");
      if (re.test(parts)) {
        return { brand, where: parts.slice(0, 120), qualified: qualifiedUse(parts, brand) };
      }
    }
    return null;
  }

  /* Is this page asking for a secret? Either it has somewhere to type one, or
   * it is written like a sign-in page. */
  function credentialContext(doc, form) {
    if (form.password) return "password";

    const said = [
      (doc.querySelector("title") || {}).textContent,
      (doc.querySelector("h1") || {}).textContent,
      (doc.querySelector('meta[property="og:title"]') || { getAttribute: () => "" }).getAttribute("content")
    ].map(squash).filter(Boolean).join(" | ");

    return CREDENTIAL_HINT.test(said) ? "wording" : null;
  }

  function credentialForm(doc) {
    const password = doc.querySelector('input[type="password"]');
    const forms = doc.querySelectorAll("form");

    /* A form that posts somewhere else entirely is worth saying out loud. */
    let crossOrigin = null;
    for (const f of forms) {
      const action = f.getAttribute("action") || "";
      if (!/^https?:\/\//i.test(action)) continue;
      crossOrigin = hostOf(action);
      break;
    }
    return { password: !!password, forms: forms.length, crossOrigin };
  }

  function metaRefresh(doc) {
    const el = doc.querySelector('meta[http-equiv="refresh" i]');
    if (!el) return null;
    const content = el.getAttribute("content") || "";
    const m = content.match(/url\s*=\s*['"]?([^'";]+)/i);
    if (!m) return null;
    const secs = parseFloat(content) || 0;
    return { url: m[1].trim(), seconds: secs };
  }

  /* --- entry ---------------------------------------------------------- */

  /* Returns { level, flags[] } where level is "" | "caution" | "danger". */
  function inspect(doc, finalUrl, opts) {
    opts = opts || {};
    const out = { level: "", flags: [] };
    if (!doc) return out;

    const host = hostOf(finalUrl);
    const form = credentialForm(doc);
    const claim = claimedBrand(doc);
    const text = squash(doc.body && doc.body.textContent).length;

    const raise = (level, tone, text) => {
      out.flags.push({ tone, text });
      if (level === "danger") out.level = "danger";
      else if (!out.level) out.level = "caution";
    };

    /* --- the page claims to be someone it is not --------------------- */
    /* A brand name on a page is not impersonation. "My Perfect Apple Pie" is
     * a recipe; Peek called it a fake Apple site, which is worse than saying
     * nothing — one warning like that and nobody believes the real ones.
     *
     * Impersonation is a brand name *plus somewhere to type a secret*. So the
     * check only runs when the page is asking for credentials at all, and the
     * brands that are also ordinary words need the strongest form of that. */
    const credentials = credentialContext(doc, form);
    const ambiguous = claim && P.config.AMBIGUOUS_BRANDS.has(claim.brand);
    const enough = credentials &&
      (!ambiguous || credentials === "password" || claim.qualified);

    if (claim && enough && !ownedBy(host, claim.brand)) {
      const proper = (P.config.BRAND_DOMAINS[claim.brand] || [])[0] || claim.brand;
      const name = claim.brand.charAt(0).toUpperCase() + claim.brand.slice(1);

      if (form.password) {
        raise("danger", "bad",
          "This page calls itself " + name + " and asks for a password, but it is served " +
          "from " + host + ", not " + proper + ".");
      } else {
        raise("caution", "warn",
          "This page calls itself " + name + ", but it is served from " + host +
          ", not " + proper + ".");
      }
    }

    /* --- a password box somewhere a password box should not be -------- */
    /* A bare login page is not suspicious by itself — GitHub's is exactly
     * that, and so is every intranet. It only means something when the place
     * asking is also odd: a throwaway registry, a raw IP, a punycode
     * lookalike. Flagging login pages in general would make Peek cry wolf on
     * the most ordinary page on the web. */
    if (form.password && !claim) {
      const origin = P.tld.info(host);
      const odd =
        (origin && origin.kind === "abuse") ? "a registry mostly used for throwaway sites"
        : P.url.isIpHost(host) ? "a bare IP address with no domain name"
        : host.indexOf("xn--") !== -1 ? "a domain using look-alike characters"
        : null;

      if (odd) {
        raise("danger", "bad",
          "This page asks for a password, and it is hosted on " + odd + ".");
      }
    }

    /* --- a form that posts to another site ---------------------------- */
    if (form.crossOrigin && registrable(form.crossOrigin) !== registrable(host)) {
      raise(form.password ? "danger" : "caution", form.password ? "bad" : "warn",
        "Whatever you type here is sent to " + form.crossOrigin + ", not to " + host + ".");
    }

    /* --- an instant bounce somewhere else ----------------------------- */
    const refresh = metaRefresh(doc);
    if (refresh) {
      const to = hostOf(refresh.url) || refresh.url.slice(0, 40);
      if (to && registrable(to) !== registrable(host)) {
        raise("caution", "warn",
          "This page immediately forwards to " + to + (refresh.seconds ? " after " +
          refresh.seconds + "s" : "") + ".");
      }
    }

    return out;
  }

  /* The hops a redirect actually travelled, described. */
  function describeChain(chain) {
    const flags = [];
    if (!chain || chain.length < 2) return { level: "", flags };

    const hosts = [];
    for (const url of chain) {
      const h = hostOf(url);
      if (h && hosts[hosts.length - 1] !== h) hosts.push(h);
    }
    if (hosts.length < 2) return { level: "", flags };

    const foreign = hosts.slice(0, -1)
      .map((h) => ({ host: h, origin: P.tld.info(h) }))
      .filter((x) => x.origin && x.origin.kind === "country");

    flags.push({
      tone: "info",
      text: "Travels through " + (hosts.length - 1) + " hop" +
        (hosts.length > 2 ? "s" : "") + ": " + hosts.join(" \u2192 ")
    });

    let level = "";
    if (foreign.length) level = "caution";
    return { level, flags, hosts };
  }

  P.signals = { inspect, describeChain, claimedBrand, credentialForm, credentialContext,
                metaRefresh, ownedBy };
})(self.Peek = self.Peek || {});
