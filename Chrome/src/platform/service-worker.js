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

/* Memoised. Two lookups arriving together both awaited getContexts(), both saw
 * nothing, and both called createDocument — the second rejecting with "Only a
 * single offscreen document may be created". The promise is assigned
 * synchronously so the second caller shares the first one's work. */
let ensuring = null;

function ensureOffscreen() {
  if (ensuring) return ensuring;

  ensuring = (async () => {
    const existing = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
    });
    if (existing && existing.length) return;

    await chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ["DOM_PARSER"],
      justification: "Parse and sanitize fetched HTML so link previews can be rendered safely."
    });
  })().catch((err) => {
    ensuring = null;          // only clear on failure, so success stays memoised
    throw err;
  });

  return ensuring;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return false;
  if (sender && sender.id && sender.id !== chrome.runtime.id) return false;

  /* Cancellation is fire-and-forget: nothing waits for an answer. */
  if (msg.type === "peek:cancel") {
    ensureOffscreen()
      .then(() => chrome.runtime.sendMessage({ type: "peek:offscreen:cancel", id: msg.id }))
      .catch(() => {});
    return false;
  }
  if (msg.type !== "peek:look") return false;

  (async () => {
    try {
      await ensureOffscreen();
      const result = await chrome.runtime.sendMessage({
        type: "peek:offscreen:look",
        url: msg.url,
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
