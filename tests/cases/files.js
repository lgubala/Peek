/* What a file is, before you download it. Peek reads metadata from the first
 * few kilobytes — never content, and never with a PDF library. A confident
 * wrong title would be worse than no title, so the quiet cases matter. */
const { loadUnit, loadEngine, fakeBrowser } = require("../harness");

const EXTRA = ["reader/files.js"];

/* A PDF head as a real producer writes it: version marker, an /Info
 * dictionary, and the page tree. */
function pdfHead(opts) {
  opts = opts || {};
  let s = "%PDF-" + (opts.version || "1.7") + "\n%\xE2\xE3\xCF\xD3\n";
  s += "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  s += "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count " + (opts.pages || 12) + " >>\nendobj\n";
  if (opts.encrypted) s += "trailer\n<< /Encrypt 9 0 R >>\n";
  s += "4 0 obj\n<< /Title " + (opts.title || "(Annual Report 2026)") +
       " /Author (" + (opts.author || "Statistics Office") + ")" +
       " /Producer (LaTeX) >>\nendobj\n";
  return s;
}

/* UTF-16BE inside a hex string, which is what Word and Acrobat emit. */
function hexUtf16(text) {
  let hex = "FEFF";
  for (const ch of text) hex += ch.charCodeAt(0).toString(16).padStart(4, "0");
  return "<" + hex.toUpperCase() + ">";
}

const officeHead = (title, author) =>
  "PK\x03\x04" + "\x00".repeat(20) + "docProps/core.xml" +
  '<?xml version="1.0"?><cp:coreProperties><dc:title>' + title +
  "</dc:title><dc:creator>" + author + "</dc:creator></cp:coreProperties>";

module.exports = {
  "a PDF reports its size, pages and title"(t) {
    const { P } = loadUnit(EXTRA);
    const f = P.files.inspect(pdfHead(), "application/pdf", 4.2 * 1024 * 1024,
      "https://stats.example.gov/report.pdf");
    t.equal(f.kind, "PDF", "recognised as a PDF");
    t.equal(f.title, "Annual Report 2026", "title from the /Info dictionary");
    t.match(f.metrics.join(" | "), /4\.2 MB/, "size, so you know what you are asking for");
    t.match(f.metrics.join(" | "), /12 pages/, "page count from the page tree");
    t.match(f.metrics.join(" | "), /Statistics Office/, "and the author");
  },

  "UTF-16 hex titles are decoded"(t) {
    const { P } = loadUnit(EXTRA);
    /* Most producers write titles this way; reading the bytes literally gives
     * a title full of nulls. */
    const f = P.files.inspect(pdfHead({ title: hexUtf16("Účtovná závierka 2026") }),
      "application/pdf", 512 * 1024, "https://x/f.pdf");
    t.equal(f.title, "Účtovná závierka 2026", "decoded from UTF-16BE hex");
  },

  "a password-protected PDF says so"(t) {
    const { P } = loadUnit(EXTRA);
    const f = P.files.inspect(pdfHead({ encrypted: true }), "application/pdf", 1024,
      "https://x/secret.pdf");
    t.match(JSON.stringify(f.flags), /password-protected/, "worth knowing before clicking");
  },

  "an Office document with a stored core.xml"(t) {
    const { P } = loadUnit(EXTRA);
    const f = P.files.inspect(officeHead("Q3 Forecast", "Jana Kováčová"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      88 * 1024, "https://x/forecast.xlsx");
    t.equal(f.kind, "Spreadsheet", "recognised by content type");
    t.equal(f.title, "Q3 Forecast", "title from docProps/core.xml");
    t.match(f.metrics.join(" | "), /88 KB/, "and its size");
  },

  "an unreadable file still reports what is certain"(t) {
    const { P } = loadUnit(EXTRA);
    /* A deflated ZIP entry cannot be read from a prefix. Peek should report
     * the size and stop, not invent a title. */
    const f = P.files.inspect("PK\\x03\\x04" + "\\x9C\\x3F\\xA1".repeat(200),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      2 * 1024 * 1024, "https://x/contract.docx");
    t.equal(f.kind, "Word document", "the type is known from the header");
    t.equal(f.title, "", "and no title is guessed at");
    t.match(f.metrics.join(" | "), /2\.0 MB/, "size is still useful on its own");
  },

  "a mismatched extension is flagged"(t) {
    const { P } = loadUnit(EXTRA);
    const f = P.files.inspect("", "application/zip", 900, "https://x/invoice.pdf");
    t.match(JSON.stringify(f.flags), /ends in \.pdf but the server sends/,
      "the link says one thing and the server another");
  },

  "sizes read the way people say them"(t) {
    const { P } = loadUnit(EXTRA);
    t.equal(P.files.humanSize(0), "", "nothing to say about an unknown size");
    t.equal(P.files.humanSize(900), "900 B", "bytes");
    t.equal(P.files.humanSize(88 * 1024), "88 KB", "kilobytes");
    t.equal(P.files.humanSize(4.2 * 1024 * 1024), "4.2 MB", "one decimal while it matters");
    t.equal(P.files.humanSize(240 * 1024 * 1024), "240 MB", "and none when it does not");
  },

  async "a PDF link produces a card rather than a shrug"(t) {
    const api = fakeBrowser({});
    const head = Buffer.from(pdfHead({ pages: 34, title: "(Budget 2026)" }), "latin1");
    const globals = {
      browser: api, chrome: api,
      fetch: async (url) => ({
        ok: true, status: 200, url, type: "basic",
        headers: { get: (h) => ({ "content-type": "application/pdf",
                                  "content-length": String(3 * 1024 * 1024) })[h.toLowerCase()] || "" },
        body: { getReader() {
          let done = false;
          return { read: async () => (done ? { done: true } : ((done = true), { done: false, value: head })),
                   cancel: async () => {} };
        } }
      })
    };
    const { P } = loadEngine({ globals });
    const r = await P.pipeline.look("https://gov.example/budget-2026.pdf", { id: 1 });

    t.ok(r.ok, "the lookup succeeds: " + (r.reason || ""));
    t.equal(r.summary.kind, "PDF", "the card calls it a PDF");
    t.equal(r.summary.heading, "Budget 2026", "and shows the document's own title");
    t.match(r.summary.metrics.join(" | "), /3\.0 MB/, "with its size");
    t.match(r.summary.metrics.join(" | "), /34 pages/, "and its length");
    t.notMatch(JSON.stringify(r.flags), /Not a web page/,
      "and no longer says only that it is not a web page");
  }
};
