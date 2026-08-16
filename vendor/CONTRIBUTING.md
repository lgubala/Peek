# Contributing

No build step, no dependencies. Edit a file, reload the extension, hover a link.

## Running it

**Firefox** — `about:debugging#/runtime/this-firefox` → Load Temporary Add-on →
pick `Firefox/manifest.json`.

**Chrome** — `chrome://extensions` → Developer mode → Load unpacked →
pick the `Chrome/` folder.

Both unload when the browser closes.

## Where to make a change

Ninety per cent of changes belong in one of two files.

| You want to | Edit |
|---|---|
| Change timing, caps, thresholds | `src/config/rules.js` |
| Add a junk phrase the reader should strip | `src/config/rules.js` → `JUNK_TEXT` |
| Add a tracking parameter | `src/config/trackers.js` — prefer a family rule over a name |
| Add a shortener | `src/config/rules.js` |
| Stop Peek working on a site | `src/config/sites.js` → `DISABLED_HOSTS` |
| Fix a site where the wrong element is extracted | `src/config/sites.js` → `CONTENT_SELECTORS` |
| Warn about a paywall | `src/config/sites.js` → `SITE_NOTES` |
| Read a new kind of structured data | `src/extract/types.js` |
| Recognise a new URL shape with no request | `src/link/recognizers.js` |
| Handle a site whose content is not in its HTML | `src/sites/` — see the README there |

## The build

There is one source tree. `Chrome/` and `Firefox/` are **generated** — never
edit them.

```sh
npm run build     # regenerate both
npm run check     # verify the committed builds match the source
npm run verify    # syntax + check + tests, the same as CI
```

`build.py` copies `src/`, overlays `platform/<browser>/`, and generates both
manifests and Chrome's `offscreen.html` from `build/modules.json`.

### Adding a module

Put the file in `src/`, then add it to `build/modules.json` — to `content`,
`engine`, or both — and run `npm run build`. That is the whole procedure.

The load order lives in one file for a reason. It used to live in three:
Firefox's manifest, Chrome's manifest, and Chrome's `offscreen.html`. Twice a
module was added to some and not others, and both times the result was the same
— every link failing, **only in Chrome, only at runtime**, with
`P.policy.forHost is not a function`. Neither was caught before a user found
it. `tests/cases/build-integrity.js` now asserts the three agree.

The builds are committed so they can be uploaded to the stores without a build
step, and `npm run check` in CI proves they are what the source says.

## What CI checks

Peek ships through the two stores, so CI produces no artifact — there is
nobody to hand a build to, and the handful of people who install from source
can clone the repo and load `Firefox/` or `Chrome/` as they are.

It answers four questions instead, each one earned by a bug that reached a
user:

| Step | Because |
|---|---|
| `npm run syntax` | A file that does not parse takes the whole extension down |
| `npm run check` | `Chrome/` and `Firefox/` are generated *and committed*. A stale one means uploading code that does not match `src/` |
| `npm test` | Twice a module was wired into one browser and not the other, failing only at runtime, only in Chrome |
| `web-ext lint` | Manifest and API problems, found here rather than three days into an AMO queue |

`npm run verify` runs the first three locally.

## Tests

```sh
npm test                    # everything
node tests/run.js gate      # one suite
node tests/run.js -v        # verbose
```

Cases live in `tests/cases/`, one file per area, exporting named functions.
They run against `src/` and `platform/`, using the module order from
`build/modules.json`, so a green suite says the *source* is right rather than
that the last build was.

Two habits worth keeping:

**Test the layer you mean to test.** The sanitizer test originally asserted
against the finished node tree, and passed even with the sanitizer bug
deliberately reintroduced — because `serialize.js` independently drops unknown
tags. Defence in depth is good; a test that cannot tell which layer is doing
the work is not.

**Test the quiet direction too.** Half of Peek's rules are about *not* firing.
Every list of things that must be flagged has a matching list of ordinary pages
that must stay silent, because a false positive is the failure that makes
people ignore the true ones.

## Two constraints that are easy to trip over

**Firefox content scripts are not a normal page.** They see the page through
Xray wrappers, which do not expose `Symbol.iterator` on WebIDL iterators. So
this works everywhere except where it matters:

```js
[...url.searchParams.entries()]   // TypeError: is not iterable
```

Use `Peek.url.parseQuery(url.search)` instead. Nothing in `src/` may iterate
`searchParams`.

**The sanitizer is a security boundary.** Whatever leaves
`src/reader/sanitize.js` is inserted into the card with `innerHTML`. Adding a
tag to `ALLOWED_TAGS` or an attribute to `ALLOWED_ATTRS` means asserting it
cannot execute anything. Think twice before adding `style`, `svg` or any `on*`
attribute — the answer is no.

## Exports that look unused

Most modules export more than the rest of the code calls: `P.images.widthHint`,
`P.signals.claimedBrand`, `P.trackers.EXACT` and so on. That is deliberate.
Each is the smallest thing you can call to check one decision in isolation,
either from `__peek` in the console or from a test harness. A grep for "who
calls this" will say nobody; the answer is "whoever is debugging it".

If you remove one, remove the reason it existed too.

## Style

Plain ES2020, no transpiling. Comments explain *why*, not *what*. If a rule
exists because a real site broke, name the site — that is the most useful
comment in the file.
