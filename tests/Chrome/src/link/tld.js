/* Peek — link/tld.js
 * Where a domain is registered, and whether its TLD is one abuse favours.
 *
 * This matters more than it looks. A click-tracker at ipro3.dmesp.ru reads as
 * noise unless something says "Russia" next to it. Country is the single most
 * useful thing Peek can tell you about a host at a glance, and it costs no
 * request to work out.
 *
 * Country codes only describe the registry, not where the server is or who
 * runs it. Peek states the fact and lets you draw the conclusion.
 */
(function (P) {
  "use strict";

  const COUNTRIES = {
    ac:"Ascension", ad:"Andorra", ae:"UAE", af:"Afghanistan", ag:"Antigua",
    al:"Albania", am:"Armenia", ao:"Angola", ar:"Argentina", at:"Austria",
    au:"Australia", az:"Azerbaijan", ba:"Bosnia", bd:"Bangladesh", be:"Belgium",
    bf:"Burkina Faso", bg:"Bulgaria", bh:"Bahrain", bo:"Bolivia", br:"Brazil",
    bs:"Bahamas", by:"Belarus", bz:"Belize", ca:"Canada", cd:"DR Congo",
    cf:"Central African Rep.", ch:"Switzerland", ci:"Ivory Coast", cl:"Chile",
    cm:"Cameroon", cn:"China", co:"Colombia", cr:"Costa Rica", cu:"Cuba",
    cy:"Cyprus", cz:"Czechia", de:"Germany", dk:"Denmark", do:"Dominican Rep.",
    dz:"Algeria", ec:"Ecuador", ee:"Estonia", eg:"Egypt", es:"Spain",
    et:"Ethiopia", eu:"European Union", fi:"Finland", fj:"Fiji", fr:"France",
    ga:"Gabon", ge:"Georgia", gg:"Guernsey", gh:"Ghana", gi:"Gibraltar",
    gr:"Greece", gt:"Guatemala", hk:"Hong Kong", hn:"Honduras", hr:"Croatia",
    ht:"Haiti", hu:"Hungary", id:"Indonesia", ie:"Ireland", il:"Israel",
    im:"Isle of Man", in:"India", iq:"Iraq", ir:"Iran", is:"Iceland",
    it:"Italy", je:"Jersey", jo:"Jordan", jp:"Japan", ke:"Kenya",
    kg:"Kyrgyzstan", kh:"Cambodia", kp:"North Korea", kr:"South Korea",
    kw:"Kuwait", kz:"Kazakhstan", la:"Laos", lb:"Lebanon", li:"Liechtenstein",
    lk:"Sri Lanka", lt:"Lithuania", lu:"Luxembourg", lv:"Latvia", ly:"Libya",
    ma:"Morocco", mc:"Monaco", md:"Moldova", me:"Montenegro", mk:"North Macedonia",
    mm:"Myanmar", mn:"Mongolia", mt:"Malta", mu:"Mauritius", mx:"Mexico",
    my:"Malaysia", mz:"Mozambique", ng:"Nigeria", ni:"Nicaragua",
    nl:"Netherlands", no:"Norway", np:"Nepal", nz:"New Zealand", om:"Oman",
    pa:"Panama", pe:"Peru", ph:"Philippines", pk:"Pakistan", pl:"Poland",
    pr:"Puerto Rico", ps:"Palestine", pt:"Portugal", py:"Paraguay", qa:"Qatar",
    ro:"Romania", rs:"Serbia", ru:"Russia", rw:"Rwanda", sa:"Saudi Arabia",
    sd:"Sudan", se:"Sweden", sg:"Singapore", si:"Slovenia", sk:"Slovakia",
    sn:"Senegal", so:"Somalia", sr:"Suriname", su:"Soviet Union", sv:"El Salvador",
    sy:"Syria", th:"Thailand", tj:"Tajikistan", tm:"Turkmenistan", tn:"Tunisia",
    tr:"T\u00fcrkiye", tw:"Taiwan", tz:"Tanzania", ua:"Ukraine", ug:"Uganda",
    uk:"United Kingdom", us:"United States", uy:"Uruguay", uz:"Uzbekistan",
    ve:"Venezuela", vn:"Vietnam", ye:"Yemen", za:"South Africa", zm:"Zambia",
    zw:"Zimbabwe"
  };

  /* ccTLDs sold as generic names, so the country tells you nothing about who
   * is behind the site. Shown as a plain label rather than a country. */
  const REPURPOSED = {
    ai:"AI", io:"tech", co:"generic", tv:"media", me:"generic", fm:"audio",
    cc:"generic", ws:"generic", to:"generic", gg:"gaming", sh:"generic",
    is:"generic", so:"generic", st:"generic", nu:"generic", la:"generic"
  };

  /* TLDs with a long-standing reputation for abuse — free or near-free
   * registration, so heavily used for throwaway phishing and malware hosts. */
  const HIGH_ABUSE = new Set([
    "tk", "ml", "ga", "cf", "gq",            // formerly free registries
    "top", "xyz", "click", "link", "work", "rest", "fit", "loan", "men",
    "date", "download", "stream", "review", "country", "kim", "science",
    "party", "gdn", "racing", "win", "bid", "trade", "webcam", "cyou",
    "sbs", "quest", "zip", "mov"
  ]);

  function tldOf(host) {
    const parts = String(host || "").toLowerCase().split(".");
    return parts.length > 1 ? parts[parts.length - 1] : "";
  }

  /* Returns null when the TLD says nothing worth a chip (.com, .org, .net). */
  function info(host) {
    const tld = tldOf(host);
    if (!tld) return null;

    const abusive = HIGH_ABUSE.has(tld);

    if (COUNTRIES[tld] && !REPURPOSED[tld]) {
      return {
        tld,
        code: tld.toUpperCase(),
        label: COUNTRIES[tld],
        kind: "country",
        tone: abusive ? "bad" : "country"
      };
    }
    if (abusive) {
      return { tld, code: "." + tld, label: "high-abuse domain", kind: "abuse", tone: "bad" };
    }
    return null;
  }

  P.tld = { info, tldOf, COUNTRIES, HIGH_ABUSE, REPURPOSED };
})(self.Peek = self.Peek || {});
