/* p5-canvas.js — p5.js instance-mode sketch managing the result canvas */

const resultSketch = (p) => {
  const MAX_PREVIEW = 600;
  let sourceImg = null;
  let resultImg = null;
  let sourceLoading = false;
  let pendingEffect = null;
  let rafPending = false;

  function downscale(img) {
    if (img.width <= MAX_PREVIEW && img.height <= MAX_PREVIEW) return img;
    const scale = MAX_PREVIEW / Math.max(img.width, img.height);
    const nw = Math.round(img.width * scale);
    const nh = Math.round(img.height * scale);
    const resized = p.createImage(nw, nh);
    resized.copy(img, 0, 0, img.width, img.height, 0, 0, nw, nh);
    return resized;
  }

  p.setup = () => {
    const container = document.getElementById('resultCanvas');
    const canvas = p.createCanvas(container.clientWidth, container.clientHeight);
    canvas.parent(container);
    p.noLoop();
  };

  p.draw = () => {
    p.background(17);
    if (resultImg) {
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

  const api = {
    loadSourceImage(src) {
      sourceLoading = true;
      p.loadImage(
        src,
        (loaded) => {
          sourceImg = downscale(loaded);
          sourceLoading = false;
          if (pendingEffect) {
            const pe = pendingEffect;
            pendingEffect = null;
            api.applyEffect(pe.effectId, pe.params);
          }
        },
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
        const fn = EFFECTS[effectId];
        if (fn) {
          resultImg = fn(p, sourceImg, params);
          p.redraw();
        }
        rafPending = false;
      });
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
