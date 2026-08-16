# Notes for reviewers

Peek has no build step, no minification and no bundler. Every file in the
package is the file that was written. Nothing is fetched at runtime.

## The linter's `innerHTML` warnings

`web-ext lint` reports four unsafe assignments to `innerHTML`. Peek's own code
now contains **none**; all four come from the bundled Mozilla Readability
library. Here is the full picture.

### Peek's own code: no `innerHTML` anywhere

Earlier versions assigned sanitized HTML to `innerHTML` in `content/card.js`.
That is gone. Nothing crosses the message boundary as markup any more.

The background sanitizes the fetched page against a tag and attribute
allowlist (`src/reader/sanitize.js`), then serialises the result to a plain
node tree (`src/reader/serialize.js`):

```js
"some words"                                  // a text node
{ t: "p", a: { href: "…" }, c: [ … ] }        // an element
```

The content script rebuilds it with `createElement`, `setAttribute` and
`textContent` (`src/content/build.js`), re-checking every tag and attribute
against the same allowlist. No HTML parser runs in the page context, and a
tampered message cannot introduce a tag or attribute that is not on the list.

You can verify this holds with:

```sh
grep -rn "innerHTML" Firefox/src Chrome/src
```

The only matches are comments explaining why it is not used.

### Mozilla Readability: two warnings, unmodified upstream

- `vendor/readability.js` line 1549
- `vendor/readability.js` line 1928

This is **Mozilla's own Readability, version 0.6.0, Apache-2.0**, bundled byte
for byte from https://github.com/mozilla/readability — the same library that
powers Firefox Reader Mode.

Both assignments operate on a document created by `DOMParser`, which is never
attached to any window and whose scripts never execute. That document is
discarded once the article has been extracted.

Readability runs in the background page (Firefox) or the offscreen document
(Chrome), never in a content script, so nothing it does touches a page the
user is viewing.

We have deliberately **not** patched the library, so that its hash can be
checked against upstream:

```
SHA256  34dcab3d0832d0019f02990eed6b6124e029e8c32b9f0c6f2550544ff8dff174
```

Reproduce with:

```sh
npm pack @mozilla/readability@0.6.0
tar xzf mozilla-readability-0.6.0.tgz
sha256sum package/Readability.js
```

## Data collection

`browser_specific_settings.gecko.data_collection_permissions.required` is
`["none"]`.

Peek transmits nothing to the developer or to any third party. It has no
servers, no analytics and no accounts. Settings live in `storage.local` and never leave the machine.

Peek **does** make requests to the sites the user hovers over, in order to read
the page and show what is on it. That is the extension's whole function and it
is disclosed in the popup, in the store listing and in `PRIVACY.md`. Those
requests use `credentials: "omit"` and `referrerPolicy: "no-referrer"`, so no
cookies are sent or stored and no referrer is passed; the destination's
JavaScript never runs. No user data is collected or transmitted for storage or
processing outside the extension, which is what this manifest key describes.

The user can switch fetching off entirely in the popup, after which Peek makes
no network requests at all.

## Permissions

| Permission | Why |
|---|---|
| `<all_urls>` | The card appears wherever the user hovers a link, and the background fetches the destination to fill it. There is no server; everything happens in the browser. |
| `storage` | Settings, locally. |
| *(first run)* | On install only, Peek opens one page explaining what it does and that it fetches pages. Not shown on update. |
| *(no `tabs`)* | The popup reads the active tab's hostname for the per-site off switch. That works from the host permission alone, so `tabs` is deliberately not requested. |
| `offscreen` (Chrome only) | MV3 service workers have no DOM and Peek cannot parse HTML without one. |

## Layout

`Chrome/` and `Firefox/` are complete, independent copies. Everything except
`manifest.json`, `src/platform/` and `src/offscreen/` is identical between
them; `CONTRIBUTING.md` documents how they are kept in step.
