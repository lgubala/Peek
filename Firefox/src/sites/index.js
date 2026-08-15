/* Peek — sites/index.js
 * Registry for site handlers. See README.md in this folder.
 */
(function (P) {
  "use strict";

  const handlers = [];

  function register(handler) {
    if (!handler || typeof handler.run !== "function" || typeof handler.match !== "function") {
      P.log.warn("ignoring malformed site handler", handler && handler.name);
      return;
    }
    handlers.push(handler);
  }

  /* Returns a result from the first handler that claims the URL and succeeds,
   * or null so the caller falls through to the generic fetch. */
  async function run(url, opts, ctx) {
    for (const h of handlers) {
      let owns = false;
      try { owns = !!h.match(url); } catch (_) { owns = false; }
      if (!owns) continue;
      try {
        const result = await h.run(url, opts, ctx);
        if (result) { P.log.info("handler", h.name); return result; }
      } catch (e) {
        P.log.warn("handler failed:", h.name, e && e.message);
      }
    }
    return null;
  }

  P.siteHandlers = { register, run, list: handlers };
})(self.Peek = self.Peek || {});
