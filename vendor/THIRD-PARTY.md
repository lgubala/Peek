# Third-party code

Peek bundles one external library. It is vendored rather than fetched at
runtime, because both add-on stores forbid loading remote code.

## Mozilla Readability

- **Files:** `Firefox/vendor/readability.js`, `Chrome/vendor/readability.js`
- **Version:** 0.6.0
- **Licence:** Apache-2.0
- **Source:** https://github.com/mozilla/readability

The same extraction that powers Firefox Reader Mode. Peek uses it to find the
article inside a fetched page when `config/sites.js` has no selector for that
site. Its output is never rendered directly: everything passes through
`src/reader/sanitize.js` first.

Updating it is a straight file swap — Peek only calls `new Readability(doc, opts).parse()`.

Nothing else is bundled. Peek has no build step, no package manager, and no
runtime dependencies.
