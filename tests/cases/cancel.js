/* Moving on should stop the request, not just ignore the answer. Peek's whole
 * disclosure is "the site sees a request from your IP", so a fetch the user
 * has walked away from is a promise quietly broken. */
const { loadEngine, loadContent, fakeBrowser } = require("../harness");

/* A fetch that never settles until we let it, and records aborts. */
function stallingFetch() {
  const state = { started: [], aborted: [], release: null };
  const impl = (url, init) => new Promise((resolve, reject) => {
    state.started.push(url);
    const signal = init && init.signal;
    if (signal) {
      if (signal.aborted) return reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      signal.addEventListener("abort", () => {
        state.aborted.push(url);
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      });
    }
    state.release = () => resolve({
      ok: true, status: 200, url, type: "basic",
      headers: { get: (h) => (h.toLowerCase() === "content-type" ? "text/html" : "") },
      body: { getReader() { let d = false; return {
        read: async () => (d ? { done: true } : ((d = true), { done: false,
          value: Buffer.from("<html><head><title>x</title></head><body>y</body></html>", "utf8") })),
        cancel: async () => {} }; } }
    });
  });
  return { state, impl };
}

module.exports = {
  async "a cancelled lookup aborts the fetch"(t) {
    const { state, impl } = stallingFetch();
    const api = fakeBrowser({});
    const { P } = loadEngine({ globals: { browser: api, chrome: api, fetch: impl } });

    const running = P.pipeline.look("https://example.com/a", { id: 7 });
    await new Promise((r) => setTimeout(r, 10));
    t.equal(state.started.length, 1, "the fetch started");
    t.equal(P.inflight.count, 1, "one lookup registered as running");

    P.pipeline.cancel(7);
    const result = await running;
    t.equal(state.aborted.length, 1, "the fetch was aborted, not left running");
    t.ok(result.cancelled, "the lookup reports itself cancelled");
    t.equal(P.inflight.count, 0, "nothing left registered");
  },

  async "a third hover displaces the oldest instead of erroring"(t) {
    const { state, impl } = stallingFetch();
    const api = fakeBrowser({});
    const { P } = loadEngine({ globals: { browser: api, chrome: api, fetch: impl } });

    const first = P.pipeline.look("https://example.com/1", { id: 1 });
    const second = P.pipeline.look("https://example.com/2", { id: 2 });
    await new Promise((r) => setTimeout(r, 10));

    const third = P.pipeline.look("https://example.com/3", { id: 3 });
    await new Promise((r) => setTimeout(r, 10));

    const outcome = await first;
    t.ok(outcome.cancelled, "the oldest was cancelled to make room");
    t.notMatch(JSON.stringify(await Promise.race([third, Promise.resolve({})])),
      /Too many lookups/, "the newest hover is never refused");
    t.equal(state.started.length, 3, "all three were attempted in turn");

    P.pipeline.cancel(2); P.pipeline.cancel(3);
    await Promise.all([second, third]);
  },

  async "the content script calls off a lookup when the pointer moves"(t) {
    const cancels = [];
    const api = fakeBrowser({ reply: () => new Promise(() => {}) });
    const realSend = api.runtime.sendMessage;
    api.runtime.sendMessage = (msg) => {
      if (msg.type === "peek:cancel") { cancels.push(msg.id); return Promise.resolve(); }
      return realSend(msg);
    };

    const html = '<body><a id="a" href="https://a.example/x">A</a>' +
                 '<a id="b" href="https://b.example/y">B</a></body>';
    const ctx = loadContent({ url: "https://www.google.com/search?q=x", html,
                              globals: { browser: api, chrome: api } });

    ctx.P.hover.show(ctx.document.getElementById("a"));
    await new Promise((r) => setTimeout(r, 10));
    const first = ctx.P.hover.requestId;
    t.ok(first !== null, "a lookup is outstanding");

    ctx.P.hover.show(ctx.document.getElementById("b"));
    await new Promise((r) => setTimeout(r, 10));
    t.ok(cancels.includes(first), "moving to another link cancelled the first: " + JSON.stringify(cancels));

    ctx.P.hover.hide();
    await new Promise((r) => setTimeout(r, 10));
    t.equal(cancels.length, 2, "dismissing cancelled the second too");
  }
};
