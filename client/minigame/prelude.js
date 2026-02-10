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

  // Phaser and other libs may probe DOM constructors via `instanceof`.
  // WeChat minigame doesn't provide these, so we alias them to runtime equivalents.
  if (!g.HTMLElement) {
    g.HTMLElement = function HTMLElement() {};
  }
  if (!g.HTMLCanvasElement) {
    // If wx.createCanvas() provides a constructor, reuse it so `canvas instanceof HTMLCanvasElement` works.
    g.HTMLCanvasElement = canvas && canvas.constructor ? canvas.constructor : function HTMLCanvasElement() {};
  }
  if (!g.HTMLImageElement) {
    g.HTMLImageElement = g.Image;
  }
  if (!g.OffscreenCanvas) {
    g.OffscreenCanvas = g.HTMLCanvasElement;
  }
  if (!g.CanvasRenderingContext2D) {
    g.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
  }

  function createElement(tag) {
    const t = String(tag).toLowerCase();
    if (t === "canvas") return canvas || {};
    if (t === "img" || t === "image") return wxApi && wxApi.createImage ? wxApi.createImage() : {};
    // generic element stub
    return { style: {} };
  }

  function ensureDocumentElement(doc) {
    /** @type {any} */
    let de;
    try {
      de = doc.documentElement;
    } catch (e) {
      de = undefined;
    }

    if (!de) {
      de = { style: {}, clientWidth: 0, clientHeight: 0 };
      // Some runtimes may expose a read-only `documentElement`. Try to override safely.
      try {
        doc.documentElement = de;
      } catch (e) {
        // ignore
      }
      try {
        if (!doc.documentElement) {
          Object.defineProperty(doc, "documentElement", { value: de, configurable: true });
        }
      } catch (e) {
        // ignore
      }
    }

    // Ensure style exists without assuming writeable property.
    try {
      if (de && !de.style) de.style = {};
    } catch (e) {
      // ignore
    }

    return de || { style: {} };
  }

  if (!g.document) {
    g.document = {};
  }

  // Don't assume we can freely mutate built-in document; guard everything.
  try {
    g.document.body = g.document.body || {};
  } catch (e) {
    // ignore
  }

  ensureDocumentElement(g.document);

  try {
    if (!g.document.createElement) g.document.createElement = createElement;
  } catch (e) {
    // ignore
  }
  try {
    if (!g.document.addEventListener) g.document.addEventListener = function () {};
    if (!g.document.removeEventListener) g.document.removeEventListener = function () {};
  } catch (e) {
    // ignore
  }

  g.window.addEventListener = g.window.addEventListener || function () {};
  g.window.removeEventListener = g.window.removeEventListener || function () {};
})();

