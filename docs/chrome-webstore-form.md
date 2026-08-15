# Chrome Web Store — Privacy tab

Paste-ready answers. Every field is under the 1,000 character limit.

Re-upload the package first: `tabs` has been removed, so that justification
field disappears from the form.

---

## Single purpose description

> Peek shows what is on the other side of a link before you open it.
>
> When you rest the pointer on a link, Peek fetches that page in the background
> and shows a small card containing the destination's own content: a recipe's
> ingredients and steps, an article's text, a product's price and availability,
> a code repository's README. You then decide whether the page is worth
> opening.
>
> That is the extension's only function. It has no other features, no servers,
> no accounts and no analytics.

---

## storage justification

> Stores the user's own settings locally: whether Peek is enabled, whether
> hovering fetches pages, whether images are shown, whether navigation links
> are ignored, the light/dark preference, the hover delay, and the list of
> sites the user has switched Peek off for.
>
> This is a handful of preferences the user sets in the toolbar popup. Nothing
> is transmitted anywhere; the extension has no server to transmit it to.

---

## offscreen justification

> Peek must parse HTML to find the article, price or ingredient list inside a
> fetched page, and MV3 service workers have no DOM, so `DOMParser` is
> unavailable there.
>
> The extension creates one offscreen document with the `DOM_PARSER` reason,
> which parses and sanitizes the fetched HTML and returns a plain node tree to
> be rendered. The document is invisible, has no user interaction, and is the
> only place where fetched HTML is handled. No page content is ever executed —
> scripts, iframes, event handlers and javascript: URLs are stripped before
> anything reaches the page the user is on.

---

## Host permission justification

> The card appears wherever the user hovers a link, so the content script must
> run on any site the user visits. The background then requests the linked page
> in order to read what is on it. Neither can be limited to a fixed list of
> sites, because the extension cannot know in advance which pages the user will
> browse or which links they will consider opening.
>
> There is no server involved: the page is fetched, parsed and displayed
> entirely within the browser, and nothing is sent to the developer or to any
> third party.
>
> Requests use `credentials: "omit"` and `referrerPolicy: "no-referrer"`, so no
> cookies are sent or stored and no referrer is passed. The destination's
> JavaScript never runs. Links that perform actions — log out, unsubscribe,
> confirm, pay, or carry one-time tokens — are refused outright, as is webmail.
>
> The user can switch fetching off entirely in the popup, and can switch the
> extension off per site.

---

## Are you using remote code?

**No, I am not using remote code.**

Everything the extension executes ships inside the package. There are no
external `<script>` tags, no remotely hosted modules, no `eval()`, and no
Wasm. The one bundled library, Mozilla Readability 0.6.0 (Apache-2.0), is in
`vendor/readability.js` unmodified — see `THIRD-PARTY.md` for its SHA-256 and
how to reproduce it from npm.

Peek does fetch HTML from the sites the user hovers, but that HTML is **parsed
and sanitized, never executed**. Scripts are stripped and discarded. Fetched
markup is data, not code.

---

## Data usage — the declarations further down the form

Tick **only**:

- [x] *I do not sell or transfer user data to third parties, outside of the approved use cases*
- [x] *I do not use or transfer user data for purposes that are unrelated to my item's single purpose*
- [x] *I do not use or transfer user data to determine creditworthiness or for lending purposes*

For the data-type checkboxes above them, tick **nothing**. Peek collects none
of the listed categories. It reads the page a user chooses to hover in order to
display it back to that same user, and nothing leaves the browser.

Privacy policy URL: point this at the raw `PRIVACY.md` in the repository, e.g.
`https://github.com/lgubala/Peek/blob/main/PRIVACY.md`

---

## What a reviewer will probably ask

`<all_urls>` on an extension that makes outbound requests is the slowest part
of this review. `REVIEWER-NOTES.md` in the repository answers it directly, and
it is worth pasting the "Permissions" and "Data collection" sections of that
file into the **Test instructions** field along with:

> To see the extension work: open a search results page, rest the pointer on a
> result for about a third of a second, and a card appears with that page's
> content. The toolbar popup contains every setting, including a switch that
> stops all network requests.
