/* Peek — link/recognizers.js
 * Facts readable from the URL alone, with no request. Each recognizer returns
 * a label for the card, or "" when it does not apply.
 *
 * To add one: append to the list. Order matters only for overlapping hosts.
 */
(function (P) {
  "use strict";

  const { squash } = P.text;

  const RECOGNIZERS = [
    {
      name: "GitHub",
      test: (c) => c.reg === "github.com",
      read(c, facts) {
        const s = c.seg;
        if (s.length >= 2) {
          facts.push({ label: "Repository", value: s[0] + "/" + s[1] });
          const kind = s[2];
          if (kind === "issues") facts.push({ label: "Section", value: s[3] ? "Issue #" + s[3] : "Issue list" });
          if (kind === "pull") facts.push({ label: "Section", value: s[3] ? "Pull request #" + s[3] : "Pull requests" });
          if (kind === "releases") facts.push({ label: "Section", value: "Releases" });
          if (kind === "commit") facts.push({ label: "Section", value: "Commit " + (s[3] || "").slice(0, 7) });
          if (kind === "blob" || kind === "tree") {
            facts.push({ label: "Branch", value: s[3] || "\u2014" });
            if (s.length > 4) facts.push({ label: "File", value: s.slice(4).join("/") });
          }
          if (c.hash && /^#L\d+/.test(c.hash)) facts.push({ label: "Jumps to", value: "line " + c.hash.slice(2) });
        } else if (s.length === 1) {
          facts.push({ label: "GitHub user or org", value: s[0] });
        }
      }
    },
    {
      name: "Reddit",
      test: (c) => c.reg === "reddit.com" && (c.seg[0] === "r" || c.seg[0] === "user"),
      read(c, facts) {
        if (c.seg[0] === "user") return facts.push({ label: "Redditor", value: "u/" + c.seg[1] });
        facts.push({ label: "Subreddit", value: "r/" + c.seg[1] });
        if (c.seg[2] === "comments") facts.push({ label: "Type", value: "Comment thread" });
      }
    },
    {
      name: "Wikipedia",
      test: (c) => /(^|\.)wikipedia\.org$/.test(c.host),
      read(c, facts) {
        const title = P.url.tryDecode(c.seg[c.seg.length - 1] || "").replace(/_/g, " ");
        if (title) facts.push({ label: "Article", value: title });
        facts.push({ label: "Language", value: c.host.split(".")[0].toUpperCase() });
      }
    },
    {
      name: "Stack Exchange",
      test: (c) => c.reg === "stackoverflow.com" || /stackexchange\.com$/.test(c.reg),
      read(c, facts) {
        if (c.seg[0] === "questions" && c.seg[1]) facts.push({ label: "Question", value: "#" + c.seg[1] });
      }
    },
    {
      name: "arXiv",
      test: (c) => c.reg === "arxiv.org",
      read(c, facts) {
        const id = c.seg[c.seg.length - 1];
        if (id) facts.push({ label: "Paper", value: id });
        facts.push({ label: "Access", value: c.seg[0] === "pdf" ? "Direct PDF" : "Abstract page" });
      }
    },
    {
      name: "DOI",
      test: (c) => c.reg === "doi.org",
      read(c, facts) {
        facts.push({ label: "DOI", value: c.seg.join("/") });
        facts.push({ label: "Note", value: "Redirects to the publisher" });
      }
    },
    {
      name: "npm",
      test: (c) => c.reg === "npmjs.com" && c.seg[0] === "package",
      read: (c, facts) => facts.push({ label: "npm package", value: c.seg.slice(1).join("/") })
    },
    {
      name: "PyPI",
      test: (c) => c.reg === "pypi.org" && c.seg[0] === "project",
      read: (c, facts) => facts.push({ label: "PyPI project", value: c.seg[1] })
    },
    {
      name: "crates.io",
      test: (c) => c.reg === "crates.io" && c.seg[0] === "crates",
      read: (c, facts) => facts.push({ label: "Crate", value: c.seg[1] })
    },
    {
      name: "Amazon",
      test: (c) => c.reg.indexOf("amazon.") === 0,
      read(c, facts, chips) {
        const asin = (c.path.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i) || [])[1];
        if (asin) facts.push({ label: "Product (ASIN)", value: asin });
        facts.push({ label: "Marketplace", value: c.reg.split(".").slice(1).join(".").toUpperCase() });
        if (c.param("tag")) chips.push({ label: "Affiliate link", tone: "warn" });
      }
    },
    {
      name: "IMDb",
      test: (c) => c.reg === "imdb.com" && c.seg[0] === "title",
      read: (c, facts) => facts.push({ label: "Title ID", value: c.seg[1] })
    },
    {
      name: "Wayback Machine",
      test: (c) => c.reg === "archive.org" && c.seg[0] === "web",
      read(c, facts) {
        const m = c.path.match(/\/web\/(\d{4})(\d{2})(\d{2})\d*\/(.+)$/);
        if (!m) return;
        facts.push({ label: "Snapshot", value: m[1] + "-" + m[2] + "-" + m[3] });
        facts.push({ label: "Archived page", value: P.url.tryDecode(m[4]).slice(0, 80) });
      }
    },
    {
      name: "Google Docs",
      test: (c) => c.host === "docs.google.com",
      read(c, facts) {
        const kind = { document: "Doc", spreadsheets: "Sheet", presentation: "Slides", forms: "Form" }[c.seg[0]];
        if (kind) facts.push({ label: "Google", value: kind });
        if (c.path.indexOf("/edit") !== -1) facts.push({ label: "Opens in", value: "Edit mode" });
      }
    },
    {
      name: "Hacker News",
      test: (c) => c.reg === "news.ycombinator.com",
      read(c, facts) {
        const id = c.param("id");
        if (id) facts.push({ label: "Item", value: "#" + id });
      }
    },
    {
      name: "Steam",
      test: (c) => c.host === "store.steampowered.com",
      read(c, facts) {
        if (c.seg[0] === "app") facts.push({ label: "Steam app", value: c.seg[1] });
      }
    }
  ];

  /* Runs every recognizer against a parsed URL. Returns the label of the one
   * that matched, for the card's corner. */
  function recognize(u, reg, params, facts, chips) {
    const ctx = {
      url: u,
      host: u.hostname.replace(/^www\./, ""),
      reg,
      seg: u.pathname.split("/").filter(Boolean),
      path: u.pathname,
      hash: u.hash,
      param: (k) => P.url.qget(params, k)
    };
    for (const r of RECOGNIZERS) {
      let hit = false;
      try { hit = r.test(ctx); } catch (_) { hit = false; }
      if (!hit) continue;
      try { r.read(ctx, facts, chips); } catch (_) { /* a bad recognizer must not break the card */ }
      return r.name;
    }
    return "";
  }

  P.recognizers = { RECOGNIZERS, recognize };
})(self.Peek = self.Peek || {});
