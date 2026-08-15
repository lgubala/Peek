/* Peek — config/rules.js
 * ============================================================================
 * GENERAL RULES. Tune Peek's behaviour here; no other file should need editing
 * for ordinary adjustments. Site-specific behaviour lives in config/sites.js.
 * ============================================================================
 */
(function (P) {
  "use strict";

  const C = {

    /* --- timing and limits ------------------------------------------- */

    DWELL_MS: 320,          // rest this long on a link before Peek reacts
    GRACE_MS: 180,          // keep the card alive this long after leaving
    CARD_MAX_WIDTH: 420,    // px; the wide variant adds 40
    FETCH_TIMEOUT_MS: 7000,
    MAX_PARALLEL: 2,        // concurrent lookups
    CACHE_MS: 5 * 60 * 1000,
    BYTE_CAP: 640 * 1024,   // stop reading the response after this much

    /* How many images survive in the card. One is right for an article or a
     * recipe. A product listing is the exception: each image belongs to a
     * different thing you are comparing. */
    MAX_IMAGES: 1,
    MAX_IMAGES_LISTING: 8,
    LISTING_MIN_PRICES: 3,  // prices + images needed to call it a listing
    LISTING_MIN_IMAGES: 3,

    /* Content that is mostly link text is a menu or an index, not an article. */
    MAX_LINK_DENSITY: 0.55,
    MIN_ARTICLE_CHARS: 160,

    /* Images smaller than this are decoration: avatars, logos, badges. */
    MIN_IMAGE_WIDTH: 200,

    /* --- multi-part public suffixes ----------------------------------- */
    /* So "bbc.co.uk" does not read as "co.uk". */
    MULTI_SUFFIX: new Set([
      "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk", "sch.uk",
      "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp",
      "com.au", "net.au", "org.au", "edu.au", "gov.au",
      "co.nz", "co.za", "co.in", "co.il", "co.kr", "co.th", "co.id",
      "com.br", "com.mx", "com.ar", "com.cn", "com.tr", "com.sg", "com.hk",
      "com.tw", "com.my", "com.ph", "com.vn", "com.pk", "com.ua", "com.pl",
      "github.io", "gitlab.io", "pages.dev", "workers.dev", "vercel.app",
      "netlify.app", "herokuapp.com", "blogspot.com", "wordpress.com",
      "s3.amazonaws.com", "firebaseapp.com", "web.app", "glitch.me", "repl.co"
    ]),

    /* --- link shapes --------------------------------------------------- */

    SHORTENERS: new Set([
      "bit.ly", "tinyurl.com", "goo.gl", "t.co", "ow.ly", "buff.ly", "is.gd",
      "cutt.ly", "rebrand.ly", "shorturl.at", "t.ly", "lnkd.in", "dlvr.it",
      "trib.al", "amzn.to", "fb.me", "wa.me", "rb.gy", "tiny.cc", "s.id",
      "v.gd", "bl.ink", "shorte.st", "adf.ly", "zpr.io", "spoti.fi",
      "apple.co", "nyti.ms", "wapo.st", "reut.rs", "bbc.in"
    ]),

    /* Query keys that carry another whole URL. */
    REDIRECT_KEYS: [
      "url", "u", "q", "target", "dest", "destination", "redirect",
      "redirect_uri", "redir", "to", "r", "link", "out", "goto", "next",
      "continue", "return", "returnurl", "imgurl", "uddg"
    ],

    TRACKING_PARAMS: new Set([
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "utm_id", "utm_name", "utm_reader", "utm_brand", "utm_social",
      "gclid", "gclsrc", "dclid", "gbraid", "wbraid", "gad_source",
      "fbclid", "msclkid", "yclid", "twclid", "igshid", "igsh", "ttclid",
      "li_fat_id", "mc_cid", "mc_eid", "_hsenc", "_hsmi", "hsctatracking",
      "vero_id", "vero_conv", "oly_anon_id", "oly_enc_id", "wickedid",
      "ref_src", "ref_url", "srsltid", "s_kwcid", "ei", "ved", "usg", "sa",
      "cad", "uact", "sca_esv", "oq", "sourceid", "spm", "scm", "share_id",
      "__twitter_impression", "guccounter", "guce_referrer",
      "guce_referrer_sig", "_ga", "_gl", "icid", "cmpid", "ncid", "mkt_tok",
      "trk", "trkcampaign"
    ]),

    SEARCH_KEYS: new Set(["q", "query", "s", "search", "k", "term", "keyword", "p", "wd", "text"]),

    FILE_TYPES: {
      pdf: ["PDF document", "info"],
      doc: ["Word document", "info"], docx: ["Word document", "info"],
      xls: ["Spreadsheet", "info"], xlsx: ["Spreadsheet", "info"],
      ppt: ["Slide deck", "info"], pptx: ["Slide deck", "info"],
      csv: ["CSV data", "info"], json: ["JSON data", "info"],
      txt: ["Plain text", "info"], md: ["Markdown", "info"],
      epub: ["Ebook", "info"], mobi: ["Ebook", "info"],
      zip: ["Archive", "warn"], rar: ["Archive", "warn"], "7z": ["Archive", "warn"],
      tar: ["Archive", "warn"], gz: ["Archive", "warn"], iso: ["Disk image", "warn"],
      dmg: ["macOS installer", "warn"], torrent: ["Torrent file", "warn"],
      exe: ["Windows executable", "bad"], msi: ["Windows installer", "bad"],
      apk: ["Android package", "bad"], bat: ["Windows script", "bad"],
      cmd: ["Windows script", "bad"], ps1: ["PowerShell script", "bad"],
      sh: ["Shell script", "bad"], jar: ["Java archive", "bad"],
      scr: ["Windows executable", "bad"],
      mp3: ["Audio", "info"], wav: ["Audio", "info"], flac: ["Audio", "info"],
      mp4: ["Video", "info"], mkv: ["Video", "info"], webm: ["Video", "info"],
      jpg: ["Image", "info"], jpeg: ["Image", "info"], png: ["Image", "info"],
      gif: ["Image", "info"], webp: ["Image", "info"], svg: ["Image", "info"],
      avif: ["Image", "info"]
    },

    /* Brands most often impersonated. Checked against the host only — paths
     * legitimately contain brand names (github.com/facebook/react). */
    BRANDS: [
      "paypal", "apple", "icloud", "microsoft", "outlook", "office365",
      "google", "gmail", "amazon", "netflix", "facebook", "instagram",
      "whatsapp", "steam", "binance", "coinbase", "metamask", "chase",
      "wellsfargo", "citibank", "hsbc", "barclays", "dhl", "fedex", "ups",
      "usps", "dpd", "irs", "hmrc"
    ],

    GENERIC_LINK_TEXT: new Set([
      "here", "click here", "read more", "more", "link", "this", "this link",
      "see more", "learn more", "continue", "details", "source", "source:",
      "[1]", "download", "view"
    ]),

    /* --- what must never be fetched ------------------------------------ */
    /* Some links DO things rather than SHOW things. An automatic previewer
     * that ignores this will log people out and spend one-time tokens. */

    ACTION_PATH: new RegExp([
      "logout", "log-out", "signout", "sign-out", "log_off", "logoff",
      "unsubscribe", "optout", "opt-out", "deactivate", "delete", "destroy",
      "remove", "cancel", "confirm", "activate", "verify", "validate",
      "reset-password", "resetpassword", "magic", "one-time", "onetime",
      "checkout", "add-to-cart", "addtocart", "basket/add", "purchase",
      "approve", "reject", "accept-invite", "join/", "vote", "upvote",
      "clicks?\\.php", "/click/", "/track/", "/redirect\\.php"
    ].join("|"), "i"),

    ACTION_PARAM: /^(token|auth|authcode|code|key|secret|otp|nonce|signature|sig|session|sessionid|confirm|activation|invite|magic|unsub|ticket|access_token|id_token)$/i,

    /* Categories Peek will not fetch on someone's behalf. Keyword matching is
     * shallow on purpose; a real deployment should bundle a category list. */
    BLOCKED_HOST: new RegExp([
      "porn", "xxx", "xvideo", "xhamster", "redtube", "youporn", "brazzers",
      "onlyfans", "rule34", "hentai", "nsfw", "camsoda", "chaturbate",
      "escort", "darkweb", "torrentz", "1337x", "thepiratebay"
    ].join("|"), "i"),

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
    DECORATIVE_SRC: /(avatar|gravatar|profil|author|autor|logo|icon|sprite|badge|emoji|placeholder|spacer|blank|pixel|1x1|shields\.io|opengraph\.githubassets|\/u\/\d+)/i,
    DECORATIVE_CONTAINER: /(author|autor|avatar|profil|byline|tile-thumb|thumbnail|logo|badge|icon|share|social)/i,

    /* Lead images that say nothing: auto-generated social cards. */
    USELESS_HERO: /(opengraph\.githubassets\.com|\/social-?card|\/og-?default|placeholder)/i,

    /* Tags the sanitizer keeps. Everything else is unwrapped or dropped. */
    ALLOWED_TAGS: new Set([
      "p", "br", "hr", "div", "span", "section", "article",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li", "dl", "dt", "dd",
      "blockquote", "pre", "code", "kbd", "samp",
      "em", "strong", "i", "b", "u", "s", "small", "sub", "sup", "mark",
      "a", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
      "time", "abbr", "cite", "q"
    ]),

    ALLOWED_ATTRS: {
      a: ["href", "title"],
      img: ["src", "alt", "width", "height"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
      time: ["datetime"],
      abbr: ["title"]
    },

    /* Removed entirely, children and all. */
    DROPPED_TAGS: new Set([
      "script", "style", "noscript", "iframe", "frame", "frameset", "object",
      "embed", "applet", "form", "input", "button", "select", "textarea",
      "link", "meta", "base", "svg", "math", "template", "slot", "audio",
      "video", "source", "track", "canvas", "map", "area", "dialog"
    ]),

    /* --- defaults the popup can override -------------------------------- */
    DEFAULTS: {
      enabled: true,
      autoPeek: true,     // fetch on hover; off makes Peek entirely request-free
      images: true,
      skipNav: true,      // ignore menus, breadcrumbs and footers
      theme: "auto",      // "auto" | "dark" | "light"
      dwell: 320,
      watchlist: [],
      userDisabled: []    // hosts switched off from the toolbar popup
    }
  };

  P.config = Object.assign(P.config || {}, C);
})(self.Peek = self.Peek || {});
