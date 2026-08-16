/* Peek — background/inflight.js
 * The lookups currently running, so they can be called off.
 *
 * Hovering is a stream of intentions, most of them abandoned. Moving the
 * pointer down a page of results used to leave every fetch running to
 * completion: the response was discarded, but the request had already been
 * made, so ten sites were told you looked when you only looked at one. For an
 * extension whose whole disclosure is "the site sees a request from your IP",
 * that is the wrong default.
 *
 * A cancelled lookup aborts the fetch. Whether the server notices depends on
 * how much it had already sent, but Peek stops asking.
 */
(function (P) {
  "use strict";

  const running = new Map();   // id -> { controller, started }

  function open(id) {
    cancel(id);                // an id is reused when a hover is retried
    const controller = new AbortController();
    running.set(id, { controller, started: Date.now() });
    return controller.signal;
  }

  function close(id) {
    running.delete(id);
  }

  function cancel(id) {
    const entry = running.get(id);
    if (!entry) return false;
    running.delete(id);
    try { entry.controller.abort(); } catch (_) { /* already gone */ }
    return true;
  }

  /* Oldest first, so "make room for this one" drops the most abandoned. */
  function cancelOldest() {
    let oldestId = null, oldest = Infinity;
    for (const [id, entry] of running) {
      if (entry.started < oldest) { oldest = entry.started; oldestId = id; }
    }
    return oldestId === null ? false : cancel(oldestId);
  }

  function cancelAll() {
    for (const id of Array.from(running.keys())) cancel(id);
  }

  /* Links an external signal to a timeout, and hands back both the combined
   * signal and the cleanup. Neither AbortSignal.any nor AbortSignal.timeout is
   * old enough to rely on across the browsers Peek supports. */
  function withTimeout(external, ms) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);

    let relay = null;
    if (external) {
      if (external.aborted) ctrl.abort();
      else {
        relay = () => ctrl.abort();
        external.addEventListener("abort", relay);
      }
    }

    return {
      signal: ctrl.signal,
      done() {
        clearTimeout(timer);
        if (relay && external) external.removeEventListener("abort", relay);
      }
    };
  }

  const aborted = (err) =>
    !!err && (err.name === "AbortError" || /abort/i.test(String(err.message || "")));

  P.inflight = {
    open, close, cancel, cancelOldest, cancelAll, withTimeout, aborted,
    get count() { return running.size; }
  };
})(self.Peek = self.Peek || {});
