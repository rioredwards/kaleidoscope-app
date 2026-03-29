/* effects.js — Pure client-side image effect functions for p5.js */

/** 'bilinear' (soft) or 'nearest' (crisp pixels, no interpolation blur) */
let pixelSamplingMode = 'bilinear';

function setPixelSamplingMode(mode) {
  pixelSamplingMode = mode === 'nearest' ? 'nearest' : 'bilinear';
}

function bilinearSample(pixels, w, h, x, y) {
  const x0 = Math.max(0, Math.min(Math.floor(x), w - 1));
  const y0 = Math.max(0, Math.min(Math.floor(y), h - 1));
  const x1 = Math.min(x0 + 1, w - 1);
  const y1 = Math.min(y0 + 1, h - 1);
  const fx = x - Math.floor(x);
  const fy = y - Math.floor(y);

  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;

  const out = new Array(4);
  for (let c = 0; c < 4; c++) {
    out[c] =
      (1 - fx) * (1 - fy) * pixels[i00 + c] +
      fx * (1 - fy) * pixels[i10 + c] +
      (1 - fx) * fy * pixels[i01 + c] +
      fx * fy * pixels[i11 + c];
  }
  return out;
}

function nearestSample(pixels, w, h, x, y) {
  const xi = Math.max(0, Math.min(Math.round(x), w - 1));
  const yi = Math.max(0, Math.min(Math.round(y), h - 1));
  const i = (yi * w + xi) * 4;
  return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]];
}

function sampleRgba(pixels, w, h, x, y) {
  return pixelSamplingMode === 'nearest'
    ? nearestSample(pixels, w, h, x, y)
    : bilinearSample(pixels, w, h, x, y);
}

// ── Kaleidoscope ──────────────────────────────────────────────────────────────
// Folds the image radially into symmetric segments. Each segment mirrors a
// narrow angular slice of the source determined by cropSize.

function applyKaleidoscope(p, img, params) {
  const folds = parseInt(params.folds) || 8;
  const cropSize = parseFloat(params.cropSize) || 12;
  const w = img.width, h = img.height;
  const size = Math.min(w, h);
  const out = p.createImage(size, size);

  img.loadPixels();
  out.loadPixels();

  const ncx = parseFloat(params.centerX);
  const ncy = parseFloat(params.centerY);
  const cx =
    (Number.isFinite(ncx) ? Math.max(0, Math.min(1, ncx)) : 0.5) * w;
  const cy =
    (Number.isFinite(ncy) ? Math.max(0, Math.min(1, ncy)) : 0.5) * h;
  const ocx = size / 2, ocy = size / 2;
  const maxR = size / 2;
  const segAngle = (2 * Math.PI) / folds;
  const sourceSpan = (cropSize / 100) * 2 * Math.PI;

  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      const idx = (oy * size + ox) * 4;
      const dx = ox - ocx, dy = oy - ocy;
      const r = Math.sqrt(dx * dx + dy * dy);

      if (r > maxR) {
        out.pixels[idx] = out.pixels[idx + 1] = out.pixels[idx + 2] = 0;
        out.pixels[idx + 3] = 255;
        continue;
      }

      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += 2 * Math.PI;

      let segPos = angle % segAngle;
      if (segPos > segAngle / 2) segPos = segAngle - segPos;

      const frac = segPos / (segAngle / 2);
      const srcAngle = frac * sourceSpan;

      const sx = cx + r * Math.cos(srcAngle);
      const sy = cy + r * Math.sin(srcAngle);

      const [rv, gv, bv, av] = sampleRgba(img.pixels, w, h, sx, sy);
      out.pixels[idx] = rv;
      out.pixels[idx + 1] = gv;
      out.pixels[idx + 2] = bv;
      out.pixels[idx + 3] = av;
    }
  }

  out.updatePixels();
  return out;
}

// ── Mandala ───────────────────────────────────────────────────────────────────
// Crops to center square, composites 8 rotated copies with screen blending.

function applyMandala(p, img) {
  const w = img.width, h = img.height;
  const size = Math.min(w, h);
  const cropX = Math.floor((w - size) / 2);
  const cropY = Math.floor((h - size) / 2);
  const out = p.createImage(size, size);

  img.loadPixels();
  out.loadPixels();

  const half = size / 2;

  for (let oy = 0; oy < size; oy++) {
    for (let ox = 0; ox < size; ox++) {
      const dx = ox - half, dy = oy - half;
      let rAcc = 0, gAcc = 0, bAcc = 0;

      for (let i = 0; i < 8; i++) {
        const theta = (i * Math.PI) / 4;
        const cosT = Math.cos(theta), sinT = Math.sin(theta);
        const rx = dx * cosT + dy * sinT;
        const ry = -dx * sinT + dy * cosT;

        const sx = cropX + half + rx;
        const sy = cropY + half + ry;

        const [r, g, b] = sampleRgba(img.pixels, w, h, sx, sy);
        const rn = r / 255, gn = g / 255, bn = b / 255;

        if (i === 0) {
          rAcc = rn; gAcc = gn; bAcc = bn;
        } else {
          rAcc = 1 - (1 - rAcc) * (1 - rn);
          gAcc = 1 - (1 - gAcc) * (1 - gn);
          bAcc = 1 - (1 - bAcc) * (1 - bn);
        }
      }

      const idx = (oy * size + ox) * 4;
      out.pixels[idx] = Math.round(rAcc * 255);
      out.pixels[idx + 1] = Math.round(gAcc * 255);
      out.pixels[idx + 2] = Math.round(bAcc * 255);
      out.pixels[idx + 3] = 255;
    }
  }

  out.updatePixels();
  return out;
}

// ── Edge Detection (Sobel) ────────────────────────────────────────────────────
// 3x3 Sobel convolution per channel, magnitude negated.

function applyEdgeDetect(p, img) {
  const w = img.width, h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();

  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sxR = 0, syR = 0, sxG = 0, syG = 0, sxB = 0, syB = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(Math.max(x + kx, 0), w - 1);
          const py = Math.min(Math.max(y + ky, 0), h - 1);
          const ki = (ky + 1) * 3 + (kx + 1);
          const pi = (py * w + px) * 4;

          sxR += img.pixels[pi] * gx[ki];
          syR += img.pixels[pi] * gy[ki];
          sxG += img.pixels[pi + 1] * gx[ki];
          syG += img.pixels[pi + 1] * gy[ki];
          sxB += img.pixels[pi + 2] * gx[ki];
          syB += img.pixels[pi + 2] * gy[ki];
        }
      }

      const idx = (y * w + x) * 4;
      out.pixels[idx] = 255 - Math.min(Math.sqrt(sxR * sxR + syR * syR), 255);
      out.pixels[idx + 1] = 255 - Math.min(Math.sqrt(sxG * sxG + syG * syG), 255);
      out.pixels[idx + 2] = 255 - Math.min(Math.sqrt(sxB * sxB + syB * syB), 255);
      out.pixels[idx + 3] = 255;
    }
  }

  out.updatePixels();
  return out;
}

// ── High Contrast (Sigmoidal) ─────────────────────────────────────────────────
// Per-channel sigmoidal contrast: 1 / (1 + exp(-contrast * (x - 0.5)))

function applyHighContrast(p, img, params) {
  const contrast = parseFloat(params.contrast) || 5;
  const w = img.width, h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();

  for (let i = 0; i < img.pixels.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const x = img.pixels[i + c] / 255;
      out.pixels[i + c] = Math.round(255 / (1 + Math.exp(-contrast * (x - 0.5))));
    }
    out.pixels[i + 3] = img.pixels[i + 3];
  }

  out.updatePixels();
  return out;
}

// ── Barrel Distortion ─────────────────────────────────────────────────────────
// Radial distortion: r_new = r * (1 - strength * r^2); remap via sampleRgba (smooth or nearest).

function applyBarrel(p, img, params) {
  const strength = parseFloat(params.strength) || 0.3;
  const w = img.width, h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();

  const cx = w / 2, cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  for (let oy = 0; oy < h; oy++) {
    for (let ox = 0; ox < w; ox++) {
      const idx = (oy * w + ox) * 4;
      const dx = (ox - cx) / maxR;
      const dy = (oy - cy) / maxR;
      const r = Math.sqrt(dx * dx + dy * dy);

      if (r === 0) {
        for (let c = 0; c < 4; c++) out.pixels[idx + c] = img.pixels[idx + c];
        continue;
      }

      const rNew = r * (1 - strength * r * r);
      const sx = cx + (rNew / r) * (ox - cx);
      const sy = cy + (rNew / r) * (oy - cy);

      const [rv, gv, bv, av] = sampleRgba(img.pixels, w, h, sx, sy);
      out.pixels[idx] = rv;
      out.pixels[idx + 1] = gv;
      out.pixels[idx + 2] = bv;
      out.pixels[idx + 3] = av;
    }
  }

  out.updatePixels();
  return out;
}

// ── Sharpen (Unsharp Mask) ────────────────────────────────────────────────────
// 3x3 Gaussian blur, then original + amount * (original - blurred).

function applySharpen(p, img, params) {
  const amount = parseFloat(params.amount) || 2;
  const w = img.width, h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();

  const kernel = [1 / 16, 2 / 16, 1 / 16, 2 / 16, 4 / 16, 2 / 16, 1 / 16, 2 / 16, 1 / 16];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let blurR = 0, blurG = 0, blurB = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.min(Math.max(x + kx, 0), w - 1);
          const py = Math.min(Math.max(y + ky, 0), h - 1);
          const ki = (ky + 1) * 3 + (kx + 1);
          const pi = (py * w + px) * 4;

          blurR += img.pixels[pi] * kernel[ki];
          blurG += img.pixels[pi + 1] * kernel[ki];
          blurB += img.pixels[pi + 2] * kernel[ki];
        }
      }

      const idx = (y * w + x) * 4;
      out.pixels[idx] = Math.max(0, Math.min(255, Math.round(img.pixels[idx] + amount * (img.pixels[idx] - blurR))));
      out.pixels[idx + 1] = Math.max(0, Math.min(255, Math.round(img.pixels[idx + 1] + amount * (img.pixels[idx + 1] - blurG))));
      out.pixels[idx + 2] = Math.max(0, Math.min(255, Math.round(img.pixels[idx + 2] + amount * (img.pixels[idx + 2] - blurB))));
      out.pixels[idx + 3] = img.pixels[idx + 3];
    }
  }

  out.updatePixels();
  return out;
}

// ── Blend (two layers: base = source, top = second image) ────────────────────

function clamp01ch(x) {
  return Math.max(0, Math.min(1, x));
}

function blendChannel(Cb, Cs, mode) {
  const B = clamp01ch(Cb);
  const S = clamp01ch(Cs);
  switch (mode) {
    case 'multiply':
      return B * S;
    case 'screen':
      return 1 - (1 - B) * (1 - S);
    case 'overlay':
      return S < 0.5 ? 2 * B * S : 1 - 2 * (1 - B) * (1 - S);
    case 'darken':
      return Math.min(B, S);
    case 'lighten':
      return Math.max(B, S);
    case 'hard_light':
      if (S <= 0.5) return 2 * B * S;
      return 1 - (1 - B) * (2 * S - 1);
    case 'soft_light':
      if (S <= 0.5) return B - (1 - 2 * S) * B * (1 - B);
      return B + (2 * S - 1) * (Math.sqrt(B) - B);
    case 'difference':
      return Math.abs(B - S);
    case 'exclusion':
      return B + S - 2 * B * S;
    case 'color_dodge':
      if (S >= 1) return 1;
      if (S <= 0) return B;
      return Math.min(1, B / (1 - S));
    case 'color_burn':
      if (S <= 0) return 0;
      if (S >= 1) return 1;
      return Math.max(0, 1 - (1 - B) / S);
    default:
      return B * S;
  }
}

function applyBlend(p, base, params) {
  const top = params._topImage;
  if (!top) {
    const c = p.createImage(base.width, base.height);
    c.copy(base, 0, 0, base.width, base.height, 0, 0, base.width, base.height);
    return c;
  }

  const mode = (params.blendMode || 'multiply').replace(/-/g, '_');
  let opacity = parseFloat(params.opacity);
  if (!Number.isFinite(opacity)) opacity = 0.85;
  opacity = Math.max(0, Math.min(1, opacity));

  const w = base.width;
  const h = base.height;
  const tw = top.width;
  const th = top.height;

  base.loadPixels();
  top.loadPixels();
  const out = p.createImage(w, h);
  out.loadPixels();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w) * tw;
      const v = ((y + 0.5) / h) * th;
      const [tr, tg, tb, ta] = sampleRgba(top.pixels, tw, th, u, v);
      const bi = (y * w + x) * 4;
      const Br = base.pixels[bi] / 255;
      const Bg = base.pixels[bi + 1] / 255;
      const Bb = base.pixels[bi + 2] / 255;
      const Sr = tr / 255;
      const Sg = tg / 255;
      const Sb = tb / 255;
      const a = (ta / 255) * opacity;
      const blendR = blendChannel(Br, Sr, mode);
      const blendG = blendChannel(Bg, Sg, mode);
      const blendB = blendChannel(Bb, Sb, mode);
      const outR = blendR * a + Br * (1 - a);
      const outG = blendG * a + Bg * (1 - a);
      const outB = blendB * a + Bb * (1 - a);
      out.pixels[bi] = Math.round(clamp01ch(outR) * 255);
      out.pixels[bi + 1] = Math.round(clamp01ch(outG) * 255);
      out.pixels[bi + 2] = Math.round(clamp01ch(outB) * 255);
      out.pixels[bi + 3] = base.pixels[bi + 3];
    }
  }

  out.updatePixels();
  return out;
}

// ── Registry ──────────────────────────────────────────────────────────────────

export const EFFECTS = {
  kaleidoscope: applyKaleidoscope,
  mandala: applyMandala,
  edge_detect: applyEdgeDetect,
  high_contrast: applyHighContrast,
  barrel: applyBarrel,
  sharpen: applySharpen,
  blend: applyBlend,
};

window.setPixelSamplingMode = setPixelSamplingMode;
