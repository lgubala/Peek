/* Peek — common/policy.js
 * What Peek is allowed to do on a given host.
 *
 * Three sources, combined:
 *   config/sites.js  DISABLED_HOSTS   shipped defaults
 *   config/sites.js  NO_FETCH_HOSTS   shipped defaults
 *   storage          userDisabled     hosts the user switched off themselves
 *
 * Both the content script and the background load this, so a site the user
 * blocks stops being fetched as well as stopping being shown.
 */
(function (P) {
  "use strict";

  const user = { disabled: [] };

  /* Stored as exact hostnames without "www.", so "sme.sk" covers www.sme.sk
   * but not index.sme.sk. Subdomains are separate sites and often differ. */
  const normalise = (h) => String(h || "").toLowerCase().replace(/^www\./, "").trim();

  function isUserDisabled(host) {
    const h = normalise(host);
    if (!h) return false;
    return user.disabled.indexOf(h) !== -1;
  }

  /* "disabled" | "nofetch" | "normal" */
  function forHost(host) {
    const h = normalise(host);
    if (!h) return "normal";
    if (isUserDisabled(h) || P.sites.isDisabled(h)) return "disabled";
    if (P.sites.isNoFetch(h)) return "nofetch";
    return "normal";
  }

  function apply(values) {
    user.disabled = Array.isArray(values && values.userDisabled)
      ? values.userDisabled.map(normalise).filter(Boolean)
      : [];
  }

  /* Read once, then follow changes made in the popup. */
  function load(api) {
    if (!api || !api.storage) return Promise.resolve(user);
    try {
      const p = api.storage.local.get(["userDisabled"]);
      const done = (p && p.then) ? p : Promise.resolve({});
      if (api.storage.onChanged) {
        api.storage.onChanged.addListener((changes, area) => {
          if (area === "local" && changes.userDisabled) {
            apply({ userDisabled: changes.userDisabled.newValue });
          }
        });
      }
      return done.then((stored) => { apply(stored || {}); return user; }).catch(() => user);
    } catch (_) { return Promise.resolve(user); }
  }

  P.policy = { user, forHost, isUserDisabled, apply, load, normalise };
})(self.Peek = self.Peek || {});
