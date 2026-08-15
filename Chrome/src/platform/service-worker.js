/* Peek — platform/service-worker.js  (Chrome)
 *
 * MV3 service workers have no DOM, and Peek cannot parse HTML without one.
 * So the worker does nothing but lifecycle and routing: it keeps a single
 * offscreen document alive and forwards lookups to it.
 *
 * The real pipeline lives in src/offscreen/offscreen.js, and is byte-for-byte
 * the same code Firefox runs in its background page.
 */

const OFFSCREEN_PATH = "src/offscreen/offscreen.html";
let creating = null;

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });
  if (existing && existing.length) return;

  if (creating) { await creating; return; }

  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["DOM_PARSER"],
    justification: "Parse and sanitize fetched HTML so link previews can be rendered safely."
  });
  try { await creating; } finally { creating = null; }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "peek:look") return false;

  (async () => {
    try {
      await ensureOffscreen();
      const result = await chrome.runtime.sendMessage({
        type: "peek:offscreen:look",
        url: msg.url,
        watchlist: msg.watchlist || [],
        images: !!msg.images
      });
      sendResponse(result || { ok: false, reason: "No answer from the offscreen document." });
    } catch (e) {
      console.warn("[peek] worker routing failed", e);
      sendResponse({ ok: false, reason: String((e && e.message) || e) });
    }
  })();

  return true;  // response is async
});

console.log("%c[peek]", "color:#7FD8C4", "service worker ready — no requests until asked");
