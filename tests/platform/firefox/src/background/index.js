/* Peek — background/index.js
 * Entry point. Routes messages from content scripts to the pipeline.
 */
(function (P) {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;

  /* Hosts the user switched off must not be fetched either. */
  P.policy.load(api);

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return false;
    if (sender && sender.id && sender.id !== api.runtime.id) return false;

    /* The pointer moved on. Stop asking the site. */
    if (msg.type === "peek:cancel") {
      P.pipeline.cancel(msg.id);
      return false;
    }
    if (msg.type !== "peek:look") return false;
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


  /* Shown once, on install. Not on update: an existing user does not need to be
   * told again, and reopening a tab under them on every release is rude. */
  api.runtime.onInstalled.addListener((details) => {
    if (details.reason !== "install") return;
    api.tabs.create({ url: api.runtime.getURL("src/onboarding/onboarding.html") })
      .catch(() => {});
  });

  P.log.info("background ready \u2014 no requests until asked");
})(self.Peek = self.Peek || {});
