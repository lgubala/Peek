/* Peek — common/log.js
 * One switch for all diagnostics. Set DEBUG to false to silence the extension.
 */
(function (P) {
  "use strict";

  const DEBUG = true;

  P.log = {
    debug: DEBUG,              // readable from the console when diagnosing
    info: (...a) => DEBUG && console.log("%c[peek]", "color:#7FD8C4", ...a),
    warn: (...a) => console.warn("[peek]", ...a),
    error: (...a) => console.error("[peek]", ...a)
  };
})(self.Peek = self.Peek || {});
