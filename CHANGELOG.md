# Changelog

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
