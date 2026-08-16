/* Peek — reader/images.js
 * Deciding which images are content and which are furniture.
 */
(function (P) {
  "use strict";

  /* sme.sk serves author thumbnails as
   *   src=".../image/w75-h75/<id>.jpg" srcset="... 75w" width="640" height="360"
   * The width attribute lies. The URL and srcset tell the truth, so the real
   * size is the smallest hint we can find and the attribute is a last resort.
   */
  function widthHint(img) {
    const hints = [];

    const srcset = img.getAttribute("srcset") || "";
    const re = /(\d+)w/g;
    let m;
    while ((m = re.exec(srcset))) hints.push(parseInt(m[1], 10));

    const src = img.getAttribute("src") || "";
    if ((m = src.match(/[/_-]w(\d{2,4})[-_.]/i))) hints.push(parseInt(m[1], 10));
    if ((m = src.match(/[/_-](\d{2,4})x(\d{2,4})[._/-]/))) hints.push(parseInt(m[1], 10));
    if ((m = src.match(/[?&](?:w|width|size)=(\d{2,4})\b/i))) hints.push(parseInt(m[1], 10));

    const positive = hints.filter((n) => n > 0);
    if (positive.length) return Math.min.apply(null, positive);

    /* Only a plain integer counts. READMEs lay screenshots out with
     * width="30%", and parseInt("30%") is 30 — which would read as a 30px
     * icon and throw the picture away. A relative width says nothing about
     * the real size, so treat it as unknown. */
    const attr = (img.getAttribute("width") || "").trim();
    if (!/^\d+$/.test(attr)) return 0;
    const w = parseInt(attr, 10);
    return w > 0 ? w : 0;
  }

  /* Author tiles, bylines and logos sit in telltale containers. */
  function inDecorativeContainer(img) {
    let n = img.parentElement;
    for (let i = 0; i < 4 && n; i++, n = n.parentElement) {
      if (!n.getAttribute) continue;
      const cls = (n.getAttribute("class") || "") + " " + (n.getAttribute("id") || "");
      if (P.config.DECORATIVE_CONTAINER.test(cls)) return true;
    }
    return false;
  }

  function isDecorative(img) {
    const src = img.getAttribute("src") || "";
    if (P.config.DECORATIVE_SRC.test(src)) return true;

    /* GitHub proxies external images through camo, which hides the real host.
     * data-canonical-src keeps the original, and that is where a shields.io
     * badge is still identifiable as a badge. */
    const canonical = img.getAttribute("data-canonical-src") || "";
    if (canonical && P.config.DECORATIVE_SRC.test(canonical)) return true;

    const cls = (img.getAttribute("class") || "") + " " + (img.getAttribute("id") || "");
    if (P.config.DECORATIVE_SRC.test(cls)) return true;

    if (inDecorativeContainer(img)) return true;

    const w = widthHint(img);
    return !!(w && w < P.config.MIN_IMAGE_WIDTH);
  }

  /* One photo is enough for an article or a recipe. A product listing is the
   * exception: there, each image belongs to a different thing being compared. */
  function looksLikeListing(root) {
    const text = root.textContent || "";
    const prices = (text.match(/\d[\d\s.,]*\s?(?:\u20ac|\$|K\u010d|z\u0142|EUR|USD|GBP)/gi) || []).length;
    const imgs = root.querySelectorAll("img").length;
    return prices >= P.config.LISTING_MIN_PRICES && imgs >= P.config.LISTING_MIN_IMAGES;
  }

  function budget(root, override) {
    if (override) return override;
    return looksLikeListing(root) ? P.config.MAX_IMAGES_LISTING : P.config.MAX_IMAGES;
  }

  P.images = { widthHint, isDecorative, looksLikeListing, budget };
})(self.Peek = self.Peek || {});
