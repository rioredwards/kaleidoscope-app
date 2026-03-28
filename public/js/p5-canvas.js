/* p5-canvas.js — p5.js instance-mode sketch managing the result canvas */

const resultSketch = (p) => {
  const ABS_MAX_DIM = 8192;
  let options = {
    sharpPixels: false,
    /** 0 = use ABS_MAX_DIM as cap (full-res path) */
    maxPreviewPx: 600,
  };
  let lastSrc = null;
  let sourceImg = null;
  let resultImg = null;
  let sourceLoading = false;
  let pendingEffect = null;
  let rafPending = false;

  let api;

  function effectiveMaxDim() {
    const m = options.maxPreviewPx;
    if (!m || m <= 0) return ABS_MAX_DIM;
    return Math.min(m, ABS_MAX_DIM);
  }

  function downscaleNearest(img, nw, nh) {
    const w = img.width;
    const h = img.height;
    const out = p.createImage(nw, nh);
    img.loadPixels();
    out.loadPixels();
    for (let oy = 0; oy < nh; oy++) {
      for (let ox = 0; ox < nw; ox++) {
        const sx = Math.min(w - 1, Math.floor(((ox + 0.5) * w) / nw));
        const sy = Math.min(h - 1, Math.floor(((oy + 0.5) * h) / nh));
        const si = (sy * w + sx) * 4;
        const di = (oy * nw + ox) * 4;
        out.pixels[di] = img.pixels[si];
        out.pixels[di + 1] = img.pixels[si + 1];
        out.pixels[di + 2] = img.pixels[si + 2];
        out.pixels[di + 3] = img.pixels[si + 3];
      }
    }
    out.updatePixels();
    return out;
  }

  function downscale(img) {
    const maxDim = effectiveMaxDim();
    if (img.width <= maxDim && img.height <= maxDim) return img;
    const scale = maxDim / Math.max(img.width, img.height);
    const nw = Math.max(1, Math.round(img.width * scale));
    const nh = Math.max(1, Math.round(img.height * scale));
    if (options.sharpPixels) {
      return downscaleNearest(img, nw, nh);
    }
    const resized = p.createImage(nw, nh);
    resized.copy(img, 0, 0, img.width, img.height, 0, 0, nw, nh);
    return resized;
  }

  function syncSamplingMode() {
    if (typeof window.setPixelSamplingMode === 'function') {
      window.setPixelSamplingMode(options.sharpPixels ? 'nearest' : 'bilinear');
    }
  }

  function onSourceLoaded(loaded) {
    sourceImg = downscale(loaded);
    sourceLoading = false;
    if (pendingEffect) {
      const pe = pendingEffect;
      pendingEffect = null;
      api.applyEffect(pe.effectId, pe.params);
    }
  }

  p.setup = () => {
    const container = document.getElementById('resultCanvas');
    p.pixelDensity(1);
    const canvas = p.createCanvas(container.clientWidth, container.clientHeight);
    canvas.parent(container);
    p.noLoop();

    if (typeof ResizeObserver !== 'undefined' && container) {
      const ro = new ResizeObserver(() => {
        p.windowResized();
      });
      ro.observe(container);
    }
  };

  p.draw = () => {
    p.background(17);
    if (resultImg) {
      if (options.sharpPixels) {
        p.noSmooth();
      } else {
        p.smooth();
      }
      const scale = Math.min(p.width / resultImg.width, p.height / resultImg.height);
      const dw = resultImg.width * scale;
      const dh = resultImg.height * scale;
      p.image(resultImg, (p.width - dw) / 2, (p.height - dh) / 2, dw, dh);
    }
  };

  p.windowResized = () => {
    const container = document.getElementById('resultCanvas');
    if (container) {
      p.resizeCanvas(container.clientWidth, container.clientHeight);
      p.redraw();
    }
  };

  api = {
    loadSourceImage(src) {
      lastSrc = src;
      sourceLoading = true;
      p.loadImage(
        src,
        onSourceLoaded,
        () => {
          sourceLoading = false;
          console.error('Failed to load source image');
        }
      );
    },

    applyEffect(effectId, params) {
      if (sourceLoading) {
        pendingEffect = { effectId, params };
        return;
      }
      if (!sourceImg || rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        syncSamplingMode();
        const fn = EFFECTS[effectId];
        if (fn) {
          resultImg = fn(p, sourceImg, params);
          p.redraw();
        } else {
          console.warn('Unknown client effect:', effectId);
        }
        rafPending = false;
      });
    },

    setOptions(next) {
      options = { ...options, ...next };
      if (!lastSrc) return Promise.resolve();
      return new Promise((resolve, reject) => {
        sourceLoading = true;
        p.loadImage(
          lastSrc,
          (loaded) => {
            onSourceLoaded(loaded);
            resolve();
          },
          () => {
            sourceLoading = false;
            console.error('Failed to reload source image');
            reject(new Error('reload'));
          }
        );
      });
    },

    getOptions() {
      return { ...options };
    },

    getResultAsDataURL() {
      if (!resultImg) return null;
      resultImg.loadPixels();
      const c = document.createElement('canvas');
      c.width = resultImg.width;
      c.height = resultImg.height;
      const ctx = c.getContext('2d');
      const data = ctx.createImageData(resultImg.width, resultImg.height);
      data.data.set(resultImg.pixels);
      ctx.putImageData(data, 0, 0);
      return c.toDataURL('image/png');
    },

    hasResult() {
      return !!resultImg;
    },
  };

  window.resultP5 = api;
};

new p5(resultSketch);
