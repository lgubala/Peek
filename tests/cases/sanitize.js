/* The security boundary. Whatever leaves the sanitizer is rebuilt into the
 * card, so nothing that can execute may survive — and every node must be
 * inspected, including children hoisted out of an element that was unwrapped. */
const { loadUnit } = require("../harness");

const EXTRA = [
  "reader/images.js",
  "reader/sanitize.js",
  "reader/tidy.js",
  "reader/serialize.js",
  "reader/signals.js",
  "reader/index.js"
];

const filler = (n) => "<p>" + "Enough ordinary prose to clear the reader threshold. ".repeat(n) + "</p>";

module.exports = {
  "scripts and frames never survive"(t) {
    const { P } = loadUnit(EXTRA);
    const r = P.reader.clean(
      "<article><script>alert(1)</script><iframe src='https://evil/'></iframe>" +
      "<p onclick='steal()' style='color:red'>text</p>" + filler(8) + "</article>",
      { images: true });
    const json = JSON.stringify(r.nodes);
    t.notMatch(json, /script|iframe|onclick|style/i, "executable content survived");
    t.match(json, /text/, "the readable text should remain");
  },

  "children hoisted from an unwrapped element are still checked"(t) {
    const { P } = loadUnit(EXTRA);
    /* Asserted against the sanitizer's own output, not the finished node tree.
     * serialize.js drops unknown tags too, so testing through clean() passes
     * whether or not the sanitizer did its job — which it did, silently, when
     * this bug was reintroduced to check the test. Defence in depth is good;
     * a test that cannot tell which layer is working is not. */
    const doc = P.platform.parse(
      "<body><article><custom-block><script>alert(1)</script>" +
      "<p>visible</p></custom-block></article></body>");
    P.sanitize.sanitize(doc.body, { images: true });
    t.notMatch(doc.body.innerHTML, /<script|alert\(/i,
      "a script hoisted out of an unwrapped element survived the sanitizer");
    t.match(doc.body.innerHTML, /visible/, "the readable text should remain");
  },

  "the node tree is a second line of defence"(t) {
    const { P } = loadUnit(EXTRA);
    /* Even if the sanitizer let something through, nothing off the allowlist
     * can reach the card, because serialize.js rebuilds from a fixed set. */
    const r = P.reader.clean(
      "<article><custom-block><script>alert(1)</script>" + filler(8) + "</custom-block></article>",
      { images: true });
    t.notMatch(JSON.stringify(r.nodes), /script|alert/i, "nothing executable in the node tree");
  },

  "javascript: and relative URLs are dropped"(t) {
    const { P } = loadUnit(EXTRA);
    const r = P.reader.clean(
      "<article><a href='javascript:alert(1)'>x</a>" +
      "<a href='/relative'>y</a><a href='https://ok.example/z'>z</a>" + filler(8) + "</article>",
      { images: true });
    const json = JSON.stringify(r.nodes);
    t.notMatch(json, /javascript:/i, "javascript: URL survived");
    t.match(json, /https:\/\/ok\.example\/z/, "an absolute link should survive");
  },

  "relative URLs resolve when a base is given"(t) {
    const { P } = loadUnit(EXTRA);
    const r = P.reader.clean(
      "<article><img src='docs/shot.png' width='30%' alt='s'>" + filler(8) + "</article>",
      { images: true, maxImages: 1, baseUrl: "https://raw.example.com/u/r/main/" });
    t.match(JSON.stringify(r.nodes), /https:\/\/raw\.example\.com\/u\/r\/main\/docs\/shot\.png/,
      "GitHub-style relative image should resolve against the base");
  },

  "width='30%' is not a 30-pixel icon"(t) {
    const { P } = loadUnit(EXTRA);
    const doc = P.platform.parse("<img src='https://x/a.png' width='30%'>");
    t.equal(P.images.widthHint(doc.querySelector("img")), 0,
      "a percentage width says nothing about real size");
    const doc2 = P.platform.parse(
      "<img src='https://x/image/w75-h75/a.jpg' srcset='https://x/image/w75-h75/a.jpg 75w' width='640'>");
    t.equal(P.images.widthHint(doc2.querySelector("img")), 75,
      "the URL and srcset outrank a lying width attribute");
  },

  "menus are refused as articles"(t) {
    const { P } = loadUnit(EXTRA);
    const nav = "<ul>" + ["Home", "News", "Sport", "Culture", "Contact", "About"]
      .map((x) => `<li><a href="https://s.example/${x}">${x}</a></li>`).join("") + "</ul>";
    const r = P.reader.clean("<div>" + nav + nav + "</div>", { images: true });
    t.ok(!r.ok, "a page of links should not be offered as an article");
  }
};
