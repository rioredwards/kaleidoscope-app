/* effects.js: Pure client-side image effect functions for p5.js */

export const MAX_OUTPUT_DIM = 8192;

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
      return B < 0.5 ? 2 * B * S : 1 - 2 * (1 - B) * (1 - S);
    case 'darken':
      return Math.min(B, S);
    case 'lighten':
      return Math.max(B, S);
    case 'hard_light':
      if (S <= 0.5) return 2 * B * S;
      return 1 - 2 * (1 - B) * (1 - S);
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
      if (B >= 1) return 1;
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

// ── Seeded PRNG (stable presets / reproducible glitch) ────────────────────────

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s) {
  if (s == null || s === '') return 1337;
  if (typeof s === 'number' && Number.isFinite(s)) return (Math.floor(s) >>> 0) || 1;
  const str = String(s).trim();
  const asNum = Number(str);
  if (str !== '' && Number.isFinite(asNum) && String(asNum) === str) {
    return (Math.floor(asNum) >>> 0) || 1;
  }
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── Invert ───────────────────────────────────────────────────────────────────

function applyInvert(p, img, params) {
  const t = parseFloat(params.strength);
  const strength = Number.isFinite(t) ? Math.max(0, Math.min(1, t)) : 1;
  const w = img.width;
  const h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();
  for (let i = 0; i < img.pixels.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = img.pixels[i + c];
      out.pixels[i + c] = Math.round(v + strength * (255 - 2 * v));
    }
    out.pixels[i + 3] = img.pixels[i + 3];
  }
  out.updatePixels();
  return out;
}

// ── Tile (repeat image in a grid, output is larger) ─────────────────────────

function applyTile(p, img, params) {
  const maxOut = MAX_OUTPUT_DIM;
  let cols = Math.max(1, Math.min(12, parseInt(params.columns, 10) || 4));
  let rows = Math.max(1, Math.min(12, parseInt(params.rows, 10) || 4));
  const w = img.width;
  const h = img.height;
  cols = Math.min(cols, Math.max(1, Math.floor(maxOut / w)));
  rows = Math.min(rows, Math.max(1, Math.floor(maxOut / h)));
  const ow = w * cols;
  const oh = h * rows;
  const out = p.createImage(ow, oh);
  img.loadPixels();
  out.loadPixels();
  for (let oy = 0; oy < oh; oy++) {
    for (let ox = 0; ox < ow; ox++) {
      const sx = ox % w;
      const sy = oy % h;
      const si = (sy * w + sx) * 4;
      const di = (oy * ow + ox) * 4;
      out.pixels[di] = img.pixels[si];
      out.pixels[di + 1] = img.pixels[si + 1];
      out.pixels[di + 2] = img.pixels[si + 2];
      out.pixels[di + 3] = img.pixels[si + 3];
    }
  }
  out.updatePixels();
  return out;
}

// ── Glitch (horizontal slice shifts + RGB split + optional scanlines) ────────

function applyGlitch(p, img, params) {
  const intensity = Math.max(0, Math.min(100, parseFloat(params.intensity) || 55));
  const numSlices = Math.max(4, Math.min(64, parseInt(params.slices, 10) || 16));
  const rgbSplit = Math.max(0, Math.min(40, parseFloat(params.rgbSplit) || 6));
  const scan = Math.max(0, Math.min(100, parseFloat(params.scanlines) || 0));
  const seed = hashSeed(params.seed != null ? params.seed : 'glitch');
  const rand = mulberry32(seed);
  const w = img.width;
  const h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();

  const maxShift = Math.max(1, Math.floor((intensity / 100) * Math.min(w, h) * 0.22));
  const sliceH = h / numSlices;
  const offsets = new Int32Array(numSlices);
  for (let i = 0; i < numSlices; i++) {
    offsets[i] = Math.floor((rand() * 2 - 1) * maxShift);
  }

  for (let y = 0; y < h; y++) {
    const si = Math.min(numSlices - 1, Math.floor(y / sliceH));
    const dx = offsets[si];
    const scanDim =
      scan > 0 && (y & 1) === 0 ? 1 - scan / 200 : 1;

    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const xr = x + dx + rgbSplit;
      const xg = x + dx;
      const xb = x + dx - rgbSplit;
      const [r0, , , a0] = sampleRgba(img.pixels, w, h, xr, y);
      const [, g1, ,] = sampleRgba(img.pixels, w, h, xg, y);
      const [, , b2,] = sampleRgba(img.pixels, w, h, xb, y);

      out.pixels[idx] = Math.round(r0 * scanDim);
      out.pixels[idx + 1] = Math.round(g1 * scanDim);
      out.pixels[idx + 2] = Math.round(b2 * scanDim);
      out.pixels[idx + 3] = a0;
    }
  }

  out.updatePixels();
  return out;
}

// ── Wave warp (trippy UV displacement) ───────────────────────────────────────

function applyWaveWarp(p, img, params) {
  const amp = Math.max(0, Math.min(80, parseFloat(params.amplitude) || 14));
  const f = Math.max(0.005, Math.min(4, parseFloat(params.frequency) || 0.12));
  const swirl = Math.max(0, Math.min(1, parseFloat(params.swirl) || 0.35));
  const w = img.width;
  const h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();
  const cx = w / 2;
  const cy = h / 2;
  const m = Math.max(1, Math.max(w, h));
  /** Phase per pixel so `f` ≈ waves across the image (not radians/px). */
  const k = (2 * Math.PI * f) / m;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const nx = (x - cx) / m;
      const ny = (y - cy) / m;
      let sx =
        x +
        amp * Math.sin(y * k * 0.45) +
        amp * 0.6 * Math.cos(x * k * 0.38 + y * k * 0.2);
      let sy =
        y +
        amp * Math.cos(x * k * 0.42) +
        amp * 0.55 * Math.sin(y * k * 0.36 + x * k * 0.18);
      sx += swirl * amp * (-ny) * Math.sin(nx * 6 + ny * 6);
      sy += swirl * amp * nx * Math.cos(nx * 6 - ny * 6);

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

// ── Noise burst (digital grain / chaos) ───────────────────────────────────────

function applyNoiseBurst(p, img, params) {
  const amount = Math.max(0, Math.min(100, parseFloat(params.amount) || 35));
  const seed = hashSeed(params.seed != null ? params.seed : 'noise');
  const rand = mulberry32(seed);
  const cn = params.colorNoise;
  const colorNoise =
    cn === 'color' || cn === 'true' || cn === true || cn === '1' ? 1 : 0;
  const w = img.width;
  const h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();
  const a = amount / 100;

  for (let i = 0; i < img.pixels.length; i += 4) {
    const n = rand();
    const m = (n - 0.5) * 2 * 255 * a;
    if (colorNoise > 0) {
      out.pixels[i] = Math.max(0, Math.min(255, Math.round(img.pixels[i] + m * rand())));
      out.pixels[i + 1] = Math.max(0, Math.min(255, Math.round(img.pixels[i + 1] + m * rand())));
      out.pixels[i + 2] = Math.max(0, Math.min(255, Math.round(img.pixels[i + 2] + m * rand())));
    } else {
      const g = m * 0.9;
      out.pixels[i] = Math.max(0, Math.min(255, Math.round(img.pixels[i] + g)));
      out.pixels[i + 1] = Math.max(0, Math.min(255, Math.round(img.pixels[i + 1] + g)));
      out.pixels[i + 2] = Math.max(0, Math.min(255, Math.round(img.pixels[i + 2] + g)));
    }
    out.pixels[i + 3] = img.pixels[i + 3];
  }

  out.updatePixels();
  return out;
}

// ── RGB ↔ HSL + linear contrast (color adjust) ─────────────────────────────

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [h * 360, s, l];
}

function hslToRgb(hDeg, s, l) {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

function linearContrastByte(v, factor) {
  const x = v / 255;
  const y = (x - 0.5) * factor + 0.5;
  return Math.max(0, Math.min(255, Math.round(y * 255)));
}

function mixByte(a, b, t) {
  return Math.max(0, Math.min(255, Math.round(a + (b - a) * t)));
}

/** Hue shift + saturation in HSL, additive brightness on RGB, then per-channel contrast. */
function applyColorAdjust(p, img, params) {
  let contrast = parseFloat(params.contrast);
  if (!Number.isFinite(contrast)) contrast = 1;
  contrast = Math.max(0.05, Math.min(3, contrast));

  let saturation = parseFloat(params.saturation);
  if (!Number.isFinite(saturation)) saturation = 1;
  saturation = Math.max(0, Math.min(3, saturation));

  let brightness = parseFloat(params.brightness);
  if (!Number.isFinite(brightness)) brightness = 0;
  brightness = Math.max(-100, Math.min(100, brightness));

  const hueRaw = params.hueShift ?? params.hue;
  let deltaDeg = parseFloat(String(hueRaw ?? '').replace(/°\s*$/, ''));
  if (!Number.isFinite(deltaDeg)) deltaDeg = 0;

  const w = img.width;
  const h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();

  for (let i = 0; i < img.pixels.length; i += 4) {
    const a = img.pixels[i + 3];
    let [H, S, L] = rgbToHsl(img.pixels[i], img.pixels[i + 1], img.pixels[i + 2]);
    H = ((H + deltaDeg) % 360 + 360) % 360;
    S = Math.max(0, Math.min(1, S * saturation));
    let [r, g, b] = hslToRgb(H, S, L);
    r = Math.max(0, Math.min(255, r + brightness));
    g = Math.max(0, Math.min(255, g + brightness));
    b = Math.max(0, Math.min(255, b + brightness));
    out.pixels[i] = linearContrastByte(r, contrast);
    out.pixels[i + 1] = linearContrastByte(g, contrast);
    out.pixels[i + 2] = linearContrastByte(b, contrast);
    out.pixels[i + 3] = a;
  }

  out.updatePixels();
  return out;
}

// ── Colorize (tint grayscale or blend toward a chosen hue) ───────────────────

function applyColorize(p, img, params) {
  let hue = parseFloat(String(params.hue ?? params.hueShift ?? '').replace(/°\s*$/, ''));
  if (!Number.isFinite(hue)) hue = 220;
  hue = ((hue % 360) + 360) % 360;

  let saturation = parseFloat(params.saturation);
  if (!Number.isFinite(saturation)) saturation = 1;
  saturation = Math.max(0, Math.min(1, saturation));

  let amount = parseFloat(params.amount);
  if (!Number.isFinite(amount)) amount = 1;
  amount = Math.max(0, Math.min(1, amount));

  const w = img.width;
  const h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();

  for (let i = 0; i < img.pixels.length; i += 4) {
    const r0 = img.pixels[i];
    const g0 = img.pixels[i + 1];
    const b0 = img.pixels[i + 2];
    const a = img.pixels[i + 3];
    const [, , lightness] = rgbToHsl(r0, g0, b0);
    const [rt, gt, bt] = hslToRgb(hue, saturation, lightness);
    out.pixels[i] = mixByte(r0, rt, amount);
    out.pixels[i + 1] = mixByte(g0, gt, amount);
    out.pixels[i + 2] = mixByte(b0, bt, amount);
    out.pixels[i + 3] = a;
  }

  out.updatePixels();
  return out;
}

// ── Chromatic aberration (directional RGB separation) ────────────────────────

function applyChromatic(p, img, params) {
  const offset = Math.max(1, Math.min(35, parseFloat(params.offset) || 8));
  const angle = parseFloat(params.angle);
  const rad = Number.isFinite(angle) ? (angle * Math.PI) / 180 : 0;
  const dx = Math.cos(rad) * offset;
  const dy = Math.sin(rad) * offset;
  const w = img.width;
  const h = img.height;
  const out = p.createImage(w, h);
  img.loadPixels();
  out.loadPixels();

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const [r] = sampleRgba(img.pixels, w, h, x - dx, y - dy);
      const [, g, , a0] = sampleRgba(img.pixels, w, h, x, y);
      const [, , b] = sampleRgba(img.pixels, w, h, x + dx, y + dy);
      out.pixels[idx] = r;
      out.pixels[idx + 1] = g;
      out.pixels[idx + 2] = b;
      out.pixels[idx + 3] = a0;
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
  invert: applyInvert,
  tile: applyTile,
  glitch: applyGlitch,
  wave_warp: applyWaveWarp,
  noise_burst: applyNoiseBurst,
  chromatic: applyChromatic,
  color_adjust: applyColorAdjust,
  colorize: applyColorize,
};

window.setPixelSamplingMode = setPixelSamplingMode;
