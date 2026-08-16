/* Peek — background/gate.js
 * The rules that decide whether a URL may be fetched at all.
 *
 * Hover-fetching is only safe because of this file. Some links DO things
 * rather than SHOW things, and a previewer that ignores that will log people
 * out and spend one-time tokens.
 *
 * Rules live in config/rules.js. This module only applies them.
 */
(function (P) {
  "use strict";

  /* Whole labels for the ambiguous words, substrings only for names that
   * cannot mean anything else. Otherwise xxxlutz.de, a furniture chain, is
   * refused as pornography. */
  function notFetchedCategory(hostname) {
    if (P.config.NOT_FETCHED_SUBSTRINGS.test(hostname)) return true;
    return String(hostname).toLowerCase().split(/[.-]/)
      .some((label) => P.config.NOT_FETCHED_LABELS.has(label));
  }

  /* An action is a route. Matching a verb anywhere in the path refuses
   * ordinary headlines like /how-to-cancel-a-gym-membership. */
  function looksLikeAction(pathname) {
    if (P.config.ACTION_PATH.test(pathname)) return true;
    if (P.config.ACTION_ROUTES.some((re) => re.test(pathname))) return true;

    const segments = String(pathname).toLowerCase().split("/").filter(Boolean);
    return segments.some((seg) => P.config.ACTION_SEGMENTS.indexOf(seg) !== -1);
  }

  function check(rawUrl) {
    let u;
    try { u = new URL(rawUrl); }
    catch (_) { return { ok: false, reason: "Not a valid address." }; }

    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, reason: "Only http and https can be fetched." };
    }
    if (u.username || u.password) {
      return { ok: false, reason: "Address carries embedded credentials." };
    }
    if (P.policy.forHost(u.hostname) === "disabled") {
      return { ok: false, reason: "Peek is switched off for this site." };
    }
    if (notFetchedCategory(u.hostname)) {
      return { ok: false, reason: "Peek will not fetch this category of site." };
    }
    if (looksLikeAction(u.pathname)) {
      return { ok: false, reason: "This link looks like it performs an action, not a page. Peek will not trigger it." };
    }
    for (const [k] of P.url.parseQuery(u.search)) {
      if (P.config.ACTION_PARAM.test(k)) {
        return { ok: false, reason: "Address carries a token or one-time parameter. Peek will not spend it." };
      }
    }
    return { ok: true, url: u.href };
  }

  P.gate = { check, looksLikeAction, notFetchedCategory };
})(self.Peek = self.Peek || {});
