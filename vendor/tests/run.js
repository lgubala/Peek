#!/usr/bin/env node
/* Peek — tests/run.js
 *
 *     node tests/run.js              everything
 *     node tests/run.js gate reader  only those
 *     node tests/run.js -v           show each assertion
 *
 * Every case runs against src/ and platform/, using the module order from
 * build/modules.json. There is no browser here, so what these cover is the
 * decisions — which links are refused, what a page is judged to be, what
 * survives the sanitizer — not whether Firefox paints the card.
 */
const fs = require("fs");
const path = require("path");
process.env.PEEK_SILENT = "1";
const { Check } = require("./harness");

const CASES = path.join(__dirname, "cases");
const args = process.argv.slice(2);
const verbose = args.includes("-v") || args.includes("--verbose");
const only = args.filter((a) => !a.startsWith("-"));

const files = fs.readdirSync(CASES)
  .filter((f) => f.endsWith(".js"))
  .filter((f) => !only.length || only.some((o) => f.includes(o)))
  .sort();

if (!files.length) {
  console.error("no test files matched " + only.join(", "));
  process.exit(1);
}

const RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", BOLD = "\x1b[1m", OFF = "\x1b[0m";

let passed = 0, failed = 0, assertions = 0;
const started = Date.now();

/* Awaited, because a case that returns a promise would otherwise be reported
 * as passing the moment it was called — with zero assertions run. A suite that
 * green-lights async tests it never waited for is worse than no suite. */
async function main() {
  for (const file of files) {
    const name = file.replace(/\.js$/, "");
    const suite = require(path.join(CASES, file));
    const cases = typeof suite === "function" ? { [name]: suite } : suite;

    console.log("\n" + BOLD + name + OFF);

    for (const [label, fn] of Object.entries(cases)) {
      const check = new Check(label);
      let thrown = null;
      try {
        await fn(check);
      } catch (e) {
        thrown = e;
      }
      assertions += check.count;

      if (thrown) {
        failed++;
        console.log("  " + RED + "ERROR" + OFF + " " + label);
        console.log("    " + String(thrown.stack || thrown).split("\n").slice(0, 4).join("\n    "));
      } else if (!check.count) {
        /* A test that asserts nothing is a broken test, not a passing one. */
        failed++;
        console.log("  " + RED + "EMPTY" + OFF + " " + label + "  asserted nothing");
      } else if (check.failures.length) {
        failed++;
        console.log("  " + RED + "FAIL " + OFF + " " + label +
                    DIM + "  (" + check.failures.length + "/" + check.count + ")" + OFF);
        for (const f of check.failures) console.log("    " + RED + "\u2717" + OFF + " " + f);
      } else {
        passed++;
        console.log("  " + GREEN + "ok   " + OFF + " " + label +
                    DIM + "  " + check.count + " checks" + OFF);
      }
    }
  }

  const ms = Date.now() - started;
  console.log("\n" + (failed ? RED : GREEN) + BOLD +
    passed + " passed, " + failed + " failed" + OFF +
    DIM + "  \u00b7 " + assertions + " assertions \u00b7 " + ms + "ms" + OFF + "\n");

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("\n" + RED + "the runner itself failed" + OFF + "\n" + (e.stack || e));
  process.exit(2);
});
