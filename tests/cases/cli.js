/* The build script is run by CI and by anyone working on Peek, so its command
 * line is part of the product. This exists because `npm run check` died in CI
 * with "invalid choice: []" while working perfectly on the machine it was
 * written on: argparse in Python 3.11 and earlier validates the empty default
 * of nargs="*" against choices=, and 3.12 does not. Testing the functions
 * would not have caught it. Running the command does. */
const { execFileSync } = require("child_process");
const path = require("path");
const { ROOT } = require("../harness");

function run(args) {
  try {
    const out = execFileSync("python3", [path.join(ROOT, "build.py")].concat(args),
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out };
  } catch (e) {
    return { code: e.status == null ? -1 : e.status, out: String(e.stdout || "") + String(e.stderr || "") };
  }
}

module.exports = {
  "every invocation CI uses works"(t) {
    for (const args of [[], ["--check"], ["firefox"], ["chrome"], ["firefox", "chrome"]]) {
      const r = run(args);
      t.equal(r.code, 0, "build.py " + args.join(" ") + " exited " + r.code + "\n      " + r.out.trim());
    }
  },

  "a stale committed build fails --check"(t) {
    const fs = require("fs");
    const victim = path.join(ROOT, "Firefox", "src", "common", "log.js");
    const original = fs.readFileSync(victim, "utf8");
    try {
      fs.writeFileSync(victim, original + "\n// drift\n");
      const r = run(["--check"]);
      t.ok(r.code !== 0, "--check should fail when a build is out of date");
      t.match(r.out, /out of date|differs/, "and should say which file");
    } finally {
      fs.writeFileSync(victim, original);
    }
    t.equal(run(["--check"]).code, 0, "and pass again once restored");
  },

  "an unknown target is rejected"(t) {
    const r = run(["safari"]);
    t.ok(r.code !== 0, "an unsupported browser should not silently build nothing");
    t.match(r.out, /unknown browser/i, "and should say so");
  }
};
