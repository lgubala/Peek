/* Peek — config/trackers.js
 * ============================================================================
 * TRACKING PARAMETERS, and who owns them.
 *
 * Peek cannot vendor an existing catalogue. ClearURLs and AdGuard rule data is
 * LGPL-3.0-only, DuckDuckGo's is CC BY-NC-SA, and Brave's and Firefox's lists
 * now ship through a downloaded component and Remote Settings respectively,
 * so neither can be taken from source without a runtime fetch — and Peek does
 * not phone home. Parameter names are facts, so this list is ours.
 *
 * Three kinds of rule, cheapest first:
 *
 *   EXACT      one parameter name          "fbclid" -> Meta
 *   FAMILIES   a prefix or shape           /^utm_/  -> Google Analytics
 *   PATHS      tracking baked into a path  Amazon's /ref=nav_x
 *
 * Peek only *shows* these; it never strips or rewrites a URL. Nothing breaks
 * if an entry is wrong, so the bar for adding one is low. Attributing a
 * parameter to a company is the useful part: "4 tracking tags (Google, Meta)"
 * says more than four opaque strings.
 * ============================================================================
 */
(function (P) {
  "use strict";

  const G = "Google", META = "Meta", MS = "Microsoft", LI = "LinkedIn",
        YA = "Yandex", ADOBE = "Adobe", HS = "HubSpot", MC = "Mailchimp",
        SF = "Salesforce", KL = "Klaviyo", BRZ = "Braze", MKTO = "Marketo",
        TIK = "TikTok", X = "X/Twitter", PIN = "Pinterest", SNAP = "Snap",
        RDT = "Reddit", AMZ = "Amazon", ALI = "Alibaba", EB = "eBay",
        SHOP = "Shopify", MATOMO = "Matomo", PIWIK = "Piwik", OMN = "Omniture",
        AFF = "affiliate network", EMAIL = "email sender", NEWS = "news site",
        VK = "VK", BAIDU = "Baidu", APPLE = "Apple", ORACLE = "Oracle";

  /* --- exact names ---------------------------------------------------- */

  const EXACT = {
    /* Google */
    gclid: G, gclsrc: G, dclid: G, gbraid: G, wbraid: G, gad_source: G,
    gad: G, gadid: G, gcl_au: G, _ga: G, _gl: G, _gac: G, srsltid: G,
    ei: G, ved: G, usg: G, sa: G, cad: G, uact: G, sca_esv: G, sca_upv: G,
    oq: G, sourceid: G, sxsrf: G, aqs: G, rlz: G, gs_lcp: G, gs_lcrp: G,
    iflsig: G, gs_l: G,
    /* Meta */
    fbclid: META, fb_action_ids: META, fb_action_types: META, fb_source: META,
    fb_ref: META, fbadid: META, fbaid: META, __cft__: META, __tn__: META,
    __xts__: META, refsrc: META, refid: META,
    /* Microsoft and LinkedIn */
    msclkid: MS, li_fat_id: LI, trk: LI, trkcampaign: LI, trk_contact: LI,
    trk_msg: LI, trk_module: LI, trk_sid: LI, originalsubdomain: LI,
    midtoken: LI, midsig: LI, otptoken: LI,
    /* Other networks */
    ttclid: TIK, tt_medium: TIK, tt_content: TIK,
    twclid: X, __twitter_impression: X, ref_src: X, ref_url: X,
    igshid: META, igsh: META, img_index: META,
    epik: PIN, scid: SNAP, rdt_cid: RDT,
    yclid: YA, ysclid: YA, _openstat: YA, wprid: YA,
    vk_ref: VK, mt_click_id: VK,
    bd_vid: BAIDU, hmsr: BAIDU, hmpl: BAIDU, hmcu: BAIDU, hmkw: BAIDU, hmci: BAIDU,
    /* Marketing platforms */
    mkt_tok: MKTO, mkwid: MKTO, pcrid: MKTO, pkw: MKTO, pmt: MKTO, pdv: MKTO,
    _hsenc: HS, _hsmi: HS, hsctatracking: HS, __hsfp: HS, __hssc: HS, __hstc: HS,
    mc_cid: MC, mc_eid: MC, mc_tc: MC,
    vero_id: EMAIL, vero_conv: EMAIL, ck_subscriber_id: EMAIL,
    ml_subscriber: EMAIL, ml_subscriber_hash: EMAIL, _kx: KL,
    oly_anon_id: BRZ, oly_enc_id: BRZ,
    elqtrackid: ORACLE, elqtrack: ORACLE,
    sc_campaign: SF, sc_channel: SF, sc_content: SF, sc_medium: SF,
    sc_outcome: SF, sc_geo: SF, sc_country: SF,
    s_cid: OMN, s_kwcid: OMN, sc_cid: OMN,
    /* Affiliates */
    cjevent: AFF, cjdata: AFF, irclickid: AFF, irgwc: AFF, sscid: AFF,
    clickid: AFF, click_id: AFF, affiliate_id: AFF, aff_id: AFF, aff_sub: AFF,
    partner_id: AFF, cvosrc: AFF, cvo_campaign: AFF, _bta_tid: AFF, _bta_c: AFF,
    /* Shops */
    spm: ALI, scm: ALI, pvid: ALI, algo_pvid: ALI, algo_expid: ALI, btsid: ALI,
    ws_ab_test: ALI, aff_platform: ALI, aff_trace_key: ALI, terminal_id: ALI,
    psc: AMZ, smid: AMZ, th: AMZ, ascsubtag: AMZ, asc_campaign: AMZ,
    asc_refurl: AMZ, asc_source: AMZ,
    _trkparms: EB, _trksid: EB, amdata: EB,
    /* News and content */
    guccounter: NEWS, guce_referrer: NEWS, guce_referrer_sig: NEWS,
    icid: NEWS, cmpid: NEWS, ncid: NEWS, cid: NEWS, taid: NEWS, cmp: NEWS,
    smtyp: NEWS, ito: NEWS, xtor: NEWS, wtmc: NEWS, wt_mc: NEWS, wt_zmc: NEWS,
    ss_source: NEWS, ss_campaign_id: NEWS, sr_share: NEWS,
    /* Misc */
    vgo_ee: EMAIL, ceneo_spo: AFF, __s: EMAIL, sb_referer_host: EMAIL,
    correlation_id: null, share_id: null, share_source: null,
    _branch_match_id: null, recipientid: EMAIL, customerid: EMAIL,
    assetid: EMAIL, mkt_unsubscribe: EMAIL
  };

  /* --- families ------------------------------------------------------- */
  /* One rule beats fifty entries, and it catches the ones nobody has seen
   * yet: utm_whatever_new keeps working without an update. */

  const FAMILIES = [
    { re: /^utm[_-]/i,            owner: "Google Analytics" },
    { re: /^itm_/i,               owner: NEWS },
    { re: /^at_(medium|campaign|custom\d?)$/i, owner: NEWS },
    { re: /^stm_/i,               owner: "Google Analytics" },
    { re: /^pk_/i,                owner: PIWIK },
    { re: /^mtm_/i,               owner: MATOMO },
    { re: /^piwik_/i,             owner: PIWIK },
    { re: /^matomo_/i,            owner: MATOMO },
    { re: /^hsa_/i,               owner: HS },
    { re: /^_hs[a-z]+$/i,         owner: HS },
    { re: /^(adgroup|campaign|creative|matchtype|network|placement|targetid|device|keyword)id?$/i,
      owner: "ad network" },
    { re: /^(sc|ss)_[a-z_]+$/i,   owner: SF },
    { re: /^wt\./i,               owner: OMN },
    { re: /^utm/i,                owner: "Google Analytics" }
  ];

  /* --- names that are only trackers on certain sites ------------------- */
  /* `ref` means "referrer tracking" on Amazon and "reference" on half the
   * web. Attributing every ?ref= to Amazon is worse than saying nothing:
   * it is confidently wrong, which is the one thing a hint must never be. */

  const SCOPED = [
    { host: /(^|\.)amazon\./i,
      re: /^(ref|ref_|pf_rd_[a-z]+|pd_rd_[a-z]+|psc|th|smid|qid|sr|sprefix|crid)$/i,
      owner: AMZ },
    { host: /(^|\.)ebay\./i,     re: /^(hash|_trk[a-z]*|amdata|mkevt|mkcid|mkrid|campid|customid|toolid)$/i, owner: EB },
    { host: /(^|\.)aliexpress\./i, re: /^(spm|scm|pvid|algo_[a-z]+|btsid|ws_ab_test|aff_[a-z_]+)$/i, owner: ALI },
    { host: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, re: /^(si|pp|feature|kw)$/i, owner: G },
    { host: /(^|\.)reddit\.com$/i, re: /^(share_id|correlation_id|ref|ref_source|rdt)$/i, owner: RDT },
    { host: /(^|\.)shopify\.com$|myshopify\.com$/i, re: /^(_pos|_sid|_ss|_v|variant)$/i, owner: SHOP },
    { host: /(^|\.)booking\.com$/i, re: /^(aid|sid|label|sb_price_type|dest_id|srpvid)$/i, owner: "Booking.com" }
  ];

  /* --- tracking baked into the path ----------------------------------- */
  /* Some sites do not use a query parameter at all. Amazon puts the referrer
   * in the path itself, which is why product URLs are forty characters longer
   * than they need to be. */

  const PATHS = [
    { host: /(^|\.)amazon\./i,     re: /\/ref=[^/?#]+/g,        owner: AMZ,  label: "referrer path" },
    { host: /(^|\.)ebay\./i,       re: /\/itm\/[^/]*\/\d+\?/g,  owner: EB,   label: "listing path" },
    { host: /(^|\.)aliexpress\./i, re: /\/_[a-z]+\//g,          owner: ALI,  label: "campaign path" },
    { host: /(^|\.)youtube\.com$|(^|\.)youtu\.be$/i, re: /\/(si|pp)=[^/?#&]+/g, owner: G, label: "share path" }
  ];

  /* --- lookup --------------------------------------------------------- */

  /* Returns the owner ("Google"), "" for a known-but-unattributed tracker, or
   * null when the parameter is not a tracker at all. `host` enables the
   * site-scoped rules; without it, only names that are trackers everywhere
   * count. */
  function owner(name, host) {
    if (!name) return null;
    const key = String(name).toLowerCase();

    if (Object.prototype.hasOwnProperty.call(EXACT, key)) return EXACT[key] || "";
    for (const f of FAMILIES) if (f.re.test(key)) return f.owner;

    if (host) {
      for (const rule of SCOPED) {
        if (rule.host.test(host) && rule.re.test(key)) return rule.owner;
      }
    }
    return null;
  }

  const isTracker = (name, host) => owner(name, host) !== null;

  /* Path tracking for a given host: [{ owner, label, match }] */
  function inPath(host, pathname) {
    const hits = [];
    if (!host || !pathname) return hits;
    for (const rule of PATHS) {
      if (!rule.host.test(host)) continue;
      rule.re.lastIndex = 0;
      const m = pathname.match(rule.re);
      if (m && m.length) hits.push({ owner: rule.owner, label: rule.label, match: m[0] });
    }
    return hits;
  }

  /* Summarises a whole query string: how many trackers, and whose. */
  function summarise(params, host, pathname) {
    const names = [], owners = [];
    for (const [k] of params) {
      const who = owner(k, host);
      if (who === null) continue;
      names.push(k);
      if (who && owners.indexOf(who) === -1) owners.push(who);
    }
    for (const hit of inPath(host, pathname)) {
      names.push(hit.label);
      if (hit.owner && owners.indexOf(hit.owner) === -1) owners.push(hit.owner);
    }
    return { count: names.length, names, owners };
  }

  P.trackers = { owner, isTracker, inPath, summarise, EXACT, FAMILIES, SCOPED, PATHS };
})(self.Peek = self.Peek || {});
