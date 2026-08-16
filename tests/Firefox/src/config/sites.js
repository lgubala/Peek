/* Peek — config/sites.js
 * ============================================================================
 * PER-SITE CONFIGURATION. Three ways to teach Peek about a site, cheapest
 * first. Reach for a handler (src/sites/) only when the first two cannot work.
 *
 *   1. DISABLED     Peek does nothing at all on these hosts.
 *   2. CONTENT      Name the element that holds the content, beating
 *                   Readability's guess.
 *   3. NOTES        Tell the user what opening the page will cost them.
 *
 * Adding a site is meant to be a one-line change. See src/sites/README.md for
 * the fourth and heaviest option.
 * ============================================================================
 */
(function (P) {
  "use strict";

  const S = {

    /* --- 1. hosts where Peek stays silent ------------------------------ */
    /* No card, no request, nothing. Use for sites where a preview adds
     * nothing over what is already on screen, or where fetching is rude. */
    DISABLED_HOSTS: [
      /(^|\.)youtube\.com$/,   // the grid already shows title, channel and thumbnail
      /(^|\.)youtu\.be$/,
      /(^|\.)localhost$/
    ],

    /* --- 1b. pages where Peek looks but never fetches -------------------- */
    /* The card still appears and still tells you the destination, its country
     * and any redirect it travels through — all of which is read from the link
     * itself. It simply never sends a request.
     *
     * Webmail is the case this exists for. A newsletter link is usually a
     * click-tracker, and fetching it would register the click with whoever
     * sent the mail. Knowing that the "DB Migration tools" link actually goes
     * through ipro3.dmesp.ru in Russia is exactly what you want here, and it
     * costs nothing. Press L to fetch anyway. */
    NO_FETCH_HOSTS: [
      /(^|\.)mail\.google\.com$/,
      /(^|\.)outlook\.(com|live|office365|office)\b/,
      /(^|\.)mail\.proton\.me$/,
      /(^|\.)mail\.yahoo\.com$/,
      /(^|\.)roundcube\b/,
      /(^|\.)webmail\./
    ],

    /* --- 2. where the content actually lives ---------------------------- */
    /* Readability scores elements and picks a winner. On some sites it picks
     * the navigation. Naming the element beats guessing. */
    CONTENT_SELECTORS: [
      { host: /(^|\.)gitlab\.com$/, sel: [".file-content.md", ".readme-holder .file-content"] },
      { host: /(^|\.)stackoverflow\.com$|(^|\.)stackexchange\.com$/,
        sel: ["#question .s-prose", ".question .postcell .s-prose"] },
      { host: /(^|\.)reddit\.com$/, sel: ['[data-test-id="post-content"]', "shreddit-post"] },
      { host: /(^|\.)npmjs\.com$/, sel: ["#readme"] },
      { host: /(^|\.)pypi\.org$/, sel: ["#description .project-description"] },
      { host: /(^|\.)wikipedia\.org$/, sel: ["#mw-content-text .mw-parser-output"] },
      { host: /(^|\.)arxiv\.org$/, sel: ["blockquote.abstract"] }
    ],

    /* --- 3. what opening the page will cost ----------------------------- */
    /* [label, tone] where tone is good | info | warn | bad. Shown as a chip
     * before any request is made. */
    SITE_NOTES: {
      "nytimes.com": ["Paywall", "warn"],
      "wsj.com": ["Hard paywall", "warn"],
      "ft.com": ["Hard paywall", "warn"],
      "bloomberg.com": ["Paywall", "warn"],
      "economist.com": ["Paywall", "warn"],
      "theatlantic.com": ["Metered paywall", "warn"],
      "newyorker.com": ["Metered paywall", "warn"],
      "wired.com": ["Metered paywall", "warn"],
      "businessinsider.com": ["Metered paywall", "warn"],
      "seekingalpha.com": ["Login required", "warn"],
      "medium.com": ["Some posts metered", "warn"],
      "substack.com": ["Some posts subscriber-only", "warn"],
      "statista.com": ["Paywall", "warn"],
      "jstor.org": ["Academic paywall", "warn"],
      "sciencedirect.com": ["Academic paywall", "warn"],
      "link.springer.com": ["Academic paywall", "warn"],
      "onlinelibrary.wiley.com": ["Academic paywall", "warn"],
      "tandfonline.com": ["Academic paywall", "warn"],
      "ieeexplore.ieee.org": ["Academic paywall", "warn"],
      "scribd.com": ["Paywall", "warn"],
      "chegg.com": ["Paywall", "warn"],
      "coursehero.com": ["Paywall", "warn"],
      "linkedin.com": ["Login required", "warn"],
      "facebook.com": ["Login required", "warn"],
      "instagram.com": ["Login required", "warn"],
      "researchgate.net": ["Login required", "warn"],
      "quora.com": ["Signup interstitial", "warn"],
      "pinterest.com": ["Signup interstitial", "warn"],
      "x.com": ["Limited without login", "warn"],
      "twitter.com": ["Limited without login", "warn"],
      "arxiv.org": ["Free full text", "good"],
      "doi.org": ["Resolves to publisher", "info"],
      "wikipedia.org": ["Free, no tracking", "good"],
      "github.com": ["Free, no login needed", "good"],
      "stackoverflow.com": ["Free, no login needed", "good"]
    }
  };

  /* --- lookups ------------------------------------------------------- */

  S.isDisabled = function (host) {
    if (!host) return false;
    return S.DISABLED_HOSTS.some((re) => re.test(host));
  };

  S.isNoFetch = function (host) {
    if (!host) return false;
    return S.NO_FETCH_HOSTS.some((re) => re.test(host));
  };

  S.contentSelectors = function (host) {
    if (!host) return [];
    for (const rule of S.CONTENT_SELECTORS) if (rule.host.test(host)) return rule.sel;
    return [];
  };

  S.noteFor = function (registrable, host) {
    return S.SITE_NOTES[registrable] || S.SITE_NOTES[host] || null;
  };

  P.sites = Object.assign(P.sites || {}, S);
})(self.Peek = self.Peek || {});
