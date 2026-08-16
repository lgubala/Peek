/* Peek — background/index.js
 * Entry point. Routes messages from content scripts to the pipeline.
 */
(function (P) {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;

  /* Hosts the user switched off must not be fetched either. */
  P.policy.load(api);

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== "peek:look") return false;
    /* Not exploitable today — there is no externally_connectable — but a
     * message handler that does not check its sender is one line from being a
     * problem the day one is added. */
    if (sender && sender.id && sender.id !== api.runtime.id) return false;

    P.pipeline.look(msg.url, {
      images: !!msg.images
    })
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, reason: String((e && e.message) || e) }));

    return true;  // response is async
  });

  P.log.info("background ready \u2014 no requests until asked");
})(self.Peek = self.Peek || {});
