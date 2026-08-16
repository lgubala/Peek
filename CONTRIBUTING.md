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
| Add a tracking parameter or a shortener | `src/config/rules.js` |
| Stop Peek working on a site | `src/config/sites.js` → `DISABLED_HOSTS` |
| Fix a site where the wrong element is extracted | `src/config/sites.js` → `CONTENT_SELECTORS` |
| Warn about a paywall | `src/config/sites.js` → `SITE_NOTES` |
| Read a new kind of structured data | `src/extract/types.js` |
| Recognise a new URL shape with no request | `src/link/recognizers.js` |
| Handle a site whose content is not in its HTML | `src/sites/` — see the README there |

## Keeping the two builds in step

Everything except `manifest.json`, `src/platform/` and `src/offscreen/` is
identical in both folders. When you change a shared file, copy it across:

```sh
rsync -a --exclude 'platform' --exclude 'offscreen' Firefox/src/ Chrome/src/
```

Adding a *new* shared file also means adding it to the script list in **both**
manifests. If the engine needs it, do **not** hand-edit
`Chrome/src/offscreen/offscreen.html` — generate it:

```sh
python3 docs/sync-offscreen.py           # rewrite offscreen.html, report drift
python3 docs/sync-offscreen.py --check   # report only, exit 1 on drift
```

Chrome's offscreen document lists the engine in HTML rather than in the
manifest, so it drifts silently from the Firefox background scripts. When it
does, the missing module fails **only in Chrome and only at runtime** — every
link stops working with something like `P.policy.forHost is not a function`,
and nothing catches it before a user does. Run `--check` before you tag a
release.

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

## Style

Plain ES2020, no transpiling. Comments explain *why*, not *what*. If a rule
exists because a real site broke, name the site — that is the most useful
comment in the file.
