# Site handlers

Four ways to teach Peek about a site. Reach for the last one only when the
first three cannot work, because a handler is code you have to maintain.

| | Where | Use when |
|---|---|---|
| 1 | `config/sites.js` → `DISABLED_HOSTS` | A preview adds nothing, or fetching would be rude |
| 2 | `config/sites.js` → `CONTENT_SELECTORS` | The content is in the HTML, Readability just picks the wrong element |
| 3 | `config/sites.js` → `SITE_NOTES` | You only want to warn about a paywall or login wall |
| 4 | `src/sites/*.js` | The content is **not in the HTML at all** |

## The easy way: a data entry

If the site has a public API that answers the question, it does not need code.
Add an entry to `declared.js`:

```js
D({
  name: "wikipedia",
  match: /^https?:\/\/([a-z-]{2,12})\.wikipedia\.org\/wiki\/([^?#]+)/i,
  api: (m) => `https://${m[1]}.wikipedia.org/api/rest_v1/page/summary/${m[2]}`,
  map: (j) => ({
    kind: "Encyclopedia",
    heading: j.title,
    description: j.extract,
    image: j.thumbnail?.source,
    metrics: [j.description]
  })
});
```

- `match` decides which URLs are yours; its captures are passed to the rest.
- `api` returns the endpoint. Keyless public endpoints only — Peek ships no
  credentials and asks for none.
- `map` returns what the card shows. Return `null` and Peek falls through to
  the ordinary fetch, which is what you want when the API answers with nothing
  useful.
- `article` is optional: return an HTML string and it is cleaned like any other
  content.

That covers most sites. Reach for a code handler only when it does not.

## Writing a code handler

A handler is an object with `name`, `match(url)` and `run(url, opts, ctx)`.
`run` returns a result, or `null` to fall through to the normal fetch.

```js
(function (P) {
  "use strict";

  P.siteHandlers.register({
    name: "example",

    // Return truthy when this handler owns the URL.
    match(url) {
      return /(^|\.)example\.com$/.test(P.url.hostOf(url));
    },

    // ctx.fetchText(url, opts)  capped, credential-free fetch
    // ctx.clean(html, opts)     sanitize + tidy, returns an article object
    async run(url, opts, ctx) {
      const res = await ctx.fetchText("https://api.example.com/thing");
      if (!res) return null;

      return {
        ok: true,
        status: res.status,
        finalUrl: url,
        handler: "example",
        summary: {
          kind: "Thing",
          heading: "...",
          description: "...",
          image: "",
          metrics: ["one", "two"],
          flags: [], ingredients: null, steps: null,
          source: ["example API"]
        },
        article: ctx.clean(res.text, { images: opts.images, maxImages: 1 })
      };
    }
  });
})(self.Peek = self.Peek || {});
```

Then add the file to `js`/`scripts` in **both** `Chrome/manifest.json` and
`Firefox/manifest.json`, before `src/background/index.js`.

Handlers run in registration order, before the generic fetch. Every URL still
passes the safety gate first — a handler cannot fetch something the gate
refuses.

## Existing handlers

- **`github.js`** — GitHub's rewritten repo page loads the README *after* it
  renders, so the HTML we fetch does not contain it. The public API does.
