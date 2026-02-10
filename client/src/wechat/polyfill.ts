// Minimal WeChat Mini Game polyfills for Phaser runtime.
// We deliberately keep this small and avoid heavy DOM shims.

type WxApi = {
  getSystemInfoSync?: () => { windowWidth: number; windowHeight: number; pixelRatio?: number };
  createCanvas?: () => any;
  createImage?: () => any;
};

declare const wx: WxApi | undefined;

export function initWechatPolyfill() {
  const g: any = globalThis as any;
  // In WeChat DevTools, `window` may be a read-only getter. Only assign when missing.
  try {
    if (typeof g.window === "undefined") g.window = g;
  } catch {}
  try {
    if (typeof g.self === "undefined") g.self = g.window ?? g;
  } catch {}
  try {
    if (typeof g.global === "undefined") g.global = g.window ?? g;
  } catch {}

  try {
    g.navigator = g.navigator ?? { userAgent: "wechat-minigame", maxTouchPoints: 10 };
  } catch {}
  try {
    g.location = g.location ?? { href: "wxgame://local" };
  } catch {}
  try {
    g.performance = g.performance ?? { now: () => Date.now() };
  } catch {}

  // requestAnimationFrame / cancelAnimationFrame exist in most runtimes.
  g.requestAnimationFrame = g.requestAnimationFrame ?? ((cb: any) => setTimeout(() => cb(Date.now()), 16));
  g.cancelAnimationFrame = g.cancelAnimationFrame ?? ((id: any) => clearTimeout(id));

  // Provide a consistent canvas source.
  const sys = wx?.getSystemInfoSync?.();
  const width = sys?.windowWidth ?? 375;
  const height = sys?.windowHeight ?? 667;
  const pixelRatio = sys?.pixelRatio ?? 2;

  const canvas = wx?.createCanvas?.() ?? undefined;
  if (canvas) {
    g.canvas = g.canvas ?? canvas; // some libs probe global `canvas`
  }

  // Image stub for Phaser/loader. Even if we don't load assets in v0,
  // Phaser may probe `Image` existence on boot.
  if (!g.Image) {
    const factory = wx?.createImage?.bind(wx);
    g.Image = function Image() {
      return factory ? factory() : {};
    };
  }

  // A tiny "document" stub Phaser expects.
  if (!g.document) {
    g.document = {
      body: {},
      addEventListener() {},
      removeEventListener() {},
      createElement(tag: string) {
        const t = String(tag).toLowerCase();
        if (t === "canvas") return canvas ?? {};
        if (t === "img" || t === "image") return wx?.createImage?.() ?? {};
        return {};
      }
    };
  } else {
    g.document.body = g.document.body ?? {};
    g.document.createElement =
      g.document.createElement ??
      ((tag: string) => {
        const t = String(tag).toLowerCase();
        if (t === "canvas") return canvas ?? {};
        if (t === "img" || t === "image") return wx?.createImage?.() ?? {};
        return {};
      });
    g.document.addEventListener = g.document.addEventListener ?? (() => {});
    g.document.removeEventListener = g.document.removeEventListener ?? (() => {});
  }

  return { width, height, pixelRatio, canvas };
}

