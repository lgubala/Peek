/* Peek — platform/dom.js  (Firefox)
 *
 * Firefox's MV2 background page is a real document, so DOMParser is available
 * everywhere Peek needs it. Chrome's MV3 service worker has no DOM, which is
 * why that build routes parsing through an offscreen document instead.
 *
 * DOMParser does not execute scripts or load subresources, so parsing hostile
 * HTML here is safe.
 */
(function (P) {
  "use strict";

  P.platform = P.platform || {};

  P.platform.name = "firefox";

  P.platform.parse = function (html) {
    return new DOMParser().parseFromString(String(html || ""), "text/html");
  };
})(self.Peek = self.Peek || {});
