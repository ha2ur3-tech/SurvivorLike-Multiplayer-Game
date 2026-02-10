// Prelude polyfills that must run BEFORE loading Phaser.
// Phaser probes `document.documentElement` very early.
(function () {
  const g = /** @type {any} */ (globalThis);
  g.window = g.window || g;
  g.self = g.self || g.window;
  g.global = g.global || g.window;

  g.navigator = g.navigator || { userAgent: "wechat-minigame", maxTouchPoints: 10 };
  g.location = g.location || { href: "wxgame://local" };
  g.performance = g.performance || { now: () => Date.now() };

  g.requestAnimationFrame =
    g.requestAnimationFrame ||
    function (cb) {
      return setTimeout(() => cb(Date.now()), 16);
    };
  g.cancelAnimationFrame =
    g.cancelAnimationFrame ||
    function (id) {
      clearTimeout(id);
    };

  const wxApi = typeof wx !== "undefined" ? wx : undefined;
  const canvas = g.canvas || (wxApi && wxApi.createCanvas ? wxApi.createCanvas() : undefined);
  if (canvas) g.canvas = canvas;

  if (!g.Image) {
    g.Image = function Image() {
      return wxApi && wxApi.createImage ? wxApi.createImage() : {};
    };
  }

  function createElement(tag) {
    const t = String(tag).toLowerCase();
    if (t === "canvas") return canvas || {};
    if (t === "img" || t === "image") return wxApi && wxApi.createImage ? wxApi.createImage() : {};
    // generic element stub
    return { style: {} };
  }

  if (!g.document) {
    g.document = {
      body: {},
      documentElement: { style: {} },
      createElement,
      addEventListener() {},
      removeEventListener() {}
    };
  } else {
    g.document.body = g.document.body || {};
    g.document.documentElement = g.document.documentElement || {};
    g.document.documentElement.style = g.document.documentElement.style || {};
    g.document.createElement = g.document.createElement || createElement;
    g.document.addEventListener = g.document.addEventListener || function () {};
    g.document.removeEventListener = g.document.removeEventListener || function () {};
  }

  g.window.addEventListener = g.window.addEventListener || function () {};
  g.window.removeEventListener = g.window.removeEventListener || function () {};
})();

