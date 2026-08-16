/* Peek — onboarding/onboarding.js
 * Shown once, on install. The one screen a new user gets.
 *
 * It exists because nothing else told them two things they need: that Peek
 * waits for a key, and that it makes requests. An extension whose whole
 * selling point is a careful privacy posture cannot leave that to the store
 * listing nobody reads.
 */
(function () {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;

  const LABEL = { alt: "Alt", shift: "Shift", ctrl: "Ctrl", hover: "" };

  api.storage.local.get(["trigger"]).then((stored) => {
    const trigger = (stored && stored.trigger) || "alt";
    const key = document.getElementById("triggerKey");
    if (trigger === "hover") {
      /* Someone who has already chosen ambient mode should not be told to
       * hold a key that does nothing. */
      key.closest("h2").textContent = "Hover any link";
    } else {
      key.textContent = LABEL[trigger] || "Alt";
    }
  }).catch(() => {});

  document.getElementById("settings").addEventListener("click", () => {
    /* openPopup is not available everywhere; the button should still do
     * something useful rather than nothing. */
    if (api.action && api.action.openPopup) {
      api.action.openPopup().catch(() => window.close());
    } else if (api.browserAction && api.browserAction.openPopup) {
      api.browserAction.openPopup().catch(() => window.close());
    } else {
      window.close();
    }
  });
})();
