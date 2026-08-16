/* Peek — platform/dom.js  (Chrome)
 *
 * Loaded in the offscreen document, which is a real page and therefore has
 * DOMParser. The MV3 service worker has no DOM at all, so every module that
 * needs to parse HTML runs there rather than in the worker.
 *
 * DOMParser does not execute scripts or load subresources, so parsing hostile
 * HTML here is safe.
 */
(function (P) {
  "use strict";

  P.platform = P.platform || {};

  P.platform.name = "chrome";

  P.platform.parse = function (html) {
    return new DOMParser().parseFromString(String(html || ""), "text/html");
  };
})(self.Peek = self.Peek || {});
