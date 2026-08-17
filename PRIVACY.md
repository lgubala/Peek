# Privacy

Short version: Peek fetches pages you hover over. That is the whole privacy
story, and it is on by default. Everything else about Peek is designed so that
this one fact stays as small as possible.

## What leaves your machine

**Requests to sites you have not clicked on.** Holding the trigger key and
resting on a link asks that site for its page. Nothing is requested for a link
you merely moved the pointer across. The site sees a request
from your IP address and can log it, exactly as it would log a visit.

That is the only thing. Peek has no servers, no accounts, and no analytics.
Nothing is sent to the author or to anyone else.

## What those requests do not do

- **No cookies.** Requests use `credentials: "omit"`, so none of your cookies
  are sent, and nothing the site tries to set is stored. The site sees you
  logged out, always.
- **No referrer.** `referrerPolicy: "no-referrer"`, so the site never learns
  which page you were on.
- **No JavaScript.** The page is parsed, never executed. Analytics, ad pixels
  and session recorders do not fire. A peek is quieter than an actual visit.
- **No history.** A fetch is not a navigation. Nothing enters your browsing
  history or your back button.
- **No disk.** Responses are held in memory for five minutes, then dropped by a sweep that runs every minute.
- **Abandoned requests are aborted.** Move the pointer on and Peek stops asking. Whether the server notices depends on how much it had already sent, but Peek does not keep pulling a page you have walked away from.

## What is never fetched

`src/background/gate.js` refuses, before any request is made:

- Links that look like actions rather than pages: logout, unsubscribe, delete,
  cancel, confirm, activate, reset-password, checkout, add-to-cart,
  accept-invite, vote, and click-tracker paths
- Any URL carrying a one-time credential: `token`, `code`, `otp`, `signature`,
  `session`, `access_token` and similar
- Addresses with embedded credentials, and non-http schemes
- A bundled list of adult and high-risk hosts
- Hosts listed in `DISABLED_HOSTS` in `config/sites.js`, which includes
  webmail, because hovering a link in your inbox would register the click with
  whoever sent it

## What is stored

Your settings, in `storage.local`: whether Peek is enabled, whether hovering
fetches, whether images load, whether navigation links are ignored, the
light/dark preference, the hover delay, and the list of sites you have switched
Peek off for. They stay on your machine and are never transmitted.

## Turning the requests off

Toolbar button → **Read pages on hover** → off. Peek then makes no network
requests at all and falls back to what it can read from the link itself. Press
`L` to fetch a single page deliberately.

## Kept pages

Pages you press **Keep** on are stored in `storage.local` — the analysis and the
content Peek had already fetched, so opening one later makes no new request.
They stay on this machine, are never synced or transmitted, and are capped at 50
pages and 2 MB with the oldest dropped first. The panel shows how many there
are and can remove them individually or all at once.

## Images

Three settings, in the popup:

- **Off** — no image is requested at all.
- **Same site** — pictures from the site you are peeking, not the ones it
  embeds from ad networks and CDNs.
- **Any** — every image the page uses.

This is also the one meaningful security setting. With images on, your browser
decodes image data from a server you have not chosen to visit, and image
decoders have had real zero-click vulnerabilities (libwebp CVE-2023-4863,
exploited in the wild in 2023). Peek not running the page's JavaScript removes
the largest attack surface; images off removes most of what is left.

## What Peek is not

Peek is not an antivirus, a sandbox, or protection against malware. It reduces
exposure — no scripts, no cookies, no navigation — but it still parses untrusted
HTML and, unless you turn images off, still decodes untrusted images. Treat it
as "a much quieter way to look", not as a safe room.
