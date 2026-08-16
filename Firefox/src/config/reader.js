/* Peek — config/reader.js
 * ============================================================================
 * TUNING FOR THE PART THAT FETCHES AND READS.
 *
 * Split out of rules.js because none of it is needed in the content script,
 * and the content script is parsed in every tab of every page you open. These
 * 24 settings were 11 KB of that, doing nothing until a lookup actually ran.
 *
 * Everything here belongs to the background (Firefox) or the offscreen
 * document (Chrome): what may be fetched, how much of it, how long to wait,
 * and what counts as junk once it arrives.
 *
 * Anything the card needs to know stays in rules.js.
 * ============================================================================
 */
(function (P) {
  "use strict";

  Object.assign(P.config, {

    FETCH_TIMEOUT_MS: 7000,

    CHAIN_BUDGET_MS: 12000,  // whole redirect chain, not per hop

    MAX_PARALLEL: 2,        // concurrent lookups

    CACHE_MS: 5 * 60 * 1000,

    /* How much of a response to read before giving up on it.
     *
     * 640 KB was too mean for HTML. Modern news pages routinely ship one to
     * three megabytes — inline JSON-LD, inlined SVG, preload manifests — and a
     * truncated document is a broken tree, so Readability fails and the card
     * says "no article structure", which the user reads as "Peek does not work
     * on this site". This is memory in the background, not something anyone
     * waits on beyond the network time that was already spent. */
    BYTE_CAP: 2 * 1024 * 1024,      // text/html
    BYTE_CAP_OTHER: 640 * 1024,     // anything else: JSON APIs, feeds

    /* How many images survive in the card. One is right for an article or a
     * recipe. A product listing is the exception: each image belongs to a
     * different thing you are comparing. */

    /* How many images survive in the card. One is right for an article or a
     * recipe. A product listing is the exception: each image belongs to a
     * different thing you are comparing. */
    MAX_IMAGES: 1,

    MAX_IMAGES_LISTING: 8,

    LISTING_MIN_PRICES: 3,  // prices + images needed to call it a listing

    LISTING_MIN_IMAGES: 3,

    /* Content that is mostly link text is a menu or an index, not an article. */

    /* Content that is mostly link text is a menu or an index, not an article. */
    MAX_LINK_DENSITY: 0.55,

    MIN_ARTICLE_CHARS: 160,

    /* Images smaller than this are decoration: avatars, logos, badges. */

    /* Images smaller than this are decoration: avatars, logos, badges. */
    MIN_IMAGE_WIDTH: 200,

    /* --- multi-part public suffixes ----------------------------------- */
    /* So "bbc.co.uk" does not read as "co.uk". */

    /* Which domains each impersonated brand really uses. Peek fetches the
     * page anyway, so it can compare what a page CALLS itself with where it is
     * actually served from — the strongest phishing signal available without
     * any blocklist, and one that never goes stale. */
    /* Brand names that are also ordinary words. "Apple pie", "the Amazon
     * rainforest", "steam cleaning", "chase the bus", "wise words" — these
     * appear in innocent titles constantly, so a mention alone means nothing.
     * They need a password field, or the brand used as an account ("Apple ID",
     * "Amazon account"), before Peek will say anything. */
    AMBIGUOUS_BRANDS: new Set([
      "apple", "amazon", "steam", "chase", "wise", "discover", "target",
      "orange", "shell", "square", "stripe", "sky", "meta", "ups"
    ]),

    BRAND_DOMAINS: {
      paypal: ["paypal.com", "paypal.me", "paypalobjects.com"],
      apple: ["apple.com", "icloud.com", "me.com"],
      microsoft: ["microsoft.com", "live.com", "outlook.com", "office.com",
                  "office365.com", "microsoftonline.com", "msn.com", "sharepoint.com"],
      google: ["google.com", "gmail.com", "googlemail.com", "youtube.com", "goo.gl"],
      amazon: ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it",
               "amazon.es", "amazon.ca", "amazon.co.jp", "amazon.in", "amazon.com.au",
               "amazon.sk", "amazon.cz", "amazon.pl", "amzn.to"],
      netflix: ["netflix.com"],
      facebook: ["facebook.com", "fb.com", "fb.me", "meta.com"],
      instagram: ["instagram.com"],
      whatsapp: ["whatsapp.com", "wa.me"],
      linkedin: ["linkedin.com", "lnkd.in"],
      steam: ["steampowered.com", "steamcommunity.com", "valvesoftware.com"],
      binance: ["binance.com", "binance.us"],
      coinbase: ["coinbase.com"],
      metamask: ["metamask.io"],
      dhl: ["dhl.com", "dhl.de", "dhlparcel.com"],
      fedex: ["fedex.com"],
      ups: ["ups.com"],
      usps: ["usps.com"],
      dpd: ["dpd.com", "dpd.sk", "dpd.cz", "dpd.de"],
      netflix_help: ["netflix.com"],
      chase: ["chase.com"],
      wellsfargo: ["wellsfargo.com"],
      hsbc: ["hsbc.com", "hsbc.co.uk"],
      barclays: ["barclays.co.uk", "barclays.com"],
      revolut: ["revolut.com"],
      wise: ["wise.com", "transferwise.com"],
      ebay: ["ebay.com", "ebay.co.uk", "ebay.de", "ebay.at"],
      dropbox: ["dropbox.com"],
      docusign: ["docusign.com", "docusign.net"],
      irs: ["irs.gov"],
      hmrc: ["gov.uk"]
    },

    /* --- what must never be fetched ------------------------------------ */
    /* Some links DO things rather than SHOW things. An automatic previewer
     * that ignores this will log people out and spend one-time tokens. */

    /* An action is a *route*, not a word. `/logout` is a route;
     * `/how-to-delete-your-facebook-account` is a headline that happens to
     * contain a verb. Matching anywhere in the path refused seven of eight
     * ordinary news articles, which reads to a user as "this is broken".
     *
     * Bare words here; gate.js anchors them to whole path segments. */
    ACTION_SEGMENTS: [
      "logout", "log-out", "log_out", "signout", "sign-out", "logoff", "log-off",
      "unsubscribe", "optout", "opt-out", "unsub", "deactivate",
      "reset-password", "resetpassword", "forgot-password",
      "magic", "magic-link", "one-time", "onetime", "otp",
      "verify-email", "confirm-email", "activate-account",
      "accept-invite", "accept-invitation", "decline-invite",
      "add-to-cart", "addtocart", "checkout", "place-order",
      "delete", "destroy", "remove", "cancel", "revoke",
      "approve", "reject", "upvote", "downvote"
    ],

    /* Routes that span two segments: /cart/add, /account/delete. */

    /* Routes that span two segments: /cart/add, /account/delete. */
    ACTION_ROUTES: [
      /\/(cart|basket|bag)\/(add|remove|delete)(\/|$)/i,
      /\/(account|user|profile)\/(delete|close|deactivate)(\/|$)/i,
      /\/(email|newsletter)\/(unsubscribe|optout)(\/|$)/i
    ],

    /* Click-trackers announce themselves. Specific enough to match anywhere. */

    /* Click-trackers announce themselves. Specific enough to match anywhere. */
    ACTION_PATH: new RegExp([
      "clicks?\\.php", "/click/", "/track/", "/trk/", "/redirect\\.php",
      "/redir\\.php", "/out\\.php", "/go\\.php", "/link\\.php"
    ].join("|"), "i"),

    ACTION_PARAM: /^(token|auth|authcode|code|key|secret|otp|nonce|signature|sig|session|sessionid|confirm|activation|invite|magic|unsub|ticket|access_token|id_token)$/i,

    /* Categories Peek will not fetch on someone's behalf. Keyword matching is
     * shallow on purpose; a real deployment should bundle a category list. */
    /* Categories Peek does not fetch unprompted.
     *
     * Named for what it does rather than what it might be mistaken for. It is
     * NOT a security feature: it stops nothing that lacks a rude word in its
     * hostname, which is most malware, and it never will — a keyword list
     * cannot be one. Its whole job is that a stray hover should not pull down
     * bytes nobody asked for.
     *
     * Two lists, because a plain keyword match on a hostname is how you refuse
     * xxxlutz.de (a European furniture chain) and escortcarhire.co.uk.
     * Unambiguous names may match anywhere; short ambiguous ones must be a
     * whole label. */

    /* Categories Peek will not fetch on someone's behalf. Keyword matching is
     * shallow on purpose; a real deployment should bundle a category list. */
    /* Categories Peek does not fetch unprompted.
     *
     * Named for what it does rather than what it might be mistaken for. It is
     * NOT a security feature: it stops nothing that lacks a rude word in its
     * hostname, which is most malware, and it never will — a keyword list
     * cannot be one. Its whole job is that a stray hover should not pull down
     * bytes nobody asked for.
     *
     * Two lists, because a plain keyword match on a hostname is how you refuse
     * xxxlutz.de (a European furniture chain) and escortcarhire.co.uk.
     * Unambiguous names may match anywhere; short ambiguous ones must be a
     * whole label. */
    NOT_FETCHED_SUBSTRINGS: new RegExp([
      "xvideos", "xhamster", "redtube", "youporn", "pornhub", "brazzers",
      "onlyfans", "rule34", "hentai", "camsoda", "chaturbate", "stripchat",
      "bongacams", "thepiratebay", "1337x", "torrentz"
    ].join("|"), "i"),

    NOT_FETCHED_LABELS: new Set([
      "porn", "porno", "pornos", "xxx", "nsfw", "escort", "escorts",
      "sexcam", "sexcams", "camgirl", "camgirls", "darkweb"
    ]),

    /* --- page furniture the reader removes ----------------------------- */

    /* --- page furniture the reader removes ----------------------------- */

    JUNK_TEXT: [
      /pokra[čc]uje pod\s*(video\s*)?reklamou/i,
      /^p[íi]smo:?\s*\|?$/i,
      /^(reklama|inzercia|advertisement|sponsored content)$/i,
      /continue reading (below|the main story)/i,
      /make us preferred on google/i,
      /^(zdie[ľl]a[ťt]|share|tweet|subscribe|odobera[ťt]|follow us)$/i,
      /^(prihl[áa]si[ťt] sa|sign in|log in|register)$/i,
      /^skip to (main )?content$/i,
      /^(navigation menu|main menu|menu|toggle navigation|breadcrumbs?)$/i,
      /^(you signed in|you switched accounts|reload to refresh)/i,
      /^(čítajte aj|pre[čc][íi]tajte si aj|read more|related articles|s[úu]visiace)\s*:?$/i,
      /všetky pr[áa]va (s[úu] )?vyhraden|rights reserved|autorsk[ée] pr[áa]va/i,
      /^(cookies?|s[úu]bory cookie)\b.{0,80}$/i,
      /^\s*(foto|zdroj|source)\s*:?\s*$/i
    ],

    /* Author portraits, publisher logos and tracking pixels are not content. */

    /* Author portraits, publisher logos and tracking pixels are not content. */
    DECORATIVE_SRC: /(avatar|gravatar|profil|author|autor|logo|icon|sprite|badge|emoji|placeholder|spacer|blank|pixel|1x1|shields\.io|opengraph\.githubassets|\/u\/\d+)/i,

    DECORATIVE_CONTAINER: /(author|autor|avatar|profil|byline|tile-thumb|thumbnail|logo|badge|icon|share|social)/i,

    /* Lead images that say nothing: auto-generated social cards. */

    /* Removed entirely, children and all. */
    DROPPED_TAGS: new Set([
      "script", "style", "noscript", "iframe", "frame", "frameset", "object",
      "embed", "applet", "form", "input", "button", "select", "textarea",
      "link", "meta", "base", "svg", "math", "template", "slot", "audio",
      "video", "source", "track", "canvas", "map", "area", "dialog"
    ]),

    /* --- defaults the popup can override -------------------------------- */

  });
})(self.Peek = self.Peek || {});
