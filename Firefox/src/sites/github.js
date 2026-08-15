/* Peek — sites/github.js
 * GitHub's rewritten repo page loads the README after it renders, so fetching
 * the page returns everything except the thing you wanted. The public API
 * renders it for us.
 *
 * Unauthenticated, so 60 requests an hour. The cache absorbs normal browsing
 * and a failure falls through to the generic fetch.
 */
(function (P) {
  "use strict";

  const RESERVED = [
    "orgs", "settings", "features", "about", "pricing", "marketplace",
    "explore", "topics", "collections", "sponsors", "notifications",
    "login", "join", "search", "apps", "codespaces", "enterprise"
  ];

  function repoOf(rawUrl) {
    try {
      const u = new URL(rawUrl);
      if (!/(^|\.)github\.com$/.test(u.hostname)) return null;
      const seg = u.pathname.split("/").filter(Boolean);
      if (seg.length < 2) return null;
      if (RESERVED.indexOf(seg[0]) !== -1) return null;
      if (seg.length > 2 && seg[2] !== "tree") return null;   // repo root only
      return { owner: seg[0], repo: seg[1].replace(/\.git$/, "") };
    } catch (_) { return null; }
  }

  P.siteHandlers.register({
    name: "github",

    match: (url) => !!repoOf(url),

    async run(url, opts, ctx) {
      const r = repoOf(url);
      const base = "https://api.github.com/repos/" +
        encodeURIComponent(r.owner) + "/" + encodeURIComponent(r.repo);

      const [meta, readme] = await Promise.all([
        ctx.fetchJson(base, { Accept: "application/vnd.github+json" }),
        ctx.fetchText(base + "/readme", { Accept: "application/vnd.github.html" })
      ]);
      if (!meta) return null;

      const metrics = [];
      if (meta.stargazers_count) metrics.push("\u2605 " + meta.stargazers_count.toLocaleString());
      if (meta.language) metrics.push(meta.language);
      if (meta.forks_count) metrics.push(meta.forks_count.toLocaleString() + " forks");
      if (meta.license && meta.license.spdx_id && meta.license.spdx_id !== "NOASSERTION") {
        metrics.push(meta.license.spdx_id);
      }
      if (meta.open_issues_count) metrics.push(meta.open_issues_count + " open issues");
      if (meta.pushed_at) metrics.push("updated " + meta.pushed_at.slice(0, 10));

      const summary = {
        kind: "Repository",
        heading: meta.full_name || r.owner + "/" + r.repo,
        description: meta.description || "",
        image: "",                 // the generated social card says nothing
        metrics, flags: [], ingredients: null, steps: null,
        source: ["GitHub API"], lang: "", canonical: meta.html_url || ""
      };
      if (meta.archived) summary.flags.push({ tone: "warn", text: "This repository is archived." });
      if (meta.fork) summary.flags.push({ tone: "info", text: "This is a fork." });


      /* GitHub does not absolutize relative paths inside raw HTML <img> tags,
       * and READMEs are full of them. Images resolve under /raw/, links under
       * /blob/, so the two bases differ. */
      const branch = meta.default_branch || "HEAD";
      const repoBase = "https://github.com/" + r.owner + "/" + r.repo + "/";
      const article = readme
        ? ctx.clean(readme.text, {
            images: opts.images,
            maxImages: 1,
            imageBase: repoBase + "raw/" + branch + "/",
            linkBase: repoBase + "blob/" + branch + "/"
          })
        : { ok: false, reason: "No README in this repository." };

      return {
        ok: true, status: 200, handler: "github",
        finalUrl: meta.html_url || url,
        summary, article
      };
    }
  });
})(self.Peek = self.Peek || {});
