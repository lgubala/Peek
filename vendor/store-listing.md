# Store listing copy

## Name
Peek

## Summary (132 chars max)
Hover a link and see what is actually on the other side — the recipe, the
article, the price — without opening the page.

## Description

You are looking at a page of search results. Ten links, and no way to tell
which one is worth your time except by opening all of them.

Peek puts a window in the door. Rest on a link and a card shows what is
actually on the other side: a recipe's ingredients and steps, an article's
text, a product's price and stock, a repository's README. Then you decide
whether to open it.

WHAT YOU GET
• Recipes — ingredients and numbered steps, before you open a single tab
• Articles — the actual text, without the ads, cookie banners or newsletter box
• Products — price, availability, rating
• Warnings about deceptive links: an @ before the domain, punycode lookalikes,
  link text that claims one site and points at another

WHO YOU ARE ACTUALLY TALKING TO
The domain is the biggest thing on the card, with the country its registry
belongs to right beside it. A tracker at ipro3.dmesp.ru is much easier to think
about once it says RU Russia. Redirects show the hop they went through.

WHAT IT DOES NOT DO
Peek never renders the other site's page. It reads the HTML and rebuilds a
clean card from it, so the site's JavaScript never runs — no analytics, no ad
pixels, no session recorders. No cookies are sent or stored, no referrer is
passed, and nothing enters your browsing history.

Peek reduces what a page can do to you, but it is not antivirus and does not
claim to be: it still parses untrusted HTML, and unless you switch images off
it still loads images from the origin.

Links that log out, unsubscribe, confirm, pay or carry one-time tokens are
never fetched.

PLEASE NOTE
Peek makes network requests to sites you have not clicked on. Those sites see a
request from your IP address and can log it. This is on by default and can be
switched off in the toolbar popup, after which Peek makes no requests at all.

Open source, MIT licensed: https://github.com/lgubala/Peek

## Category
Privacy & Security / Browsing

## Permissions justification

**Access your data for all websites** — Peek shows its card on any page where
you hover a link, and fetches the destination to fill it. It has no server; all
processing happens in your browser.

**Storage** — your settings, stored locally.

**Offscreen (Chrome only)** — MV3 service workers cannot parse HTML. Peek uses
an invisible document to do that safely.
