let baseImage = null;
let canvas = null;

function getFaviconLink() {
  return document.querySelector("link[rel~='icon']");
}

function loadBaseImage(href) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = href;
  });
}

/**
 * Draws (or clears) a small red dot in the corner of the current favicon
 * to indicate unread activity, without altering the underlying icon file.
 */
export async function updateFaviconBadge(showDot) {
  try {
    const link = getFaviconLink();
    if (!link) return;

    // Cache the clean base icon the first time, from its un-badged href.
    const baseHref = link.dataset.baseHref || link.href.split("?")[0];
    if (!link.dataset.baseHref) link.dataset.baseHref = baseHref;

    if (!baseImage || baseImage.src !== baseHref) {
      baseImage = await loadBaseImage(baseHref);
    }
    if (!canvas) canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(baseImage, 0, 0, 32, 32);

    if (showDot) {
      ctx.beginPath();
      ctx.arc(24, 8, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ef4444";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f1115";
      ctx.stroke();
    }

    link.href = canvas.toDataURL("image/png");
  } catch {
    // Icon may be cross-origin or still loading — badge is cosmetic, fail silently.
  }
}