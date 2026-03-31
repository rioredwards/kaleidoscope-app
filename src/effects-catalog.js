const effectCatalog = [
  {
    id: 'kaleidoscope',
    name: 'Kaleidoscope',
    category: 'symmetry',
    params: {
      folds: {
        default: 8,
        options: [
          { label: '6-fold', value: 6 },
          { label: '8-fold', value: 8 },
          { label: '12-fold', value: 12 },
        ],
      },
      cropSize: { default: 12, min: 1, max: 50, step: 1, suffix: '%' },
    },
  },
  {
    id: 'blend',
    name: 'Blend',
    category: 'layout',
    params: {
      blendMode: {
        default: 'multiply',
        options: [
          { label: 'Multiply', value: 'multiply' },
          { label: 'Screen', value: 'screen' },
          { label: 'Overlay', value: 'overlay' },
          { label: 'Darken', value: 'darken' },
          { label: 'Lighten', value: 'lighten' },
          { label: 'Hard light', value: 'hard_light' },
          { label: 'Soft light', value: 'soft_light' },
          { label: 'Difference', value: 'difference' },
          { label: 'Exclusion', value: 'exclusion' },
          { label: 'Color dodge', value: 'color_dodge' },
          { label: 'Color burn', value: 'color_burn' },
        ],
      },
      opacity: { default: 0.85, min: 0, max: 1, step: 0.05 },
    },
  },
  { id: 'edge_detect', name: 'Edge Detection', category: 'texture', params: {} },
  {
    id: 'high_contrast',
    name: 'High Contrast',
    category: 'color',
    params: { contrast: { default: 5, min: 1, max: 20, step: 0.5 } },
  },
  {
    id: 'barrel',
    name: 'Barrel Distortion',
    category: 'warp',
    params: { strength: { default: 0.3, min: 0, max: 1, step: 0.05 } },
  },
  {
    id: 'sharpen',
    name: 'Sharpen',
    category: 'texture',
    params: { amount: { default: 2, min: 0.5, max: 10, step: 0.5 } },
  },
  {
    id: 'invert',
    name: 'Invert',
    category: 'color',
    params: { strength: { default: 1, min: 0, max: 1, step: 0.05 } },
  },
  {
    id: 'tile',
    name: 'Tile (repeat grid)',
    category: 'layout',
    params: {
      columns: { default: 4, min: 1, max: 12, step: 1 },
      rows: { default: 4, min: 1, max: 12, step: 1 },
    },
  },
  {
    id: 'glitch',
    name: 'Glitch',
    category: 'texture',
    params: {
      intensity: { default: 55, min: 0, max: 100, step: 1 },
      slices: { default: 16, min: 4, max: 64, step: 1 },
      rgbSplit: { default: 6, min: 0, max: 40, step: 1 },
      scanlines: { default: 0, min: 0, max: 100, step: 5 },
      seed: { default: '42' },
    },
  },
  {
    id: 'wave_warp',
    name: 'Wave warp',
    category: 'warp',
    params: {
      amplitude: { default: 14, min: 0, max: 80, step: 1 },
      frequency: { default: 0.12, min: 0.005, max: 4, step: 0.005 },
      swirl: { default: 0.35, min: 0, max: 1, step: 0.05 },
    },
  },
  {
    id: 'noise_burst',
    name: 'Noise burst',
    category: 'texture',
    params: {
      amount: { default: 35, min: 0, max: 100, step: 1 },
      colorNoise: {
        default: 'mono',
        options: [
          { label: 'Mono grain', value: 'mono' },
          { label: 'RGB chaos', value: 'color' },
        ],
      },
      seed: { default: '7' },
    },
  },
  {
    id: 'chromatic',
    name: 'Chromatic aberration',
    category: 'texture',
    params: {
      offset: { default: 8, min: 1, max: 35, step: 1 },
      angle: { default: 0, min: 0, max: 360, step: 1, suffix: '°' },
    },
  },
  {
    id: 'color_adjust',
    name: 'Color adjust',
    category: 'color',
    params: {
      brightness: { default: 0, min: -100, max: 100, step: 1 },
      contrast: { default: 1, min: 0.05, max: 3, step: 0.05 },
      saturation: { default: 1, min: 0, max: 3, step: 0.05 },
      hueShift: { default: 0, min: -180, max: 180, step: 1, suffix: '°' },
    },
  },
  {
    id: 'colorize',
    name: 'Colorize',
    category: 'color',
    params: {
      hue: { default: 220, min: 0, max: 360, step: 1, suffix: '°' },
      saturation: { default: 1, min: 0, max: 1, step: 0.05 },
      amount: { default: 1, min: 0, max: 1, step: 0.05 },
    },
  },
];

export default effectCatalog;
