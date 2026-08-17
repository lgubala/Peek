# Changelog

## 1.23.0

- **Fixed a false negative that mattered.** The registrable-domain list had 52
  entries, and everything judging "is this the same site" keys off it —
  `ownedBy()`, the brand-mismatch check, the leaves-this-site chip. So
  `evil.pages.dev` and `victim.pages.dev` came out as the same owner, which is
  exactly what a phisher wants, since throwaway phishing lives on free
  subdomains. Free hosting, tunnels and user-content platforms are now listed
  properly: Cloudflare Pages and Workers, Vercel, Netlify, Render, Fly,
  Railway, Heroku, App Engine, Azure, S3, CloudFront, ngrok, Replit, Glitch,
  Shopify, Substack, Notion, dynamic-DNS providers and more
- **Several hundred ccTLD second levels now work without listing them.**
  `com.ng`, `gov.br`, `co.ke`, `ac.at`, `net.cn`, `com.pe` were all wrong.
  Rather than bundle the ~9,000-entry Public Suffix List, one pattern covers the
  regular shape — a function label under a two-letter country code — and it
  fails safe: an unrecognised suffix is treated as a suffix, so two sites under
  it stay distinct. Merging strangers is the dangerous mistake; splitting a site
  is the harmless one

## 1.22.0

- **A page Peek cannot read is no longer dressed as a page that is dangerous.**
  Read failures rendered as amber flags — the same visual language as "this
  page asks for a password but is not the site it claims". They are now a
  neutral line that also says what is on offer instead. Same lesson as the
  apple-pie false positive: every non-warning shown as a warning makes the real
  ones easier to ignore
- **Limitations are separated from "there was nothing to read."** "The text is
  built by JavaScript" is worth saying even when a summary is showing, because
  it explains why the card is thinner than usual. "No article structure" on a
  product page is noise. Collapsing the two is what makes "works on 5 sites,
  fails on 50" feel arbitrary from the outside
- Every read outcome has a stable code and a sentence that describes the
  **page** rather than Peek's disappointment — "The text is built by
  JavaScript, so the HTML Peek received holds none of it", not "could not read
  this page"

## 1.21.0 — keeping things

- **Fixed: a pinned card closed when you scrolled past its link.** 1.16 made
  page scrolls reposition the card and hide it once the anchor left the
  viewport, and never exempted pinned cards — so scrolling away destroyed the
  one card you had explicitly asked to keep. A pinned card has stopped being
  about the link, so it now stays where it is until Escape or Unpin
- **Pin and Keep are two different things now**, which is why neither was
  understandable as one button. **Pin** holds the card open while you read.
  **Keep** saves it to a panel and comes back to it later
- **A kept-pages panel** (`Alt`+`Shift`+`K`, or the toolbar popup). Kept pages
  survive closing the tab and restarting the browser, and store the content
  Peek already fetched — so opening one later does not quietly tell that site
  you came back. Capped at 50 pages and 2 MB, oldest dropped first, with the
  count and a Remove all in the panel: accumulated state you cannot see is how
  an extension earns "it slowed my browser down"
- **Files say what they are.** A `.pdf` link reported only "not a web page",
  which the extension had already told you. Peek now reads the first 96 KB and
  reports size, the document's own title and author, page count, whether it is
  password-protected, and whether the extension disagrees with what the server
  sends. Metadata only, no PDF library, and nothing that could execute

## 1.20.0

Two reported bugs, and the performance work.

- **Fixed: "My Perfect Apple Pie" was flagged as a fake Apple site.** The
  impersonation check fired on a brand name appearing anywhere in a title, so
  apple pie, the Amazon rainforest, steam cleaning and chasing a bus were all
  suspicious. A brand name is not impersonation — impersonation is a brand name
  **plus somewhere to type a secret**. The check now runs only when the page is
  asking for credentials at all, and brands that are also ordinary words
  (`apple`, `amazon`, `steam`, `chase`, `wise`, `meta`, `ups`…) need an actual
  password field or the brand used as an account, like "Apple ID". One warning
  like that costs more trust than ten real ones earn
- **Fixed: the first-run page's "try it" link did nothing.** Browsers do not
  run content scripts on extension pages, so the card could never appear there
  — a demo that fails on the very first screen reads as a broken extension. It
  now opens a real page in a new tab and says why
- **Large pages are read in full.** The 640 KB cap truncated ordinary news
  pages, and a truncated document is a broken tree, so Peek reported "no
  article structure" and the user read that as "Peek does not work here". HTML
  now gets 2 MB; everything else keeps 640 KB. When truncation does happen, the
  card says so instead of blaming the site
- **The card no longer jumps when content arrives.** It reserves the space the
  body will need while fetching, rather than growing and repositioning under
  the pointer at the moment the fetch lands
- **Reader tuning moved to `config/reader.js`**, out of the bundle parsed in
  every tab: 24 settings that the card never touches

### On the rest of the performance review

Measured before optimising, and the numbers did not justify the bigger
changes. The content bundle compiles in **0.14 ms** and executes in **0.85 ms**
— not the 5–15 ms estimated — and per-tab heap was too small to measure
reliably. So lazy-loading the analysis layer behind `scripting.executeScript`
is not worth its complexity, and neither is deferring the stylesheet or
building the lookup tables on first use. The `config/reader.js` split was worth
doing because it also makes the tunables findable, which is what that file
promised.

## 1.19.0

- **Stack Exchange**: whether a question is answered, its score, answer count
  and tags — the three numbers the page buries below the fold, and the reason
  you hovered it. Handles the `stackexchange.com` family, where the site is in
  the subdomain, as well as the standalone domains
- **DOI**: a `doi.org` link says nothing and redirects to a publisher who will
  probably want money. Crossref answers who wrote it, when, in what, and how
  often it has been cited — for free

## 1.18.0

- **Site handlers can be a data entry rather than a module.** Most of what a
  handler does is: match a URL, call a keyless public API, map some fields.
  The GitHub handler is 90 lines and about 15 of them are about GitHub. A
  declared handler is a dozen lines with nothing but the interesting part
- **Six sites now answer directly**: Wikipedia (the lead paragraph, not the
  navigation), npm and PyPI and crates.io (version, licence, last publish),
  Hacker News (score, comments, and where the link actually goes — a table
  layout Readability could never read), and Open Library
- **The build is Node, not Python.** `scripts/build.mjs` replaces `build.py`,
  byte for byte: the generated manifests and offscreen document are identical,
  which was verified by running both and comparing. One toolchain for a
  JavaScript project, and CI no longer installs Python
- The version comes from `package.json` alone; `build/version.txt` is gone

## 1.17.0

- **Copy clean link.** The URL with the tracking taken out — `utm_*`, `fbclid`,
  campaign ids gone, `?q=` and `?page=2` kept. Peek already knew which was
  which; it just had no way to hand it to you. Copying only: Peek still never
  rewrites a URL it fetches or opens
- **Copy text.** What the card is showing — a recipe's ingredients and numbered
  steps, or an article's text — with the link appended so a paste has a source
- **Pin.** Keeps the card open while you read it, and stops a passing hover
  replacing it. Escape unpins and closes

## 1.16.0

- **The card stays out of the way.** It no longer appears while you are
  dragging, while text is selected, or while the pointer is crossing a link on
  its way somewhere else — a smoothed speed measurement, not a timer, so a
  stationary pointer is never mistaken for a fast one. The hover delay now goes
  to 1.5 seconds
- **Keyboard and screen-reader support is no longer half a feature.** Tabbing
  to a link already summoned the card, but nothing announced it and nothing
  could get into it. It is now a labelled dialog, a polite live region says a
  preview appeared and how to read it, `F6` moves in and back out, and `Esc`
  dismisses and returns focus to the link
- **Fixed: `Esc` did nothing for keyboard users.** Dismissing returned focus to
  the link, which fired `focusin`, which showed the card again immediately.
  Found by the test written for the focus-return behaviour

## 1.15.0

- **A first-run page.** On install — not on update — Peek opens one screen
  saying the two things a new user needs: hold the key, and Peek fetches pages
  so the site sees a request from your IP. Nothing else told them that; leaving
  it to a store listing nobody reads was the wrong call for an extension whose
  entire point is a careful privacy posture
- **Images have three settings instead of two**: off, same site, or any.
  "Same site" keeps the pictures from the page you are peeking and drops the
  ones it embeds from ad networks and CDNs — a middle ground between losing
  images and loading whatever the page asks for. Anyone upgrading keeps their
  choice; the old boolean is migrated
- `BLOCKED_HOST` is now `NOT_FETCHED_SUBSTRINGS` and `NOT_FETCHED_LABELS`,
  named for what it does rather than what it might be mistaken for. It is not
  a security feature, cannot become one, and the comment says so

## 1.14.0 — hold a key

- **Peek now waits for `Alt`.** Nothing appears, and nothing is fetched, until
  you hold the key and hover. Configurable in the popup: `Alt`, `Shift`,
  `Ctrl`, or the previous plain hover.
- **The guessing goes away with it.** Ambient hover forced Peek to infer intent,
  and those inferences became rules: skip navigation, stay off YouTube, never
  fetch from webmail. Holding a key *is* the intent, so under a modifier all
  three give way — Peek works in menus, on sites it otherwise stays off, and in
  your inbox. The safety gate does not give way: a link that logs you out is
  still never fetched, however deliberately you hovered it.
- Pressing the key while already resting on a link works, rather than demanding
  you move the mouse again.
- Peek swallows the `Alt` release when it used the key, so Firefox's menu bar
  does not appear. Where the platform gets there first, `Shift` is the answer,
  and the popup says so.
- The popup dims "Ignore navigation links" under a modifier and explains that
  it no longer applies, rather than leaving a control that quietly does nothing.

## 1.13.1

- **`npm run check` failed in CI** with `invalid choice: []`. In Python 3.11
  and earlier, argparse validates the *default* of `nargs="*"` against
  `choices=`, so passing no browser was an error. 3.12 does not, which is why
  it passed locally and broke in CI. The targets are validated by hand now,
  and `tests/cases/cli.js` runs the command the way CI does
- **`--check` compared modification times, not contents.** A `git checkout`
  sets every mtime to now, so CI would have reported drift on a clean tree the
  moment it got past the argparse error. Comparison is by SHA-256
- **A failed build no longer destroys the committed one.** It deleted the
  output directory before writing the new one, so an error part way through
  left nothing — which happened, to `Chrome/`. Builds now assemble in a temp
  directory and sync into place, touching only files whose contents changed
- A no-op build is 106ms rather than 7.4s, and no longer rewrites every file

## 1.13.0

- **Abandoned lookups are called off.** Moving the pointer on used to leave the
  fetch running — the answer was discarded, but the request had already been
  made. Running down a page of results told ten sites you looked when you
  looked at one. For an extension whose entire disclosure is "the site sees a
  request from your IP", that was the wrong default. The content script now
  cancels when you move to another link or dismiss the card, and the background
  aborts the fetch
- **A third simultaneous hover no longer shows an error.** "Too many lookups at
  once. Try again." made a transient internal limit the user's problem, for
  something they had already stopped caring about. The oldest in-flight lookup
  is dropped to make room and the newest always wins
- Site handlers get a signal bound into their fetch helpers, so a handler
  cannot forget to pass it and keep fetching after the user has gone

## 1.12.0 — one source tree, tests, CI

No behaviour changes. This is the structural work the review called for.

- **One source tree.** `src/` is the only place to edit. `platform/firefox/`
  and `platform/chrome/` hold the handful of genuinely browser-specific files.
  `Chrome/` and `Firefox/` are now generated by `build.py` and committed so
  they can still be uploaded to the stores directly
- **The load order is defined once**, in `build/modules.json`. Both manifests
  and Chrome's `offscreen.html` are generated from it. Peek's two worst runtime
  bugs were both a module present in one list and missing from another, failing
  only in Chrome and only at runtime; that is now impossible by construction,
  and `tests/cases/build-integrity.js` asserts it
- **A real test suite**: 50 cases, 284 assertions, running against `src/` — not
  against a build — in about a second. `tests/cases/` covers the gate, charset
  handling, the sanitizer, page signals, tracker attribution, link analysis,
  the full pipeline in *both* engine contexts, and what the card renders
- **CI** on push and pull request: syntax, `build.py --check` so a stale
  committed build fails the build, the test suite, and `web-ext lint`
- `npm run verify` runs the same three steps locally
- Added `package.json`, `.editorconfig`; removed `docs/sync-offscreen.py`,
  whose job `build.py` now does properly

Two things found while writing the tests, both worth recording:

- The suite was checked by reintroducing two shipped bugs. The gate bug was
  caught immediately. The sanitizer bug was **not** — the test asserted against
  the finished node tree, which `serialize.js` sanitises independently, so it
  passed either way. The test now asserts against the sanitizer's own output
- The runner did not await async cases, so five encoding tests reported
  "passing" with zero assertions run. It now awaits, and treats a case that
  asserts nothing as a failure

## 1.11.0 — correctness

Acting on an independent code review. Everything here is a bug fix.

- **The gate refused ordinary articles.** Action words were matched anywhere in
  the path, so `/how-to-delete-your-facebook-account`,
  `/how-to-cancel-a-gym-membership` and `/why-young-people-dont-vote` were all
  told "this link looks like it performs an action". Seven of eight test
  articles were refused. An action is a *route*, so those words now have to be
  a whole path segment. `/logout` is refused; a headline containing "logout" is
  not
- **The category list refused a furniture chain.** `xxx` matched `xxxlutz.de`
  and `escort` matched `escortcarhire.co.uk`. Unambiguous names still match
  anywhere; short ambiguous ones must now be a whole hostname label
- **Scrolling inside the card dismissed it.** A capture-phase `scroll` listener
  on `window` fires for descendants, which after shadow-DOM retargeting
  included the card's own scroll container — so scrolling a long article closed
  it. Scrolling the content is the entire point of holding real content. Page
  scrolls now *reposition* the card and only hide it once the link leaves the
  viewport
- **Fetched pages are decoded with the right charset.** Everything was decoded
  as UTF-8, so any `windows-1250`, `ISO-8859-2` or `windows-1251` page came
  back as mojibake — including sme.sk, the worked example in Peek's own README.
  The header wins, then a BOM, then the document's own `<meta charset>`
- **Chrome never loaded the per-site policy in the background**, so the gate's
  per-site check silently did nothing there. The README's claim that switching
  a site off stops the request as well as the card was false on Chrome
- **Two lookups at once could both create the offscreen document**, the second
  failing with "Only a single offscreen document may be created"
- The redirect chain has one time budget (12s) instead of six independent
  timeouts totalling 42s
- Cache evicts least-recently-*used* rather than first-inserted, and sweeps
  expired entries on a timer, so PRIVACY.md's "five minutes, then vanish" is
  now true rather than approximately true
- The sanitizer walk has a depth cap, like the two other tree walks already did
- Message handlers check the sender is this extension
- The popup reads `DEFAULTS` from `config/rules.js` instead of keeping a second
  copy with a comment promising they would stay in step
- **Open** now says "Open destination" when a redirect was unwrapped, explains
  in its tooltip that it is skipping the tracker, and shift-click goes the long
  way — the behaviour existed but was invisible, and `unwrap()` follows generic
  keys like `u` and `to`, so it is occasionally wrong
- `request()` no longer accepts a `cap` argument it ignored

## 1.10.0

Nothing new; what was already there, done properly.

- **Tracking parameters became a module, `config/trackers.js`.** Three kinds of
  rule instead of one flat list of names:
  - **families** — `/^utm[_-]/`, `/^pk_/`, `/^mtm_/`, `/^hsa_/`. One rule
    replaces fifty entries and catches parameters nobody has catalogued yet:
    `utm_brand_new_thing` is recognised without an update
  - **site-scoped names** — `?ref=` means referrer tracking on Amazon and
    "reference" on half the web. Attributing every `?ref=` to Amazon was
    confidently wrong, which is the one thing a hint must never be
  - **path tracking** — Amazon and eBay bake it into the path, not the query
- **Parameters are attributed to whoever is being told.** "4 tracking tags ·
  Google, Meta" instead of four opaque strings
- `__peek.trackers(url)` in the console explains what Peek makes of any query
- Removed `text.stripTags`, which was written, exported and never called, and a
  duplicated comment block in `hover.js` left by an earlier patch

## 1.9.0

- **Peek judges the page, not a blocklist.** It has already downloaded the
  page, so instead of asking whether a URL is on a feed that goes stale within
  hours, it asks what the page says about itself:
  - a page calling itself PayPal, Microsoft, Steam and so on while served from
    a domain that brand does not own — the strongest phishing signal available
    without any list, and it never expires
  - a form that posts what you type to a different site entirely
  - a password field on a throwaway registry, a bare IP, or a punycode domain
  - a page that immediately forwards somewhere else
- **The card looks wrong, not just reads wrong.** A red or amber border, a
  drawn warning sign, and a banner directly under the domain. Ordinary cards
  are untouched
- **Redirects show every hop.** Peek follows them by hand rather than letting
  the browser hide the route, so `t.co → tracker.de → destination` is visible.
  Every hop passes the safety gate, so a redirect cannot be a way in
- Tracking parameters: 50 to 240. Compiled from public vendor documentation
  rather than a licensed catalogue — ClearURLs and AdGuard data is LGPL-3.0,
  DuckDuckGo's is CC BY-NC-SA, and Brave's and Firefox's lists now ship through
  a downloaded component and Remote Settings, so neither can be vendored from
  source without a runtime fetch

## 1.8.0

- **Removed the watchlist.** Highlighting user-supplied words inside a peeked
  page was a feature in search of a problem: it only ever did anything on
  recipes, it needed configuring before it did anything at all, and it pulled
  the card away from the one job it is good at — showing what is on the other
  side of a link. Every trace is gone: the setting, the popup field, the
  message payload, the highlight styling and the `watchHits` field on the
  summary object. Entries below that mention it are kept as history

## 1.7.3

- **Fixed: `Extension context invalidated` on every hover** after the extension
  was reloaded, updated or switched off while a page was already open. Content
  scripts keep running in those tabs but lose their bridge to the background:
  `runtime.id` goes undefined and `sendMessage` throws *synchronously*, so the
  `.catch()` on the returned promise never saw it and the error surfaced as
  uncaught. The call is now inside a `try`, the bridge is checked first, and
  the promise path recognises the same condition
- When it happens, the card explains it once — "Peek was reloaded or updated.
  Reload this page to use it here" — and then Peek goes quiet in that tab
  rather than repeating itself on every link

## 1.7.2

- **Fixed: every link failed in Chrome** with `Cannot read properties of
  undefined (reading 'forHost')`. Chrome's offscreen document lists the engine
  modules in HTML rather than in the manifest, and `src/common/policy.js` was
  never added to that list, so the safety gate threw on every lookup. Firefox
  was unaffected, because its background page takes the list from the manifest
- That list is now generated from the Firefox manifest by
  `docs/sync-offscreen.py`, which also has a `--check` mode for CI. This class
  of bug fails only in Chrome and only at runtime, so it needed a guard rather
  than more care

## 1.7.1

- **Dropped the `tabs` permission.** The popup reads the active tab's hostname
  for the per-site switch, and a matching host permission has granted that
  since Chrome 50 and Firefox 86. Peek already has `<all_urls>`, so `tabs` was
  redundant — one fewer permission at install and one fewer justification at
  review
- Added `docs/chrome-webstore-form.md` with the Web Store privacy answers

## 1.7.0

- **Email addresses are inspected too.** An address is a link, and it is where
  a lot of fraud actually lives. Peek now flags a disposable mailbox, a brand
  in the local part the domain does not back up (`paypal.support@gmail.com`),
  link text claiming one address while the link writes to another, and the
  combination that matters most: an address that reads like an office
  (`aid`, `claim`, `refund`, `support`, `department`…) sent from a free mail
  provider. `enquiries@oxfam.org.uk`, `sales@company.net` and
  `jana.kovacova@gmail.com` stay silent
- Reworded the webmail notice. It said a link "is often a click-tracker",
  which read as a verdict on the link the user was hovering — alarming and
  wrong for an ordinary link. It now explains that Peek holds back on *mail*,
  not on that link

## 1.6.0

- **Declared data collection.** `data_collection_permissions.required` is
  `["none"]`, required by AMO for new submissions since 3 November 2025. Peek
  transmits nothing to the developer or anyone else
- **No `innerHTML` anywhere in Peek's own code.** The sanitized article used to
  cross the message boundary as an HTML string and get assigned to `innerHTML`.
  It now crosses as a plain node tree and is rebuilt with `createElement` and
  `textContent`, re-checking every tag and attribute against the allowlist on
  the receiving side. No HTML parser runs in the page context at all, and a
  tampered message cannot introduce a tag that is not on the list
- The explainer text is built from parts rather than markup
- The site-selector path clones the matched element instead of round-tripping
  it through `innerHTML`
- Added `REVIEWER-NOTES.md` covering the two remaining linter warnings, which
  are inside Mozilla's own Readability and operate on a detached document

## 1.5.1

- **Light mode works.** The card sets a few critical styles inline so a
  stylesheet blocked by a strict page CSP degrades to ugly rather than
  invisible — but those included literal colours, and inline styles beat the
  stylesheet, so the theme could never take effect. Child elements switched to
  light tokens on a hard-coded dark background, which is why the text became
  unreadable. The inline colours now go through `var(--bg, #131A21)`: the theme
  wins when the sheet loaded, the literal keeps the card readable when it did not
- **One Appearance section, one This-site section.** Both were duplicated in
  the popup markup; `getElementById` returns the first match, so the lower
  copies were dead controls
- The popup now follows the theme too, instead of staying dark while the card
  went light

## 1.5.0

- **Icons.** A peephole set in a door, at 16, 32, 48, 96 and 128px. Each size
  is drawn rather than scaled: the hinge seam appears at 48, the glint and the
  knob only at 128, because at 16px they turn to mush. Source and generator in
  `docs/icon/`

## 1.4.0

- **Navigation links are ignored** by default. Menus, breadcrumbs, tab strips
  and footers are where a peek says least and gets in the way most — the card
  lands on top of the row of links you are reading past. Detection needs a
  clear signal: `<nav>`, a navigation ARIA role, `<footer>`, a whole-word class
  match like `navbar` or `breadcrumbs`, or a list that is almost entirely link
  text. Toggle it off in the popup
- `__peek.why("selector")` reports whether a link counts as navigation and
  which rule decided, for debugging a false positive on someone else's markup

## 1.3.0

- **README images work.** GitHub's API returns READMEs with relative image
  paths untouched (`src="docs/screenshots/1.png"`), and the sanitizer rejects
  relative URLs, so every screenshot lost its `src`. The sanitizer now resolves
  against a base URL, and the GitHub handler supplies the raw-content base
- Badges hidden behind GitHub's camo proxy are recognised again, via
  `data-canonical-src`
- **Light and dark themes.** Follows the browser by default; the popup can
  force either. Every colour is a token in `content/styles.js`
- **"?" explainers** on the origin chip and the redirect hop, so the card can
  say what "via ipro3.dmesp.ru · RU Russia" actually means
- **Per-site switch** in the popup: turn Peek off for the site you are on, and
  back on from the list. Applies immediately in open tabs
- Consolidated duplicate page-policy logic onto `common/policy.js`, which both
  the content script and the background consult, so a site you switch off stops
  being fetched as well as stopping being shown

## 1.2.0

- **README images appear again.** `width="30%"` was being read as 30 pixels, so
  every screenshot laid out with a relative width looked like an icon and was
  discarded. Only a plain integer counts as a size now
- **Webmail shows a card again, and still never fetches.** Gmail and friends
  moved from `DISABLED_HOSTS` to the new `NO_FETCH_HOSTS`: you get the
  destination, its country and any redirect hop, read entirely from the link,
  with no request. Press L to fetch anyway
- **Every peek starts at the top.** Scrolling one card no longer leaves the
  next one part-way down
- **Sanitizer fix (security).** When an element was unwrapped its children were
  hoisted into the parent but never re-scanned, so a `<script>` inside an
  unknown tag could survive. The walk now resumes at the first hoisted node,
  and every node is inspected exactly once

## 1.1.0

- The domain is now the largest element on the card, with the country of its
  registry beside it. `.ru`, `.cn`, `.de` and the rest are named outright
- Redirect hops get their own line and their own country, so a tracker in the
  middle of a link is visible rather than implied
- Registries with a long history of abuse (`.tk`, `.top`, `.xyz`, `.click`…)
  are marked in red and explained
- Country codes are shown as text, not flag emoji, which do not render on Windows

## 1.0.0

First public release, and a full restructure.

**Layout**
- Split into `Chrome/` and `Firefox/`, each a complete, installable copy
- One module per job under `src/`, on a shared `Peek` namespace; no build step
- General behaviour lives in `config/rules.js`, per-site behaviour in
  `config/sites.js`; most changes should touch only those two files

**Chrome support**
- MV3 build. The service worker has no DOM, so the engine runs in an offscreen
  document — the same files, in the same order, that Firefox loads in its
  background page

**Behaviour**
- YouTube is disabled: the grid already shows title, channel and thumbnail
- Webmail hosts are disabled: hovering a link in your inbox would register the
  click with whoever sent it
- Images with no `src`, or when images are off, are dropped rather than left as
  alt-text stubs
- Base64 redirect parameters are unwrapped, so email click-trackers reveal
  their real destination
- Click-tracker paths (`clicks.php`, `/track/`, `/redirect.php`) are refused
