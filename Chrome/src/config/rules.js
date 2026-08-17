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
    DWELL_MAX_MS: 1500,     // the slowest the popup slider goes

    /* A pointer crossing a link on its way somewhere else is not intent.
     * Measured over the last couple of moves, in pixels per second. */
    PASSING_SPEED: 1100,
    GRACE_MS: 180,          // keep the card alive this long after leaving
    CARD_MAX_WIDTH: 420,    // px; the wide variant adds 40
    /* Suffixes under which anyone may register, so the registrable domain is
     * one label further left. Getting this wrong produces wrong *security*
     * judgements: `ownedBy()`, the brand-mismatch check and the "leaves this
     * site" chip all key off it.
     *
     * The full Public Suffix List is ~9,000 entries. Peek does not bundle it,
     * because two thirds of it is ccTLD second levels that follow an obvious
     * pattern — see SUFFIX_PATTERN below, which covers `com.ng`, `gov.br`,
     * `ac.at` and several hundred more without a single entry.
     *
     * What must be explicit is everything irregular, and above all the
     * free-hosting platforms. Those matter most: `evil.onrender.com` and
     * `victim.onrender.com` are unrelated strangers, and treating them as the
     * same registrable domain is exactly the false negative a phisher wants,
     * since throwaway phishing lives on free subdomains. */
    MULTI_SUFFIX: new Set([
      /* irregular ccTLD second levels the pattern below would miss */
      "co.uk", "org.uk", "ac.uk", "gov.uk", "me.uk", "net.uk", "sch.uk", "nhs.uk",
      "co.jp", "ne.jp", "or.jp", "ac.jp", "go.jp", "gr.jp", "lg.jp",
      "co.nz", "net.nz", "org.nz", "govt.nz", "ac.nz", "geek.nz", "school.nz",
      "co.za", "org.za", "web.za", "net.za", "gov.za", "ac.za",
      "com.au", "net.au", "org.au", "edu.au", "gov.au", "asn.au", "id.au",
      "co.il", "org.il", "ac.il", "gov.il", "net.il", "muni.il",
      "co.kr", "or.kr", "ne.kr", "re.kr", "pe.kr", "go.kr", "mil.kr",
      "com.hk", "org.hk", "edu.hk", "gov.hk", "idv.hk", "net.hk",
      "co.at", "or.at", "ac.at", "gv.at", "priv.at",
      "com.pl", "net.pl", "org.pl", "gov.pl", "edu.pl", "waw.pl", "gda.pl",
      "com.ru", "net.ru", "org.ru", "pp.ru", "msk.ru", "spb.ru",
      "com.de", "com.se", "com.es", "nom.es", "org.es", "gob.es", "edu.es",
      "asso.fr", "nom.fr", "prd.fr", "tm.fr", "gouv.fr",
      "co.com", "com.co", "eu.com", "us.com", "uk.com", "za.com", "br.com",
      "cn.com", "de.com", "jpn.com", "ru.com", "sa.com", "se.com",
      "in.net", "uk.net", "gb.net", "hu.net", "jp.net", "se.net",

      /* free hosting, user content and tunnels — where throwaway phishing
       * lives, and the reason this list exists at all */
      "github.io", "githubusercontent.com", "gitlab.io", "codeberg.page",
      "pages.dev", "workers.dev", "r2.dev", "trycloudflare.com",
      "cfargotunnel.com", "cdn.cloudflare.net",
      "vercel.app", "now.sh", "netlify.app", "netlify.com", "deno.dev",
      "surge.sh", "onrender.com", "fly.dev", "railway.app", "koyeb.app",
      "herokuapp.com", "herokudns.com", "appspot.com", "run.app",
      "cloudfunctions.net", "web.app", "firebaseapp.com",
      "azurewebsites.net", "azurestaticapps.net", "cloudapp.azure.com",
      "amazonaws.com", "s3.amazonaws.com", "elasticbeanstalk.com",
      "cloudfront.net", "awsapprunner.com",
      "ngrok.io", "ngrok-free.app", "ngrok.app", "loca.lt", "localtunnel.me",
      "glitch.me", "repl.co", "replit.dev", "replit.app", "stackblitz.io",
      "codesandbox.io", "gitpod.io", "render.com",
      "blogspot.com", "wordpress.com", "weebly.com", "wixsite.com",
      "squarespace.com", "webflow.io", "tumblr.com", "medium.com",
      "substack.com", "ghost.io", "neocities.org", "bitballoon.com",
      "myshopify.com", "bigcartel.com", "storenvy.com",
      "sharepoint.com", "notion.site", "framer.website", "carrd.co",
      "typedream.app", "super.site", "bubbleapps.io", "softr.app",
      "duckdns.org", "no-ip.org", "dynu.net", "hopto.org", "freeddns.org",
      "000webhostapp.com", "altervista.org", "byethost.com", "infinityfree.net",
      "firebaseio.com", "supabase.co", "pythonanywhere.com", "eu.org"
    ]),

    /* Second-level ccTLD suffixes are overwhelmingly regular: a handful of
     * function labels under a two-letter country code. This one pattern stands
     * in for several hundred Public Suffix List entries — `com.ng`, `co.ke`,
     * `gov.br`, `ac.at`, `edu.pe`, `net.cn` — and it fails safe: an unlisted
     * suffix is treated as a suffix, so two unrelated sites under it are never
     * mistaken for the same owner. */
    SUFFIX_PATTERN: /^(com|co|net|org|edu|ac|gov|gob|govt|gouv|mil|int|nom|or|ne|ad|go|in|web|info|biz|name|pro|sch|res|firm|gen|ind|k12|lg|priv|assn|asso|store|tv)\.[a-z]{2}$/,

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

    /* Tracking parameters live in config/trackers.js, which knows families
     * and owners as well as names. */


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

    /* Mail providers anyone can sign up to in a minute. Fine for a person,
     * telling when the address claims to speak for an organisation. */
    FREE_MAIL: new Set([
      "gmail.com", "googlemail.com", "hotmail.com", "hotmail.co.uk", "outlook.com",
      "live.com", "msn.com", "yahoo.com", "yahoo.co.uk", "ymail.com", "aol.com",
      "gmx.com", "gmx.net", "gmx.de", "mail.com", "inbox.com", "zoho.com",
      "yandex.ru", "yandex.com", "mail.ru", "rambler.ru", "qq.com", "163.com",
      "126.com", "sina.com", "naver.com", "daum.net", "seznam.cz", "azet.sk",
      "centrum.sk", "post.sk", "zoznam.sk", "protonmail.com", "proton.me",
      "tutanota.com", "tuta.io", "icloud.com", "me.com", "mac.com"
    ]),

    /* Addresses that exist to be thrown away. */
    DISPOSABLE_MAIL: new Set([
      "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org",
      "throwawaymail.com", "yopmail.com", "trashmail.com", "sharklasers.com",
      "getnada.com", "dispostable.com", "maildrop.cc", "fakeinbox.com"
    ]),

    /* Words that make a local part read as an office rather than a person.
     * A charity's operations manager does not write from a free mailbox. */
    ROLE_WORDS: new RegExp("(" + [
      "aid", "relief", "donation", "donor", "charity", "foundation", "fund",
      "grant", "award", "prize", "winner", "claim", "payment", "payout",
      "refund", "compensation", "settlement", "inherit", "lottery",
      "support", "helpdesk", "service", "customer", "client", "billing",
      "security", "verify", "verification", "account", "admin", "official",
      "department", "dept", "office", "agent", "representative", "rep",
      "manager", "director", "team", "notify", "notification", "alert"
    ].join("|") + ")", "i"),



    GENERIC_LINK_TEXT: new Set([
      "here", "click here", "read more", "more", "link", "this", "this link",
      "see more", "learn more", "continue", "details", "source", "source:",
      "[1]", "download", "view"
    ]),



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

    DEFAULTS: {
      enabled: true,

      /* What summons the card.
       *
       *   "alt" | "shift" | "ctrl"   hold the key and hover
       *   "hover"                    plain hover, the ambient original
       *
       * A modifier is the honest default. Plain hover means Peek decides what
       * you meant, which is why it needed a list of sites to stay off, a rule
       * for navigation links, and a rule for webmail — three sets of guesses
       * about intent. Holding a key *is* the intent, so a modifier trigger
       * overrides all three: ask for a peek on YouTube, in a menu, or in your
       * inbox, and you get one.
       *
       * Note for anyone changing the default: on Windows and Linux, tapping
       * Alt on its own focuses the browser's menu bar. Peek suppresses that
       * when it used the key, but "shift" avoids the question entirely. */
      trigger: "alt",

      autoPeek: true,     // fetch on hover; off makes Peek entirely request-free
      /* "off" | "same" | "any"
       *
       * Images are the largest remaining way a fetched page can reach your
       * machine: Peek never runs the page's JavaScript, but with images on
       * your browser still decodes bytes from that server, and decoders have
       * had zero-click bugs (libwebp CVE-2023-4863). "same" is a middle
       * ground — pictures from the site you are peeking, nothing from the ad
       * networks and CDNs it embeds. */
      images: "any",
      skipNav: true,      // ignore menus, breadcrumbs and footers
      theme: "auto",      // "auto" | "dark" | "light"
      dwell: 320,
      userDisabled: []    // hosts switched off from the toolbar popup
    }
  };

  P.config = Object.assign(P.config || {}, C);
})(self.Peek = self.Peek || {});
