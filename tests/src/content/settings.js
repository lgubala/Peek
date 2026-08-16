/* Peek — content/settings.js
 * Live settings, synced from the toolbar popup without a reload.
 */
(function (P) {
  "use strict";

  const api = (typeof browser !== "undefined" && browser.storage) ? browser
            : (typeof chrome !== "undefined" && chrome.storage) ? chrome : null;

  const values = Object.assign({}, P.config.DEFAULTS);

  function set(key, value) {
    values[key] = value;
    /* Throws once the extension has been reloaded underneath this page. The
     * in-memory value still updates, so the tab keeps behaving sensibly until
     * it is reloaded. */
    if (api) { try { api.storage.local.set({ [key]: value }); } catch (_) { /* orphaned */ } }
    return values;
  }

  function load() {
    if (!api) return Promise.resolve(values);
    try {
      const p = api.storage.local.get(Object.keys(values));
      if (!p || !p.then) return Promise.resolve(values);
      return p.then((stored) => {
        if (stored) {
          for (const k of Object.keys(values)) {
            if (stored[k] !== undefined) values[k] = stored[k];
          }
        }
        /* images was a boolean before 1.15. Anyone upgrading has true or
         * false stored; map it rather than silently resetting their choice. */
        if (typeof values.images === "boolean") values.images = values.images ? "any" : "off";
        return values;
      }).catch(() => values);
    } catch (_) { return Promise.resolve(values); }
  }

  function watch(onChange) {
    if (!api || !api.storage.onChanged) return;
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      for (const k of Object.keys(changes)) {
        if (k in values) values[k] = changes[k].newValue;
      }
      P.log.info("settings updated");
      if (onChange) onChange(values);
    });
  }

  P.settings = { values, set, load, watch };
})(self.Peek = self.Peek || {});
