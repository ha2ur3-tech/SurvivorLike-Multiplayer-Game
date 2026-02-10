// Minimal Open Data Context entry.
// v0: keep it empty; later we'll render friend/group leaderboard here.

const sharedCanvas = (typeof wx !== "undefined" && wx.getSharedCanvas) ? wx.getSharedCanvas() : null;
if (sharedCanvas) {
  const ctx = sharedCanvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, sharedCanvas.width, sharedCanvas.height);
  }
}

// Listen to messages from main domain (placeholder)
if (typeof wx !== "undefined" && wx.onMessage) {
  wx.onMessage((_data) => {
    // no-op for now
  });
}

