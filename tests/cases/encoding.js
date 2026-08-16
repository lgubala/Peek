/* Fetched pages are not all UTF-8. Central European and Cyrillic sites still
 * serve windows-1250 and windows-1251 — sme.sk, the worked example in Peek's
 * own README, is one. Decoding those as UTF-8 gives mojibake, which a user
 * reads as the site being broken rather than the extension. */
const { loadModules } = require("../harness");

const MODULES = [
  "common/log.js", "config/rules.js", "config/sites.js", "config/trackers.js",
  "platform/dom.js", "common/text.js", "common/url.js", "common/policy.js",
  "background/gate.js", "background/fetcher.js"
];

/* A response whose body arrives as one chunk of bytes. */
function response(bytes, contentType) {
  return {
    ok: true, status: 200, url: "https://x/", type: "basic",
    headers: { get: (h) => (h.toLowerCase() === "content-type" ? contentType : null) },
    body: {
      getReader() {
        let done = false;
        return {
          read: async () => (done ? { done: true } : ((done = true), { done: false, value: bytes })),
          cancel: async () => {}
        };
      }
    }
  };
}

const WIN1250 = { "Č": 0xC8, "í": 0xED, "ú": 0xFA, "š": 0x9A, "ž": 0x9E, "č": 0xE8,
                  "á": 0xE1, "é": 0xE9, "ý": 0xFD, "ô": 0xF4, "ĺ": 0xE5, "ň": 0xF2 };

function encode(str, table) {
  const out = [];
  for (const ch of str) {
    const code = ch.charCodeAt(0);
    if (code < 128) out.push(code);
    else if (table[ch] !== undefined) out.push(table[ch]);
    else out.push(0x3F);
  }
  return Buffer.from(out);
}

const cyrillic = (str) => Buffer.from([...str].map((c) => {
  const code = c.charCodeAt(0);
  if (code < 128) return code;
  if (code >= 0x410 && code <= 0x44F) return code - 0x410 + 0xC0;
  return 0x3F;
}));

function page(titleBytes, prefix) {
  return Buffer.concat([
    Buffer.from("<html><head>" + (prefix || "") + "<title>", "ascii"),
    titleBytes,
    Buffer.from("</title></head><body>x</body></html>", "ascii")
  ]);
}

module.exports = {
  "charset from the Content-Type header"(t) {
    const { P } = loadModules(MODULES);
    const body = page(encode("Čítajú", WIN1250));
    return P.fetcher.readCapped(response(body, "text/html; charset=windows-1250"))
      .then((r) => t.match(r.text, /Čítajú/, "windows-1250 declared in the header"));
  },

  "charset from a meta tag when the header is silent"(t) {
    const { P } = loadModules(MODULES);
    const body = page(encode("Čítajú", WIN1250), '<meta charset="windows-1250">');
    return P.fetcher.readCapped(response(body, "text/html"))
      .then((r) => t.match(r.text, /Čítajú/, "windows-1250 declared in a meta tag"));
  },

  "Cyrillic in windows-1251"(t) {
    const { P } = loadModules(MODULES);
    const body = page(cyrillic("Новости"));
    return P.fetcher.readCapped(response(body, "text/html; charset=windows-1251"))
      .then((r) => t.match(r.text, /Новости/, "windows-1251"));
  },

  "UTF-8 is untouched, declared or not"(t) {
    const { P } = loadModules(MODULES);
    const body = page(Buffer.from("Čítajú najnovšie správy", "utf8"));
    return Promise.all([
      P.fetcher.readCapped(response(body, "text/html; charset=utf-8")),
      P.fetcher.readCapped(response(body, "text/html"))
    ]).then(([declared, silent]) => {
      t.match(declared.text, /Čítajú najnovšie správy/, "declared UTF-8");
      t.match(silent.text, /Čítajú najnovšie správy/, "undeclared UTF-8");
    });
  },

  "an unknown charset label does not lose the body"(t) {
    const { P } = loadModules(MODULES);
    const body = page(Buffer.from("hello", "utf8"));
    return P.fetcher.readCapped(response(body, "text/html; charset=x-not-real"))
      .then((r) => t.match(r.text, /hello/, "recovered from a bogus label"));
  }
};
