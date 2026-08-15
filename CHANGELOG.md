# Changelog

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
