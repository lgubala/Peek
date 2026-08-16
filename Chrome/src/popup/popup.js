/* Peek — popup/popup.js
 * Reads and writes the same storage keys the content script watches, so every
 * change applies immediately in every open tab, with no reload.
 */
(function () {
  "use strict";

  const api = typeof browser !== "undefined" ? browser : chrome;

  /* Read from config/rules.js, loaded by popup.html, so there is one
   * definition rather than two that promise to stay in step and do not. */
  const DEFAULTS = (self.Peek && self.Peek.config && self.Peek.config.DEFAULTS) || {
    enabled: true, autoPeek: true, images: true, skipNav: true,
    theme: "auto", dwell: 320, userDisabled: []
  };

  const TOGGLES = ["enabled", "autoPeek", "skipNav", "images"];

  const $ = (id) => document.getElementById(id);
  const save = (patch) => api.storage.local.set(patch);
  const normalise = (h) => String(h || "").toLowerCase().replace(/^www\./, "");

  let state = Object.assign({}, DEFAULTS);
  let currentHost = "";

  /* --- current tab ---------------------------------------------------- */

  /* tab.url needs either the "tabs" permission or a host permission matching
   * the tab. Peek has <all_urls>, so "tabs" is not requested — one fewer
   * permission at install. If the URL is withheld anyway, the per-site section
   * simply hides itself. */
  function activeHost() {
    try {
      const q = api.tabs.query({ active: true, currentWindow: true });
      if (!q || !q.then) return Promise.resolve("");
      return q.then((tabs) => {
        const url = tabs && tabs[0] && tabs[0].url;
        if (!url) return "";
        try { return normalise(new URL(url).hostname); } catch (_) { return ""; }
      }).catch(() => "");
    } catch (_) { return Promise.resolve(""); }
  }

  const blocked = (host) =>
    state.userDisabled.some((e) => {
      const n = normalise(e);
      return n && (host === n || host.endsWith("." + n));
    });

  function paintSite() {
    const section = $("siteSection");
    if (!currentHost || /^(moz-extension|chrome|about|chrome-extension)$/.test(currentHost)) {
      section.style.display = "none";
      return;
    }
    $("siteHost").textContent = currentHost;
    $("siteOff").checked = blocked(currentHost);
    paintBlockedList();
  }

  function paintBlockedList() {
    const box = $("blockedList");
    box.textContent = "";
    if (!state.userDisabled.length) return;

    box.appendChild(document.createTextNode("Switched off on: "));
    state.userDisabled.forEach((host, i) => {
      if (i) box.appendChild(document.createTextNode(", "));
      const a = document.createElement("a");
      a.textContent = host;
      a.title = "Turn Peek back on for " + host;
      a.addEventListener("click", () => {
        state.userDisabled = state.userDisabled.filter((h) => h !== host);
        save({ userDisabled: state.userDisabled });
        paintSite();
      });
      box.appendChild(a);
    });
  }

  /* --- theme ----------------------------------------------------------- */

  function paintTheme() {
    for (const btn of $("theme").querySelectorAll("button")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.theme === state.theme));
    }
    /* The popup follows the same choice as the card. "auto" leaves the
     * attribute off so prefers-color-scheme decides. */
    const root = document.documentElement;
    if (state.theme === "dark" || state.theme === "light") root.setAttribute("data-theme", state.theme);
    else root.removeAttribute("data-theme");
  }

  /* --- wiring ---------------------------------------------------------- */

  Promise.all([api.storage.local.get(Object.keys(DEFAULTS)), activeHost()])
    .then(([stored, host]) => {
      state = Object.assign({}, DEFAULTS, stored || {});
      currentHost = host;

      for (const k of TOGGLES) {
        $(k).checked = !!state[k];
        $(k).addEventListener("change", (e) => {
          state[k] = e.target.checked;
          save({ [k]: state[k] });
        });
      }

      $("siteOff").addEventListener("change", (e) => {
        if (!currentHost) return;
        state.userDisabled = e.target.checked
          ? state.userDisabled.concat([currentHost])
          : state.userDisabled.filter((h) => {
              const n = normalise(h);
              return !(currentHost === n || currentHost.endsWith("." + n));
            });
        save({ userDisabled: state.userDisabled });
        paintBlockedList();
      });

      for (const btn of $("theme").querySelectorAll("button")) {
        btn.addEventListener("click", () => {
          state.theme = btn.dataset.theme;
          save({ theme: state.theme });
          paintTheme();
        });
      }

      $("dwell").value = state.dwell;
      $("dwellVal").textContent = state.dwell + " ms";
      $("dwell").addEventListener("input", (e) => { $("dwellVal").textContent = e.target.value + " ms"; });
      $("dwell").addEventListener("change", (e) => {
        /* Clamp: a hostile or stale stored value should not disable hovering. */
        const v = parseInt(e.target.value, 10);
        save({ dwell: isFinite(v) ? Math.min(2000, Math.max(80, v)) : DEFAULTS.dwell });
      });

      paintSite();
      paintTheme();
    })
    .catch((err) => console.error("[peek] popup could not start", err));

  try { $("ver").textContent = "v" + api.runtime.getManifest().version; } catch (_) { /* ignore */ }
})();
