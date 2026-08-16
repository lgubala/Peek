/* Peek — link/analyze.js
 * Everything readable from the link itself and the page already on screen.
 * Pure: no DOM writes, no network. Runs in the content script.
 */
(function (P) {
  "use strict";

  const C = () => P.config;
  const U = () => P.url;

  /* --- helpers -------------------------------------------------------- */

  function prettySlug(pathname) {
    const parts = pathname.split("/").filter(Boolean);
    if (!parts.length) return "";
    let last = parts[parts.length - 1]
      .replace(/\.[a-z0-9]{1,8}$/i, "")
      .replace(/^\d{3,}[-_]/, "")
      .replace(/[-_]\d{3,}$/, "");
    if (!/[-_]/.test(last) || /^[0-9a-f]{16,}$/i.test(last)) return "";
    const words = last.split(/[-_]+/).filter(Boolean);
    if (words.length < 2 || words.join("").length > 90) return "";
    const s = words.join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function dateInPath(pathname) {
    const m = pathname.match(/(?:^|\/)((?:19|20)\d{2})\/(0?[1-9]|1[0-2])(?:\/(0?[1-9]|[12]\d|3[01]))?(?:\/|$)/);
    if (!m) return null;
    const dt = new Date(Date.UTC(+m[1], +m[2] - 1, m[3] ? +m[3] : 1));
    return isNaN(dt) ? null : { date: dt, hasDay: !!m[3] };
  }

  function ageString(dt) {
    const days = Math.floor((Date.now() - dt.getTime()) / 86400000);
    if (days < 0) return "dated in the future";
    if (days < 45) return days + " days old";
    const months = Math.round(days / 30.4);
    if (months < 24) return months + " months old";
    return (days / 365.25).toFixed(1).replace(/\.0$/, "") + " years old";
  }

  function domainInText(text) {
    if (!text) return "";
    const m = text.match(/\b((?:[a-z0-9][a-z0-9-]*\.)+(?:com|org|net|io|dev|co|uk|de|fr|jp|ru|gov|edu|info|biz|xyz|shop|app|ai|me|tv|us|ca|au|nl|it|es|se|no|pl|br|in|sk|cz))\b/i);
    return m ? m[1].toLowerCase() : "";
  }

  /* --- who is on the other end of an email address -------------------- */
  /* An address is a link too, and it is where a lot of fraud actually lives.
   * The rules below judge the address itself, never the message around it. */
  function inspectAddress(out, address, linkText) {
    const at = String(address || "").lastIndexOf("@");
    if (at < 1) return;

    const local = address.slice(0, at).toLowerCase();
    const domain = address.slice(at + 1).toLowerCase().replace(/^www\./, "");
    if (!domain) return;

    out.origin = P.tld.info(domain);
    out.facts.push({ label: "Domain", value: domain });

    const free = C().FREE_MAIL.has(domain);
    const disposable = C().DISPOSABLE_MAIL.has(domain);
    const roleish = C().ROLE_WORDS.test(local);

    if (disposable) {
      out.chips.push({ label: "Disposable address", tone: "bad" });
      out.flags.push({ tone: "bad", text:
        domain + " hands out throwaway mailboxes. Nobody who wants to be reachable uses one." });
    } else if (free) {
      out.chips.push({ label: "Free mail provider", tone: roleish ? "warn" : "neutral" });
    }

    /* The signal that matters: an address that speaks for an organisation,
     * sent from a mailbox anyone can register in a minute. */
    if (free && roleish) {
      out.flags.push({ tone: "bad", text:
        "This reads like an official address, but " + domain + " is a free mail provider " +
        "anyone can sign up to. A real organisation writes from its own domain." });
    }

    /* A brand in the local part that the domain does not back up. */
    const brand = C().BRANDS.find((b) => local.indexOf(b) !== -1 && domain.indexOf(b) === -1);
    if (brand) {
      out.flags.push({ tone: "bad", text:
        'The address says "' + brand + '" but it is not at a ' + brand + " domain." });
    }

    /* Link text claiming one address while the link opens another. */
    const shown = String(linkText || "").trim().toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(shown) && shown !== address.toLowerCase()) {
      out.flags.push({ tone: "bad", text:
        'It reads "' + shown + '" but writes to ' + address.toLowerCase() + "." });
    }
  }

  /* --- the dissected URL, shown only when something is wrong ---------- */

  function dissect(u, reg, sub, params) {
    const segs = [];
    segs.push({ t: u.protocol.replace(":", ""), c: u.protocol === "http:" ? "bad" : "dim" });
    segs.push({ t: "://", c: "dim" });
    if (sub) { segs.push({ t: sub, c: "dim" }); segs.push({ t: ".", c: "dim" }); }
    segs.push({ t: reg, c: "host" });
    if (u.port) segs.push({ t: ":" + u.port, c: "warn" });

    if (u.pathname && u.pathname !== "/") {
      u.pathname.split("/").forEach((p, i) => {
        if (i === 0) return;
        segs.push({ t: "/", c: "dim" });
        if (p) segs.push({ t: p, c: "path" });
      });
    }
    params.forEach(([k, v], i) => {
      const dead = P.trackers.isTracker(k, u.hostname);
      segs.push({ t: i === 0 ? "?" : "&", c: "dim" });
      segs.push({ t: k, c: dead ? "dead" : "key" });
      segs.push({ t: "=", c: dead ? "dead" : "dim" });
      segs.push({ t: v.length > 28 ? v.slice(0, 28) + "\u2026" : v, c: dead ? "dead" : "val" });
    });
    if (u.hash) segs.push({ t: u.hash.length > 30 ? u.hash.slice(0, 30) + "\u2026" : u.hash, c: "dim" });
    return segs;
  }

  /* --- entry ---------------------------------------------------------- */

  function analyze(a, pageUrl) {
    const raw = a.getAttribute("href") || "";
    const href = a.href || "";
    const linkText = P.text.squash(a.textContent);

    const out = {
      kind: "http", href, raw, linkText,
      title: "", subtitle: "", registrable: "",
      chips: [], facts: [], flags: [], segments: [],
      siteLabel: "", lookable: false, lookUrl: href, disabled: false,
      origin: null, via: null, fullHost: "", pageNoFetch: false
    };

    /* Non-http schemes answer themselves. */
    if (/^mailto:/i.test(href)) {
      out.kind = "mailto";
      const address = U().tryDecode(href.slice(7).split("?")[0]);
      out.title = address || "Email address";
      out.subtitle = "Opens your mail client";
      out.chips.push({ label: "Email", tone: "info" });
      inspectAddress(out, address, linkText);
      return out;
    }
    if (/^tel:/i.test(href)) {
      out.kind = "tel";
      out.title = href.slice(4);
      out.subtitle = "Starts a phone call";
      out.chips.push({ label: "Phone", tone: "info" });
      return out;
    }
    if (/^javascript:/i.test(raw) || raw === "#" || raw === "") {
      out.kind = "javascript";
      const inert = raw === "#" || raw === "";
      out.title = inert ? "No destination" : "Runs a script";
      out.subtitle = inert
        ? "This link goes nowhere on its own \u2014 the page handles the click."
        : "This link executes code instead of navigating.";
      out.chips.push({ label: "Not a page", tone: "warn" });
      return out;
    }

    let u;
    try { u = new URL(href); }
    catch (_) {
      out.kind = "unknown";
      out.title = "Unreadable link";
      out.subtitle = raw.slice(0, 120);
      return out;
    }
    if (u.protocol === "blob:" || u.protocol === "data:") {
      out.kind = "unknown";
      out.title = u.protocol.replace(":", "") + " link";
      out.subtitle = "Generated by the page, not a web address.";
      return out;
    }

    /* Unwrap search-engine and mailer redirects. */
    const unwrapped = U().unwrap(u);
    u = unwrapped.url;
    if (unwrapped.from) {
      out.via = { host: unwrapped.from, origin: P.tld.info(unwrapped.from) };
    }

    const host = u.hostname.replace(/^www\./, "");
    const reg = U().registrable(u.hostname);
    const sub = U().subdomain(host, reg);
    const ext = U().extension(u.pathname);
    const params = U().parseQuery(u.search);

    out.title = reg || host;
    out.fullHost = host;
    out.registrable = reg;
    /* Where the domain is registered. The single most useful thing Peek can
     * say about a host at a glance, and it costs no request. */
    out.origin = P.tld.info(host);
    out.lookUrl = u.href;
    out.disabled = P.policy.forHost(host) === "disabled" || P.policy.forHost(reg) === "disabled";

    /* --- chips ------------------------------------------------------- */
    if (u.protocol === "http:") {
      out.chips.push({ label: "Not encrypted", tone: "bad" });
      out.flags.push({ tone: "bad", text: "Sent over plain HTTP. Anything you type here is readable in transit." });
    }

    const pageHost = U().hostOf(pageUrl);
    /* Some pages are safe to look from but not to fetch from. */
    out.pageNoFetch = P.policy.forHost(pageHost) === "nofetch";
    const samePage = pageHost && U().registrable(pageHost) === reg;
    out.sameSite = !!samePage;
    /* "Leaves this site" is obvious on a results page, so say it only where
     * staying put was the reasonable expectation. */
    const SEARCHY = /^(google|bing|duckduckgo|yahoo|ecosia|startpage|brave|qwant|seznam|yandex|baidu)\./;
    if (!samePage && pageHost && !SEARCHY.test(pageHost) && !/^(reddit|news\.ycombinator|lobste)/.test(pageHost)) {
      out.chips.push({ label: "Leaves this site", tone: "info" });
    }

    if (C().SHORTENERS.has(reg)) {
      out.chips.push({ label: "Shortened", tone: "warn" });
      out.flags.push({ tone: "warn", text: "A shortener hides the real destination. Peek cannot see through it without a request." });
    }
    if (C().FILE_TYPES[ext]) {
      const [label, tone] = C().FILE_TYPES[ext];
      out.chips.push({ label, tone });
      if (tone === "bad") out.flags.push({ tone: "bad", text: "This downloads a program, not a web page." });
    }
    if (a.hasAttribute("download")) out.chips.push({ label: "Forces download", tone: "warn" });

    const rel = (a.getAttribute("rel") || "").toLowerCase();
    if (/\bsponsored\b/.test(rel)) out.chips.push({ label: "Paid placement", tone: "warn" });
    if (/\bugc\b/.test(rel)) out.chips.push({ label: "User-posted", tone: "neutral" });
    if (a.target === "_blank") out.chips.push({ label: "New tab", tone: "neutral" });

    const note = P.sites.noteFor(reg, host);
    if (note) out.chips.push({ label: note[0], tone: note[1] });

    /* --- flags: reasons to stop --------------------------------------- */
    if (/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*@/i.test(raw)) {
      out.flags.push({ tone: "bad", text: "There is an @ before the domain. The real destination is what comes after it, not before." });
    }
    if (u.hostname.indexOf("xn--") !== -1) {
      out.flags.push({ tone: "bad", text: "Domain uses non-Latin characters that can imitate a familiar name." });
    }
    if (U().isIpHost(u.hostname)) {
      out.flags.push({ tone: "warn", text: "Address is a raw IP with no domain name behind it." });
    }
    if (u.port && u.port !== "80" && u.port !== "443") {
      out.flags.push({ tone: "warn", text: "Uses an unusual port (" + u.port + ")." });
    }
    if (host.split(".").length > 4) {
      out.flags.push({ tone: "warn", text: "Unusually deep subdomain chain \u2014 a common way to bury the real domain." });
    }

    /* Host only. Paths legitimately contain brand names. */
    const brand = C().BRANDS.find((b) => sub.indexOf(b) !== -1 && reg.indexOf(b) === -1);
    if (brand) out.flags.push({ tone: "bad", text: 'Mentions "' + brand + '" but the actual domain is ' + reg + "." });

    if (out.origin && out.origin.kind === "abuse") {
      out.flags.push({ tone: "warn", text: "." + out.origin.tld + " is a registry heavily used for throwaway phishing and malware hosts." });
    }
    if (out.via && out.via.origin && out.via.origin.tone === "bad") {
      out.flags.push({ tone: "warn", text: "Routed through " + out.via.host + ", registered in " + out.via.origin.label + "." });
    }

    const claimed = domainInText(linkText);
    if (claimed && U().registrable(claimed) !== reg) {
      out.flags.push({ tone: "bad", text: 'Link reads "' + claimed + '" but points to ' + reg + "." });
    }
    if (linkText && C().GENERIC_LINK_TEXT.has(linkText.toLowerCase())) {
      out.flags.push({ tone: "warn", text: "Link text says nothing about where it goes." });
    }

    /* --- facts --------------------------------------------------------- */
    out.siteLabel = P.recognizers.recognize(u, reg, params, out.facts, out.chips);

    const dip = dateInPath(u.pathname);
    if (dip) {
      out.facts.push({
        label: "Published",
        value: dip.date.toISOString().slice(0, dip.hasDay ? 10 : 7) + " \u00b7 " + ageString(dip.date)
      });
    }
    if (!out.siteLabel) {
      const slug = prettySlug(u.pathname);
      if (slug) out.facts.push({ label: "Page", value: slug });
    }
    for (const [k, v] of params) {
      if (C().SEARCH_KEYS.has(k.toLowerCase()) && v && !U().looksLikeUrl(v)) {
        out.facts.push({ label: "Searches for", value: U().tryDecode(v).slice(0, 60) });
        break;
      }
    }
    if (u.hash && u.hash.length > 1 && !/^#L\d/.test(u.hash)) {
      const h = U().tryDecode(u.hash.slice(1)).replace(/[-_]/g, " ");
      if (h.length < 50 && !/^:~:/.test(h)) out.facts.push({ label: "Jumps to", value: h });
    }

    /* Naming who is being told beats listing opaque parameter names:
     * "4 tracking tags \u00b7 Google, Meta" says something you can act on. */
    const tracking = P.trackers.summarise(params, host, u.pathname);
    if (tracking.count) {
      out.facts.push({
        label: "Tracking tags",
        value: tracking.count + (tracking.owners.length ? " \u00b7 " + tracking.owners.slice(0, 3).join(", ") : "")
      });
    }

    out.segments = dissect(u, reg, sub, params);
    out.trackerCount = tracking.count;
    out.trackerOwners = tracking.owners;
    out.lookable = (u.protocol === "https:" || u.protocol === "http:") && !C().FILE_TYPES[ext] && !out.disabled;

    if (!out.subtitle && linkText && linkText.length < 140) out.subtitle = linkText;
    return out;
  }

  P.analyze = { analyze, prettySlug, dateInPath };
})(self.Peek = self.Peek || {});
