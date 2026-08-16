/* Peek — content/card.js
 * Builds the card. Shows the destination's content; anything already visible
 * on the page you are on is deliberately left out.
 *
 * The one exception is trouble: if the link is deceptive, the flags and the
 * dissected URL move above everything else.
 */
(function (P) {
  "use strict";

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* The link text is already on screen. Only repeat it if the page disagrees. */
  function sameAsLink(heading, linkText) {
    if (!heading || !linkText) return false;
    const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
    const a = norm(heading), b = norm(linkText);
    if (!a || !b) return false;
    return a === b || a.indexOf(b) === 0 || b.indexOf(a) === 0;
  }

  function hero(parent, summary, settings) {
    if (!settings.images || !summary || !summary.image) return false;
    if (P.config.USELESS_HERO.test(summary.image)) return false;
    const img = document.createElement("img");
    img.className = "hero";
    img.setAttribute("referrerpolicy", "no-referrer");
    img.setAttribute("loading", "lazy");
    img.addEventListener("error", () => img.remove());
    img.src = summary.image;
    parent.appendChild(img);
    return true;
  }

  /* "RU · Russia" reads on every platform. Flag emoji do not render on
   * Windows, which is exactly where this needs to be legible. */
  function originChip(origin) {
    const chip = el("span", "origin" + (origin.tone === "bad" ? " bad" : ""));
    chip.appendChild(el("span", "cc", origin.code));
    chip.appendChild(el("span", "name", origin.label));
    chip.title = origin.kind === "country"
      ? "Registered under the ." + origin.tld + " registry (" + origin.label + ")"
      : "." + origin.tld + " is a registry heavily used for abuse";
    return chip;
  }

  /* A "?" that reveals a short explanation inside the card. The explanation
   * is written out rather than hidden in a tooltip, because the thing being
   * explained — a redirect through another country — is exactly the sort of
   * thing people skip past when it is only a hover title. */
  function help(parent, text) {
    const btn = el("span", "help", "?");
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.title = "Explain this";

    const toggle = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = parent.querySelector('[data-help="' + btn.dataset.key + '"]');
      if (open) { open.remove(); return; }
      const box = el("div", "explain");
      box.dataset.help = btn.dataset.key;
      for (const part of text) {
        if (part === "\n") box.appendChild(document.createElement("br"));
        else if (typeof part === "string") box.appendChild(document.createTextNode(part));
        else if (part && part.b) box.appendChild(el("b", null, part.b));
        else if (part && part.i) box.appendChild(el("i", null, part.i));
      }
      parent.appendChild(box);
    };
    btn.dataset.key = "h" + Math.random().toString(36).slice(2, 7);
    btn.addEventListener("click", toggle);
    btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") toggle(e); });
    return btn;
  }

  /* Explainer copy, as parts rather than markup: plain strings, {b} for bold,
   * {i} for italic, "\n" for a line break. */
  function originHelp(origin) {
    if (origin.kind === "abuse") {
      return [
        { b: "." + origin.tld }, " is a registry with a long history of abuse \u2014 names ",
        "there are free or nearly free, so it is popular for throwaway phishing and ",
        "malware hosts. Plenty of harmless sites use it too; it is a reason to look ",
        "twice, not a verdict."
      ];
    }
    return [
      "The domain ends in ", { b: "." + origin.tld }, ", the registry for ",
      { b: origin.label }, ". That is where the name was ", { i: "registered" },
      " \u2014 it does not tell you where the server sits, who runs the site, or what ",
      "language it is in. It is a clue about who you are dealing with, nothing more."
    ];
  }

  function routeHelp(viaHost, destination) {
    return [
      "The link does not point at ", { b: destination }, " directly. It points at ",
      { b: viaHost }, ". Clicking it sends your browser there first, where the click is ",
      "recorded \u2014 typically who you are, when, and which message the link came from \u2014 ",
      "and that server then forwards you on.", "\n", "\n",
      "Peek decoded the address hidden inside the link, so ", { b: destination },
      " is where the link ", { i: "says" }, " it will send you. Only the middle server ",
      "decides where you actually end up."
    ];
  }

  function flagRow(f) {
    const row = el("div", "flag " + (f.tone || "warn"));
    row.appendChild(el("span", "dot"));
    row.appendChild(el("span", null, f.text));
    return row;
  }

  function flagBlock(card, list) {
    if (!list || !list.length) return;
    const box = el("div", "flags");
    list.forEach((f) => box.appendChild(flagRow(f)));
    card.appendChild(box);
  }

  /* --- sections -------------------------------------------------------- */

  function renderRecipe(card, summary, settings) {
    card.classList.add("wide");
    const wrap = el("div", "body scroll");
    hero(wrap, summary, settings);

    const ing = el("div", "ingr");
    summary.ingredients.forEach((i) => ing.appendChild(el("span", null, i)));
    wrap.appendChild(ing);

    if (summary.steps && summary.steps.length) {
      const ol = el("ol", "steps");
      summary.steps.forEach((step) => {
        if (step.indexOf("\u00a7 ") === 0) ol.appendChild(el("li", "sechead", step.slice(2)));
        else ol.appendChild(el("li", null, step));
      });
      wrap.appendChild(ol);
    } else if (summary.description) {
      wrap.appendChild(el("div", "note", summary.description));
    }

    card.appendChild(wrap);
    card.appendChild(el("div", "fade"));
    flagBlock(card, summary.flags);
  }

  function renderArticle(card, article, summary, settings) {
    card.classList.add("wide");
    const wrap = el("div", "body scroll");
    if (!article.images) hero(wrap, summary, settings);

    const body = el("div", "rbody");
    /* Built from a node tree, element by element. Nothing here parses HTML. */
    body.appendChild(P.build.fragment(article.nodes));
    wrap.appendChild(body);

    card.appendChild(wrap);
    card.appendChild(el("div", "fade"));
    flagBlock(card, summary && summary.flags);
  }

  function renderSummaryOnly(card, summary, article, result, data, settings) {
    const long = summary && summary.description && summary.description.length > 320;
    const showHead = summary && summary.heading && !sameAsLink(summary.heading, data.linkText);
    const wantsBody = (summary && (summary.image || summary.description)) || showHead;

    if (wantsBody) {
      const wrap = el("div", long ? "body scroll" : "body");
      if (long) card.classList.add("wide");
      hero(wrap, summary, settings);
      if (showHead) wrap.appendChild(el("div", "headline", summary.heading));
      if (summary.description) {
        const d = el("div", "rbody");
        d.style.whiteSpace = "pre-wrap";
        d.textContent = summary.description;
        wrap.appendChild(d);
      }
      card.appendChild(wrap);
    }

    /* Only explain the missing article when there was nothing else to show. */
    if (!wantsBody && article && !article.ok && article.reason) {
      flagBlock(card, [{ tone: "warn", text: article.reason }]);
    }
    flagBlock(card, result.flags);
    flagBlock(card, summary && summary.flags);
  }

  /* --- entry ----------------------------------------------------------- */

  /* The loudest thing Peek can say. Sits above everything, changes the card
   * itself, and states what was observed rather than passing a verdict. */
  function alarm(card, level, flags) {
    const box = el("div", "alarm " + level);
    box.appendChild(el("span", "sign " + level));

    const body = el("div", "body");
    body.appendChild(el("span", "head",
      level === "danger" ? "This does not add up" : "Worth a look first"));
    flags.forEach((f) => body.appendChild(el("p", null, f.text)));
    box.appendChild(body);

    card.appendChild(box);
    card.classList.add(level);
  }

  /* Link-level trouble and page-level trouble, ranked together. */
  function severity(data, result) {
    const linkWorst = data.flags.reduce(
      (w, f) => (f.tone === "bad" ? "danger" : w || (f.tone === "warn" ? "caution" : w)), "");
    const pageLevel = (result && result.signals && result.signals.level) || "";
    if (linkWorst === "danger" || pageLevel === "danger") return "danger";
    if (linkWorst === "caution" || pageLevel === "caution") return "caution";
    return "";
  }

  function render(card, data, state, settings) {
    card.textContent = "";
    card.classList.remove("wide", "danger", "caution");

    const result = state && state !== "loading" ? state : null;
    const summary = result && result.ok ? result.summary : null;
    const article = result && result.ok ? result.article : null;

    /* identity bar: the domain, and where it is registered */
    const bar = el("div", "bar");
    bar.appendChild(el("span", "dom", data.title));

    if (data.origin) {
      bar.appendChild(originChip(data.origin));
      bar.appendChild(help(bar, originHelp(data.origin)));
    }
    if (state === "loading") bar.appendChild(el("span", "spin"));

    const kind = (summary && summary.kind) || (article && article.ok ? "Article" : "");
    if (kind) bar.appendChild(el("span", "kind", kind));

    /* A redirect hop is part of the answer to "who am I talking to". */
    if (data.via) {
      const route = el("div", "route");
      route.appendChild(el("span", "lbl", "via"));
      route.appendChild(el("span", "host", data.via.host));
      if (data.via.origin) route.appendChild(originChip(data.via.origin));
      route.appendChild(help(bar, routeHelp(data.via.host, data.title)));
      bar.appendChild(route);
    }
    card.appendChild(bar);

    /* Trouble wins the top slot, with the URL to prove it. */
    const pageFlags = (result && result.signals && result.signals.flags) || [];
    const loud = pageFlags.filter((f) => f.tone === "bad" || f.tone === "warn");
    const level = severity(data, result);

    if (level) {
      alarm(card, level, data.flags.slice(0, 3).concat(loud).slice(0, 4));
      if (data.segments && data.segments.length && data.flags.length) {
        const url = el("div", "url");
        data.segments.forEach((s) => url.appendChild(el("span", "s-" + s.c, s.t)));
        card.appendChild(url);
      }
    }

    /* The route a redirect took is informative rather than alarming. */
    const route = pageFlags.filter((f) => f.tone === "info");
    if (route.length) flagBlock(card, route);

    if (summary && summary.metrics && summary.metrics.length) {
      const m = el("div", "metrics");
      summary.metrics.forEach((t, i) => m.appendChild(el("span", i === 0 ? "lead" : null, t)));
      card.appendChild(m);
    }

    /* the content itself */
    if (summary && summary.ingredients && summary.ingredients.length) {
      renderRecipe(card, summary, settings);
    } else if (article && article.ok && article.nodes && article.nodes.length) {
      renderArticle(card, article, summary, settings);
    } else if (result && result.ok) {
      renderSummaryOnly(card, summary, article, result, data, settings);
    } else if (result && !result.ok) {
      flagBlock(card, [{ tone: result.blocked ? "warn" : "bad", text: result.reason || "Could not read this page." }]);
    } else if (state === "loading") {
      card.appendChild(el("div", "note", "Reading the page\u2026"));
    } else if (data.disabled) {
      card.appendChild(el("div", "note", "Peek is switched off for this site."));
    } else if (data.pageNoFetch) {
      /* Says why Peek is holding back on THIS PAGE. The old wording read as a
       * verdict on the link, which was wrong and alarming for ordinary links. */
      card.appendChild(el("div", "note",
        "Peek never fetches from your mail. Links in messages are often click-trackers, " +
        "and asking for one would tell the sender you read it. Press L to fetch this one anyway."));
    } else if (!settings.autoPeek) {
      card.appendChild(el("div", "note", "Fetching is off. Press L to read this page."));
    }

    /* footer: which stage you are looking at, honestly */
    const foot = el("div", "foot");
    foot.appendChild(result
      ? el("span", "sent", "Requested from your IP" + (result.cached ? " \u00b7 cached" : ""))
      : el("span", "safe", "No request sent"));

    const right = el("span");
    if (result && result.ok) {
      const open = el("button", "openbtn", "Open \u2197");
      open.addEventListener("click", () => {
        window.open(data.lookUrl, "_blank", "noopener");
        P.hover.hide();
      });
      right.appendChild(open);
    } else {
      right.appendChild(el("kbd", null, "Esc"));
    }
    foot.appendChild(right);
    card.appendChild(foot);
  }

  P.card = { render, el, sameAsLink, originChip, help, originHelp, routeHelp, severity };
})(self.Peek = self.Peek || {});
