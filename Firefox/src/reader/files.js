/* Peek — reader/files.js
 * What a file is, before you download it.
 *
 * A link ending in .pdf got "Not a web page — served as application/pdf",
 * which the user already knew from the extension. The questions actually worth
 * answering before clicking are: how big is it, is it really that type, and is
 * it the document I am looking for.
 *
 * All three come from the first few kilobytes plus the response headers — no
 * PDF library, nothing that could execute. Peek reads metadata, never content:
 *
 *   PDF    the /Info dictionary near the head, and the page count when the
 *          document declares it early enough
 *   Office .docx and .xlsx are ZIP files whose docProps/core.xml holds the
 *          title and author. Only readable when that entry is stored rather
 *          than deflated, which is rare — so this reports what it can and
 *          stays quiet otherwise
 *
 * Anything it cannot read, it says nothing about. A confident wrong title is
 * worse than no title.
 */
(function (P) {
  "use strict";

  const KB = 1024, MB = 1024 * KB;

  function humanSize(bytes) {
    if (!bytes || bytes < 0) return "";
    if (bytes < KB) return bytes + " B";
    if (bytes < MB) return Math.round(bytes / KB) + " KB";
    return (bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0) + " MB";
  }

  /* PDF strings are either literal (…) or hex <…>, and may be UTF-16BE. */
  function pdfString(raw) {
    if (!raw) return "";
    let s = raw;

    if (s[0] === "<") {
      const hex = s.slice(1, -1).replace(/[^0-9a-f]/gi, "");
      let out = "";
      for (let i = 0; i + 1 < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
      s = out;
    } else {
      s = s.slice(1, -1).replace(/\\([nrtbf()\\])/g, (m, c) =>
        ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[c] || c));
    }

    /* UTF-16BE with a byte-order mark, which is what most producers emit. */
    if (s.charCodeAt(0) === 0xFE && s.charCodeAt(1) === 0xFF) {
      let out = "";
      for (let i = 2; i + 1 < s.length; i += 2) {
        out += String.fromCharCode((s.charCodeAt(i) << 8) | s.charCodeAt(i + 1));
      }
      s = out;
    }
    return s.replace(/[\u0000-\u001F]/g, " ").replace(/\s+/g, " ").trim();
  }

  function readPdf(head) {
    const out = {};

    const version = /^%PDF-(\d\.\d)/.exec(head);
    if (version) out.version = version[1];

    for (const [key, field] of [["Title", "title"], ["Author", "author"],
                                ["Subject", "subject"], ["Producer", "producer"]]) {
      const m = new RegExp("/" + key + "\\s*(\\([^)]*\\)|<[0-9a-fA-F\\s]*>)").exec(head);
      if (m) {
        const value = pdfString(m[1]);
        if (value) out[field] = value.slice(0, 200);
      }
    }

    /* /Count in the page tree, when it appears early enough to have been read. */
    const count = /\/Type\s*\/Pages[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages/.exec(head);
    if (count) {
      const pages = parseInt(count[1] || count[2], 10);
      if (pages > 0 && pages < 100000) out.pages = pages;
    }

    /* An encrypted PDF will ask for a password when opened. Worth knowing. */
    if (/\/Encrypt\s/.test(head)) out.encrypted = true;

    return out;
  }

  /* .docx, .xlsx, .pptx: ZIP containers. Only a stored (uncompressed) entry
   * can be read from a prefix; deflated ones need the whole archive. */
  function readOffice(head) {
    const out = {};
    const core = head.indexOf("docProps/core.xml");
    if (core === -1) return out;

    const window_ = head.slice(core, core + 4096);
    const title = /<dc:title>([^<]{1,200})<\/dc:title>/.exec(window_);
    const author = /<dc:creator>([^<]{1,120})<\/dc:creator>/.exec(window_);
    if (title) out.title = title[1].trim();
    if (author) out.author = author[1].trim();
    return out;
  }

  const KIND = {
    "application/pdf": "PDF",
    "application/msword": "Word document",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word document",
    "application/vnd.ms-excel": "Spreadsheet",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Spreadsheet",
    "application/vnd.ms-powerpoint": "Slide deck",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "Slide deck",
    "application/epub+zip": "Ebook",
    "application/zip": "Archive",
    "application/gzip": "Archive",
    "application/x-tar": "Archive"
  };

  /* head: the first bytes as a latin1 string. Every byte maps to a character,
   * so the ASCII markers survive whatever the real encoding is. */
  function inspect(head, contentType, length, url) {
    const type = String(contentType || "").split(";")[0].trim().toLowerCase();
    const out = {
      kind: KIND[type] || "",
      contentType: type,
      size: length > 0 ? length : 0,
      sizeText: humanSize(length),
      metrics: [],
      title: ""
    };

    const isPdf = type === "application/pdf" || /^%PDF-/.test(head || "");
    const meta = isPdf ? readPdf(head || "")
               : /officedocument|opendocument|epub/.test(type) ? readOffice(head || "")
               : {};

    if (isPdf && !out.kind) out.kind = "PDF";
    if (meta.title) out.title = meta.title;
    out.author = meta.author || "";

    if (out.sizeText) out.metrics.push(out.sizeText);
    if (meta.pages) out.metrics.push(meta.pages + (meta.pages === 1 ? " page" : " pages"));
    if (meta.author) out.metrics.push(meta.author);
    if (meta.version) out.metrics.push("PDF " + meta.version);

    out.flags = [];
    if (meta.encrypted) {
      out.flags.push({ tone: "warn", text: "This PDF is password-protected." });
    }

    /* The extension said one thing and the server another. Usually a CDN
     * being careless; occasionally it is the interesting kind of wrong. */
    const ext = (/\.([a-z0-9]{1,5})(?:[?#]|$)/i.exec(url || "") || [])[1];
    if (ext && type) {
      const claims = { pdf: "application/pdf", zip: "application/zip",
                       docx: "wordprocessingml", xlsx: "spreadsheetml" }[ext.toLowerCase()];
      if (claims && type.indexOf(claims.split("/").pop()) === -1) {
        out.flags.push({ tone: "warn", text:
          "The link ends in ." + ext.toLowerCase() + " but the server sends " + type + "." });
      }
    }

    return out;
  }

  P.files = { inspect, humanSize, readPdf, readOffice };
})(self.Peek = self.Peek || {});
