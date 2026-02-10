// Minimal WeChat Mini Game polyfills for Phaser runtime.
// We deliberately keep this small and avoid heavy DOM shims.

type WxApi = {
  getSystemInfoSync?: () => { windowWidth: number; windowHeight: number; pixelRatio?: number };
  createCanvas?: () => any;
};

declare const wx: WxApi | undefined;

export function initWechatPolyfill() {
  const g: any = globalThis as any;
  g.window = g.window ?? g;
  g.self = g.self ?? g.window;
  g.global = g.global ?? g.window;

  // requestAnimationFrame / cancelAnimationFrame exist in most runtimes.
  g.requestAnimationFrame = g.requestAnimationFrame ?? ((cb: any) => setTimeout(() => cb(Date.now()), 16));
  g.cancelAnimationFrame = g.cancelAnimationFrame ?? ((id: any) => clearTimeout(id));

  // A very small "document" stub: Phaser may probe existence.
  g.document = g.document ?? {
    addEventListener() {},
    removeEventListener() {},
    body: {}
  };

  // Provide a consistent canvas source.
  const sys = wx?.getSystemInfoSync?.();
  const width = sys?.windowWidth ?? 375;
  const height = sys?.windowHeight ?? 667;
  const pixelRatio = sys?.pixelRatio ?? 2;

  const canvas = wx?.createCanvas?.() ?? undefined;

  return { width, height, pixelRatio, canvas };
}

