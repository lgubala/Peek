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
    theme: "auto", dwell: 320, userDisabled: [], images: "any"
  };

  const TOGGLES = ["enabled", "autoPeek", "skipNav"];

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
        paintKept(stored && stored.kept);
      paintSite();
      });
      box.appendChild(a);
    });
  }

  /* --- theme ----------------------------------------------------------- */

  const IMAGE_NOTE = {
    off: "No images are requested at all. This is the one setting that " +
         "meaningfully reduces what a fetched page can do \u2014 Peek never runs " +
         "its JavaScript, but with images on, your browser still decodes bytes " +
         "from that server.",
    same: "Pictures from the site you are peeking, but not the ones it embeds " +
          "from ad networks and CDNs.",
    any: "Every image the page uses, including third-party ones."
  };

  /* Nothing invisible: if pages are kept, the popup says how many and offers
   * the way in. Hidden entirely when there are none, so it is not clutter. */
  function paintKept(kept) {
    const n = Array.isArray(kept) ? kept.length : 0;
    if (!n) { $("keptSection").hidden = true; return; }
    $("keptSection").hidden = false;
    $("keptCount").textContent = n + (n === 1 ? " page kept" : " pages kept");
    $("openPanel").onclick = () => {
      api.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        if (tabs && tabs[0]) api.tabs.sendMessage(tabs[0].id, { type: "peek:panel" });
        window.close();
      }).catch(() => {});
    };
  }

  function paintImages() {
    for (const btn of $("images").querySelectorAll("button")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.images === state.images));
    }
    $("imagesNote").textContent = IMAGE_NOTE[state.images] || "";
  }

  const TRIGGER_NOTE = {
    alt: "Nothing happens until you hold Alt \u2014 so Peek never fetches a page " +
         "you only glanced past, and it works everywhere, including menus and " +
         "sites it otherwise stays off.",
    shift: "Nothing happens until you hold Shift. Same as Alt, but Shift never " +
           "makes the browser\u2019s menu bar appear.",
    ctrl: "Nothing happens until you hold Ctrl. Careful if you Ctrl-click links " +
          "out of habit \u2014 that still opens them in a new tab.",
    hover: "Ambient: resting on any link is enough. Peek then has to guess what " +
           "you meant, so it skips navigation, stays off a few sites, and never " +
           "fetches from webmail."
  };

  function paintTrigger() {
    for (const btn of $("trigger").querySelectorAll("button")) {
      btn.setAttribute("aria-pressed", String(btn.dataset.trigger === state.trigger));
    }
    $("triggerNote").textContent = TRIGGER_NOTE[state.trigger] || "";

    /* With a modifier, holding the key says what you meant, so the guesses do
     * not apply. Saying so is better than leaving a control that quietly does
     * nothing. */
    const guessing = state.trigger === "hover";
    $("skipNavHint").textContent = guessing
      ? "Menus, breadcrumbs and footers. You already know where \u201cHome\u201d goes, and the card would sit on top of the row you are reading."
      : "Not needed while you hold a key to peek \u2014 holding it says you meant that link, menu or not.";
    $("skipNav").closest(".row").style.opacity = guessing ? "1" : "0.55";
  }

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

      /* images was a boolean before 1.15. */
      if (typeof state.images === "boolean") state.images = state.images ? "any" : "off";

      for (const btn of $("images").querySelectorAll("button")) {
        btn.addEventListener("click", () => {
          state.images = btn.dataset.images;
          save({ images: state.images });
          paintImages();
        });
      }

      for (const btn of $("trigger").querySelectorAll("button")) {
        btn.addEventListener("click", () => {
          state.trigger = btn.dataset.trigger;
          save({ trigger: state.trigger });
          paintTrigger();
        });
      }

      for (const btn of $("theme").querySelectorAll("button")) {
        btn.addEventListener("click", () => {
          state.theme = btn.dataset.theme;
          save({ theme: state.theme });
          paintTheme();
        });
      }

      /* One definition of the range, rather than a number in the markup that
       * quietly disagrees with the one in config. */
      $("dwell").max = (self.Peek && self.Peek.config && self.Peek.config.DWELL_MAX_MS) || 1500;
      $("dwell").value = state.dwell;
      $("dwellVal").textContent = state.dwell + " ms";
      $("dwell").addEventListener("input", (e) => { $("dwellVal").textContent = e.target.value + " ms"; });
      $("dwell").addEventListener("change", (e) => {
        /* Clamp: a hostile or stale stored value should not disable hovering. */
        const v = parseInt(e.target.value, 10);
        save({ dwell: isFinite(v) ? Math.min(2000, Math.max(80, v)) : DEFAULTS.dwell });
      });

      paintKept(stored && stored.kept);
      paintSite();
      paintImages();
      paintTrigger();
      paintTheme();
    })
    .catch((err) => console.error("[peek] popup could not start", err));

  try { $("ver").textContent = "v" + api.runtime.getManifest().version; } catch (_) { /* ignore */ }
})();
