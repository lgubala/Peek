/* Peek — common/log.js
 * One switch for all diagnostics. Set DEBUG to false to silence the extension.
 */
(function (P) {
  "use strict";

  /* Quiet under the test runner, which sets PEEK_SILENT — the suite's own
   * output is the signal, and 200 lines of "[peek] loaded on…" is not. */
  const DEBUG = !(typeof process !== "undefined" && process.env && process.env.PEEK_SILENT);

  P.log = {
    debug: DEBUG,              // readable from the console when diagnosing
    info: (...a) => DEBUG && console.log("%c[peek]", "color:#7FD8C4", ...a),
    warn: (...a) => console.warn("[peek]", ...a),
    error: (...a) => console.error("[peek]", ...a)
  };
})(self.Peek = self.Peek || {});
