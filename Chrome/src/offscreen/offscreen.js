/* Peek — offscreen/offscreen.js  (Chrome)
 *
 * Chrome's counterpart to Firefox's background/index.js. Everything above it
 * in the load order is identical across both browsers.
 */
(function (P) {
  "use strict";

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "peek:offscreen:look") return false;

    P.pipeline.look(msg.url, {
      images: !!msg.images
    })
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, reason: String((e && e.message) || e) }));

    return true;  // response is async
  });

  P.log.info("offscreen document ready");
})(self.Peek = self.Peek || {});
