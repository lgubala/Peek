/* Peek — content/styles.js
 * All card styling. Lives in a shadow root, so nothing here leaks into the
 * page and nothing on the page leaks in.
 *
 * Every colour is a token. Dark is the default, light follows the browser's
 * preference, and the popup can force either. To reskin Peek, edit the two
 * palettes below and nothing else.
 */
(function (P) {
  "use strict";

  P.styles = `
:host {
  all: initial;

  --bg:         #131A21;
  --bg-sunk:    #0F151B;
  --bg-inset:   #0D1319;
  --bg-chip:    #17222A;
  --border:     #2A3742;
  --border-soft:#1E2831;
  --border-chip:#22303A;

  --ink:        #DCE5EC;
  --ink-strong: #EAF1F6;
  --ink-soft:   #B9C7D3;
  --ink-dim:    #7C8D9C;
  --ink-faint:  #5D6E7E;

  --accent:     #7FD8C4;
  --accent-bg:  #16302C;
  --accent-br:  #24544C;

  --warn:       #E9A94A;
  --warn-bg:    #2A2115;
  --warn-br:    #453320;
  --bad:        #F0768C;
  --bad-bg:     #2C1820;
  --bad-br:     #4A2531;
  --info:       #74B8C6;

  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 14px 38px rgba(0,0,0,.5);
}

/* Follow the browser, unless the popup has forced dark. */
@media (prefers-color-scheme: light) {
  :host(:not([data-theme="dark"])) {
    --bg:         #FFFFFF;
    --bg-sunk:    #F4F6F8;
    --bg-inset:   #F0F3F6;
    --bg-chip:    #EDF1F5;
    --border:     #CFD8E0;
    --border-soft:#E3E9EE;
    --border-chip:#DBE2E9;

    --ink:        #1B2530;
    --ink-strong: #0E1720;
    --ink-soft:   #33414F;
    --ink-dim:    #566472;
    --ink-faint:  #7B8996;

    --accent:     #14776A;
    --accent-bg:  #E1F3EF;
    --accent-br:  #A9DCD2;

    --warn:       #8F5C0C;
    --warn-bg:    #FDF3E2;
    --warn-br:    #EBD3A8;
    --bad:        #B02742;
    --bad-bg:     #FBE7EB;
    --bad-br:     #EFBDC7;
    --info:       #1B6675;

    --shadow: 0 1px 2px rgba(16,32,48,.10), 0 12px 32px rgba(16,32,48,.18);
  }
}

/* An explicit choice in the popup wins over the browser preference. */
:host([data-theme="light"]) {
  --bg:         #FFFFFF;
  --bg-sunk:    #F4F6F8;
  --bg-inset:   #F0F3F6;
  --bg-chip:    #EDF1F5;
  --border:     #CFD8E0;
  --border-soft:#E3E9EE;
  --border-chip:#DBE2E9;
  --ink:        #1B2530;
  --ink-strong: #0E1720;
  --ink-soft:   #33414F;
  --ink-dim:    #566472;
  --ink-faint:  #7B8996;
  --accent:     #14776A;
  --accent-bg:  #E1F3EF;
  --accent-br:  #A9DCD2;
  --warn:       #8F5C0C;
  --warn-bg:    #FDF3E2;
  --warn-br:    #EBD3A8;
  --bad:        #B02742;
  --bad-bg:     #FBE7EB;
  --bad-br:     #EFBDC7;
  --info:       #1B6675;
  --shadow: 0 1px 2px rgba(16,32,48,.10), 0 12px 32px rgba(16,32,48,.18);
}

* { box-sizing: border-box; }

/* ---------------------------------------------------------------------------
   Alarm states. The card itself changes, not just a line of text inside it —
   at a glance, across a page of results, the wrong one should look wrong
   before you have read a word of it.
   --------------------------------------------------------------------------- */
.card.danger {
  border-color: var(--bad);
  box-shadow: 0 0 0 1px var(--bad), var(--shadow);
}
.card.caution { border-color: var(--warn); }

.alarm {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 10px 11px;
  font-size: 12px; line-height: 1.45; font-weight: 500;
}
.alarm.danger { background: var(--bad-bg); color: var(--bad); border-bottom: 1px solid var(--bad-br); }
.alarm.caution { background: var(--warn-bg); color: var(--warn); border-bottom: 1px solid var(--warn-br); }
.alarm .body { padding: 0; }
.alarm .head {
  display: block; font-weight: 700; letter-spacing: .02em;
  text-transform: uppercase; font-size: 10px; margin-bottom: 3px;
}
.alarm p { margin: 0 0 5px; }
.alarm p:last-child { margin-bottom: 0; }

/* A triangle for danger, a disc for caution. Drawn, so there is no font or
   emoji to fail to render. */
.sign { flex: none; width: 18px; height: 18px; position: relative; margin-top: 1px; }
.sign::before {
  content: ""; position: absolute; inset: 0;
}
.sign.danger::before {
  border-left: 9px solid transparent;
  border-right: 9px solid transparent;
  border-bottom: 16px solid var(--bad);
  width: 0; height: 0; inset: 1px auto auto 0;
}
.sign.caution::before {
  border-radius: 50%; background: var(--warn);
}
.sign::after {
  content: "!"; position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 800; color: var(--bg);
  padding-top: 4px;
}
.sign.caution::after { padding-top: 0; }

@media (prefers-reduced-motion: no-preference) {
  .card.danger { animation: pulse .5s ease-out 1; }
  @keyframes pulse {
    from { box-shadow: 0 0 0 5px transparent, var(--shadow); }
    to   { box-shadow: 0 0 0 1px var(--bad), var(--shadow); }
  }
}

.card {
  position: fixed;
  z-index: 2147483647;
  width: max-content;
  min-width: 260px;
  max-width: ${P.config.CARD_MAX_WIDTH}px;
  background: var(--bg);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: var(--shadow);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px; line-height: 1.45;
  overflow: hidden;
  opacity: 0; transform: translateY(3px);
  transition: opacity .11s ease-out, transform .11s ease-out;
}
.card.in { opacity: 1; transform: none; }
.card:focus { outline: 2px solid var(--accent); outline-offset: 2px; }
.card:focus:not(:focus-visible) { outline: none; }
.card.wide { max-width: ${P.config.CARD_MAX_WIDTH + 40}px; }
@media (prefers-reduced-motion: reduce) { .card { transition: none; transform: none; } }

/* identity bar: who you would actually be talking to */
.bar {
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  padding: 9px 11px 8px;
  background: var(--bg-sunk); border-bottom: 1px solid var(--border-soft);
  font-size: 11px;
}
.bar .dom {
  color: var(--accent); font-weight: 650; letter-spacing: -.01em;
  font-size: 15px; line-height: 1.2; word-break: break-all;
}
.bar .kind {
  margin-left: auto; font-size: 9.5px; text-transform: uppercase;
  letter-spacing: .09em; color: var(--ink-faint); white-space: nowrap; align-self: center;
}
.spin {
  width: 9px; height: 9px; border-radius: 50%; flex: none;
  border: 1.5px solid var(--border-chip); border-top-color: var(--accent);
  animation: sp .7s linear infinite;
}
@keyframes sp { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }

/* where the domain is registered */
.origin {
  display: inline-flex; align-items: baseline; gap: 5px;
  font-size: 10.5px; font-weight: 600; white-space: nowrap;
  padding: 2px 7px; border-radius: 4px;
  background: var(--bg-chip); color: var(--ink-dim); border: 1px solid var(--border-chip);
}
.origin .cc { font-size: 11px; letter-spacing: .04em; color: var(--ink); }
.origin.bad { background: var(--bad-bg); color: var(--bad); border-color: var(--bad-br); }
.origin.bad .cc { color: var(--bad); }

/* the hop a redirect travels through, on its own line */
.route {
  display: flex; align-items: center; gap: 6px; flex-basis: 100%;
  font-size: 10.5px; color: var(--ink-dim);
}
.route .lbl { color: var(--ink-faint); }
.route .host { color: var(--ink); font-weight: 500; word-break: break-all; }

/* "?" explainers, so the card can say why something matters */
.help {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; border-radius: 50%; flex: none;
  font-size: 9.5px; font-weight: 700; line-height: 1;
  background: var(--bg-chip); color: var(--ink-dim);
  border: 1px solid var(--border-chip);
  cursor: pointer; user-select: none;
}
.help:hover { color: var(--accent); border-color: var(--accent-br); }
.explain {
  flex-basis: 100%; margin-top: 7px;
  padding: 7px 9px; border-radius: 5px;
  background: var(--bg-inset); border: 1px solid var(--border-chip);
  font-size: 11px; line-height: 1.5; color: var(--ink-dim);
}
.explain b { color: var(--ink); font-weight: 600; }
.explain + .explain { margin-top: 5px; }

/* metrics: the numbers you would otherwise have to open the page for */
.metrics { display: flex; flex-wrap: wrap; gap: 4px; padding: 9px 11px 0; }
.metrics span {
  font-size: 11px; font-weight: 500;
  padding: 2px 7px; border-radius: 999px;
  background: var(--bg-chip); color: var(--ink-dim); border: 1px solid var(--border-chip);
}
.metrics span.lead { background: var(--accent-bg); color: var(--accent); border-color: var(--accent-br); }

.body { padding: 9px 11px 0; }
.scroll { max-height: 46vh; overflow-y: auto; overscroll-behavior: contain; }
.scroll::-webkit-scrollbar { width: 8px; }
.scroll::-webkit-scrollbar-thumb { background: var(--border-chip); border-radius: 4px; }

.hero {
  display: block; width: 100%; max-height: 150px;
  object-fit: cover; border-radius: 6px; margin-bottom: 9px; background: var(--bg-inset);
}
.headline {
  font-size: 13.5px; font-weight: 600; line-height: 1.3;
  color: var(--ink-strong); letter-spacing: -.01em; margin-bottom: 5px;
}

.ingr { display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 9px; }
.ingr span {
  font-size: 10.5px; padding: 2px 6px; border-radius: 4px;
  background: var(--bg-chip); color: var(--ink-soft); border: 1px solid var(--border-chip);
}

ol.steps { margin: 0; padding: 0 0 0 17px; font-size: 12px; line-height: 1.5; color: var(--ink-soft); }
ol.steps li { margin-bottom: 5px; }
ol.steps li::marker { color: var(--ink-faint); font-size: 10px; }
.sechead {
  list-style: none; margin-left: -17px; margin-top: 8px;
  font-size: 10px; text-transform: uppercase; letter-spacing: .08em;
  color: var(--accent); font-weight: 600;
}

.rbody { font-size: 12.5px; line-height: 1.6; color: var(--ink-soft); }
.rbody p { margin: 0 0 9px; }
.rbody h1, .rbody h2, .rbody h3, .rbody h4 {
  font-size: 12.5px; font-weight: 600; color: var(--ink-strong); margin: 12px 0 5px;
}
.rbody a { color: var(--accent); text-decoration: none; border-bottom: 1px solid var(--accent-br); }
.rbody ul, .rbody ol { margin: 0 0 9px; padding-left: 18px; }
.rbody li { margin-bottom: 3px; }
.rbody blockquote { margin: 0 0 9px; padding-left: 9px; border-left: 2px solid var(--accent-br); color: var(--ink-dim); }
.rbody pre { background: var(--bg-inset); padding: 7px 9px; border-radius: 5px; overflow-x: auto; font-size: 11px; margin: 0 0 9px; }
.rbody code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 11px; }
.rbody img { max-width: 100%; height: auto; border-radius: 5px; margin: 0 0 9px; }
.rbody figure { margin: 0 0 9px; }
.rbody figcaption { font-size: 10.5px; color: var(--ink-dim); margin-top: 3px; }
.rbody table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 9px; }
.rbody th, .rbody td { border: 1px solid var(--border-chip); padding: 3px 5px; text-align: left; }

/* A body of roughly the height the real content will take, so the card does
   not grow and reposition under the pointer when the fetch lands. */
.loading { min-height: 92px; padding-bottom: 4px; }
.skel {
  height: 9px; margin: 8px 11px; border-radius: 3px;
  background: var(--border);
  opacity: .55;
}
.skel:nth-child(2) { width: 88%; }
.skel:nth-child(3) { width: 74%; }
.skel:nth-child(4) { width: 45%; }

@media (prefers-reduced-motion: no-preference) {
  .skel { animation: breathe 1.4s ease-in-out infinite; }
  @keyframes breathe { 0%, 100% { opacity: .35; } 50% { opacity: .7; } }
}

/* Peek could not read the page. Informational, deliberately not the red or
   amber of a security flag. */
.unread {
  display: block; padding: 8px 11px;
  border-top: 1px solid var(--border-soft);
  font-size: 11.5px; line-height: 1.5; color: var(--ink-dim);
}
.unread-why { display: block; }
.unread-got { display: block; margin-top: 2px; color: var(--ink-faint); }

.note { padding: 9px 11px 0; font-size: 11.5px; color: var(--ink-dim); line-height: 1.45; }

.flags { padding: 9px 11px 0; display: flex; flex-direction: column; gap: 5px; }
.flag { display: flex; gap: 7px; font-size: 11.5px; line-height: 1.4; }
.flag .dot { flex: none; width: 5px; height: 5px; border-radius: 50%; margin-top: 6px; }
.flag.info .dot { background: var(--info); } .flag.info { color: var(--info); }
.flag.warn .dot { background: var(--warn); } .flag.warn { color: var(--warn); }
.flag.bad  .dot { background: var(--bad);  } .flag.bad  { color: var(--bad); }

/* the dissected URL, shown only when something about the link is wrong */
.url {
  margin: 9px 11px 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 10.5px; line-height: 1.55; word-break: break-all;
  background: var(--bg-inset); border-left: 2px solid var(--bad-br);
  border-radius: 0 4px 4px 0; padding: 6px 8px;
}
.s-dim { color: var(--ink-faint); } .s-host { color: var(--accent); font-weight: 600; }
.s-path { color: var(--ink-soft); } .s-key { color: var(--ink-dim); } .s-val { color: var(--ink-faint); }
.s-warn { color: var(--warn); } .s-bad { color: var(--bad); font-weight: 600; }
.s-dead { color: var(--ink-faint); text-decoration: line-through; opacity: .7; }

.fade { height: 22px; margin-top: -22px; background: linear-gradient(transparent, var(--bg)); pointer-events: none; }

.foot {
  margin-top: 9px; padding: 6px 11px;
  background: var(--bg-sunk); border-top: 1px solid var(--border-soft);
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
  font-size: 10.5px; color: var(--ink-faint);
}
.foot .safe { color: var(--accent); }
.foot .sent { color: var(--warn); }
/* ---------------------------------------------------------------------------
   The kept-pages panel. Its own host, so the card can come and go underneath.
   --------------------------------------------------------------------------- */
.panel {
  flex-direction: column;
  box-shadow: -8px 0 28px rgba(0, 0, 0, .3);
  transform: translateX(8px); opacity: 0;
  transition: transform .12s ease-out, opacity .12s ease-out;
}
.panel.in { transform: none; opacity: 1; }

.panel-head {
  display: flex; align-items: center; gap: 10px;
  padding: 13px 14px; border-bottom: 1px solid var(--border); flex: none;
}
.panel-head h2 { margin: 0; font-size: 14px; color: var(--accent); letter-spacing: -.01em; }
.panel-count { font-size: 11px; color: var(--ink-dim); }
.panel-close {
  margin-left: auto; font: inherit; font-size: 18px; line-height: 1;
  background: none; border: none; color: var(--ink-faint); cursor: pointer; padding: 0 2px;
}
.panel-close:hover { color: var(--accent); }

.panel-body { flex: 1; overflow-y: auto; overscroll-behavior: contain; }
.panel-empty { margin: 0; padding: 18px 14px; font-size: 12px; color: var(--ink-dim); line-height: 1.6; }

.kept-item { padding: 11px 14px; border-bottom: 1px solid var(--border-soft); }
.kept-head { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px; }
.kept-domain { font-size: 11px; color: var(--accent); font-weight: 600; }
.kept-kind {
  font-size: 9px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-faint);
}
.kept-title {
  display: block; color: var(--ink); font-size: 12.5px; line-height: 1.4;
  text-decoration: none; margin-bottom: 4px;
}
.kept-title:hover { color: var(--accent); }
.kept-desc { font-size: 11.5px; color: var(--ink-dim); line-height: 1.5; }
.kept-metrics { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 3px; }
.kept-metrics span {
  font-size: 10px; padding: 1px 6px; border-radius: 999px;
  background: var(--chip-bg); border: 1px solid var(--chip-br); color: var(--ink-dim);
}
.kept-flag {
  font-size: 11px; line-height: 1.45; padding: 5px 7px; border-radius: 5px; margin: 4px 0;
}
.kept-flag.bad { background: var(--bad-bg); color: var(--bad); border: 1px solid var(--bad-br); }
.kept-flag.warn { background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-br); }
.kept-foot { display: flex; align-items: center; gap: 6px; margin-top: 6px; }
.kept-when { font-size: 10px; color: var(--ink-faint); margin-right: auto; }

.panel-foot {
  display: flex; align-items: center; gap: 8px; flex: none;
  padding: 10px 14px; border-top: 1px solid var(--border);
  font-size: 10.5px; color: var(--ink-faint);
}
.panel-foot span { flex: 1; line-height: 1.4; }

.actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.act {
  font: inherit; font-size: 10.5px;
  background: none; color: var(--ink-faint);
  border: 1px solid transparent; border-radius: 5px;
  padding: 2px 6px; cursor: pointer; white-space: nowrap;
}
.act:hover { color: var(--accent); border-color: var(--accent-br); }

.card.pinned { border-color: var(--accent-br); }
.card.pinned .foot { background: var(--accent-bg); }

.openbtn {
  font: inherit; font-size: 10.5px; font-weight: 500;
  background: var(--accent-bg); color: var(--accent);
  border: 1px solid var(--accent-br); border-radius: 5px;
  padding: 2px 9px; cursor: pointer;
}
.openbtn:hover { filter: brightness(1.08); }
kbd {
  font-family: inherit; font-size: 10px;
  border: 1px solid var(--border-chip); border-radius: 3px;
  padding: 0 4px; color: var(--ink-faint);
}
`;
})(self.Peek = self.Peek || {});
