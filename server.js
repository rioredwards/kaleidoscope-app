const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const cors = require('cors');

const app = express();
const port = 3000;

// Create upload and output directories
const uploadDir = path.join(__dirname, 'uploads');
const outputDir = path.join(__dirname, 'outputs');

[uploadDir, outputDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper to run ImageMagick commands
function runMagick(inputPath, command, outputPath) {
  try {
    const fullCommand = `magick "${inputPath}" ${command} "${outputPath}"`;
    console.log('Running:', fullCommand);
    execSync(fullCommand, { maxBuffer: 1024 * 1024 * 50, stdio: 'pipe' });
    return outputPath;
  } catch (error) {
    console.error('ImageMagick error:', error.message);
    throw new Error('Image processing failed: ' + error.message);
  }
}

// Routes
function parseEffectParams(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Strength 0–1 for barrel; preserves 0 (no warp). Default 0.3 when missing/invalid. */
function parseBarrelStrength(params) {
  const raw = params.strength;
  if (raw === undefined || raw === null || raw === '') return 0.3;
  const n = parseFloat(String(raw));
  if (!Number.isFinite(n)) return 0.3;
  return Math.min(1, Math.max(0, n));
}

app.post('/api/process', upload.single('image'), (req, res) => {
  try {
    const { effect, existingImage } = req.body;
    const params = parseEffectParams(req.body.params);

    let inputPath;
    if (existingImage) {
      // Use a previously generated image
      inputPath = path.join(outputDir, path.basename(existingImage));
      if (!fs.existsSync(inputPath)) {
        return res.status(400).json({ error: 'Source image not found' });
      }
    } else if (req.file) {
      // Use newly uploaded image
      inputPath = req.file.path;
    } else {
      return res.status(400).json({ error: 'No image provided' });
    }

    const outputPath = path.join(outputDir, `output_${Date.now()}.jpg`);

    let command = '';

    switch(effect) {
      case 'tunnel':
        const scale = parseInt(params.scale) || 7;
        command = `-resize 800x800 -write mpr:base null mpr:base -size 1600x1600 xc:black -draw "color 0,0 reset" `;
        // Fallback to simpler approach with bash
        break;

      case 'tunnel_nested':
        command = `-virtual-pixel edge -distort DePolar 0 -gravity Center -crop ${params.cropSize || '20%'}x100%+0+0 +repage -flop `;
        for(let i = 0; i < (parseInt(params.layers) || 6); i++) {
          command += `-clone 0 `;
        }
        command += `+append -distort Polar 0`;
        break;

      case 'spiral_vortex':
        command = `-virtual-pixel tile `;
        const rotations = parseInt(params.rotations) || 15;
        const steps = parseInt(params.steps) || 12;
        // This will need bash script handling
        break;

      case '6fold_kaleidoscope':
      case '8fold_kaleidoscope':
      case '12fold_kaleidoscope':
      case 'kaleidoscope': {
        const folds = parseInt(params.folds) || { '6fold_kaleidoscope': 6, '8fold_kaleidoscope': 8, '12fold_kaleidoscope': 12 }[effect] || 8;
        const defaultCrop = { 6: '17%', 8: '12%', 12: '8%' }[folds] || '12%';
        const cropSize = params.cropSize || defaultCrop;
        command = `-virtual-pixel tile -distort DePolar 0 -gravity Center -crop ${cropSize}x100%+0+0 +repage -flop `;
        for (let i = 0; i < folds; i++) {
          command += `-clone 0 `;
        }
        command += `+append -distort Polar 0`;
        break;
      }

      case 'mandala':
        command = `-gravity center -crop 800x800+0+0 +repage `;
        for(let i = 0; i < 8; i++) {
          command += `\\( +clone -rotate $((i * 45)) \\) `;
        }
        command += `-compose screen -composite`;
        break;

      case 'edge_detect':
        command = `-edge 3 -negate`;
        break;

      case 'high_contrast':
        command = `-contrast-stretch 0 -sigmoidal-contrast ${params.contrast || '5'}x50%`;
        break;

      case 'barrel': {
        const s = parseBarrelStrength(params);
        // B and C both contribute (per IM docs, |A|>|B|>|C| impact — we avoid tiny C-only curves).
        // D nudges scale so the mapping stays well-behaved at the rim.
        const B = (-0.42 * s).toFixed(4);
        const C = (-0.28 * s).toFixed(4);
        const D = (1 + 0.15 * s).toFixed(4);
        command = `-virtual-pixel white -distort Barrel "0 ${B} ${C} ${D}"`;
        break;
      }

      case 'sharpen':
        command = `-sharpen 0x${params.amount || '2'}`;
        break;

      default:
        return res.status(400).json({ error: 'Unknown effect' });
    }

    if (!command) {
      return res.status(400).json({ error: 'Effect requires bash implementation' });
    }

    const result = runMagick(inputPath, command, outputPath);
    const outputFileName = path.basename(result);

    res.json({
      success: true,
      outputPath: `/outputs/${outputFileName}`,
      message: `Applied ${effect} effect`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available effects
app.get('/api/effects', (req, res) => {
  res.json({
    effects: [
      { id: 'kaleidoscope', name: 'Kaleidoscope', params: {
        folds: { default: 8, options: [{ label: '6-fold', value: 6 }, { label: '8-fold', value: 8 }, { label: '12-fold', value: 12 }] },
        cropSize: { default: 12, min: 1, max: 50, step: 1, suffix: '%' }
      } },
      { id: 'mandala', name: 'Mandala (8-way rotation)', params: {} },
      { id: 'edge_detect', name: 'Edge Detection', params: {} },
      { id: 'high_contrast', name: 'High Contrast', params: { contrast: { default: 5, min: 1, max: 20, step: 0.5 } } },
      { id: 'barrel', name: 'Barrel Distortion', params: { strength: { default: 0.3, min: 0, max: 1, step: 0.05 } } },
      { id: 'sharpen', name: 'Sharpen', params: { amount: { default: 2, min: 0.5, max: 10, step: 0.5 } } },
    ]
  });
});

// Preset management
const presetsFile = path.join(__dirname, 'presets.json');
function readPresets() {
  try {
    return JSON.parse(fs.readFileSync(presetsFile, 'utf8'));
  } catch {
    return [];
  }
}
function writePresets(presets) {
  fs.writeFileSync(presetsFile, JSON.stringify(presets, null, 2));
}

app.get('/api/presets', (req, res) => {
  res.json({ presets: readPresets() });
});

app.post('/api/presets', (req, res) => {
  const { name, effectId, params } = req.body;
  if (!name || !effectId) {
    return res.status(400).json({ error: 'name and effectId required' });
  }
  const presets = readPresets();
  const idx = presets.findIndex(p => p.name === name);
  const preset = { name, effectId, params: params || {} };
  if (idx >= 0) {
    presets[idx] = preset;
  } else {
    presets.push(preset);
  }
  writePresets(presets);
  res.json({ success: true, preset });
});

app.delete('/api/presets/:name', (req, res) => {
  const presets = readPresets();
  const filtered = presets.filter(p => p.name !== req.params.name);
  if (filtered.length === presets.length) {
    return res.status(404).json({ error: 'Preset not found' });
  }
  writePresets(filtered);
  res.json({ success: true });
});

app.get('/api/outputs', (req, res) => {
  const files = fs.readdirSync(outputDir)
    .filter(f => /\.(jpg|png)$/i.test(f))
    .sort()
    .reverse()
    .map(f => `/outputs/${f}`);
  res.json({ outputs: files });
});

// Serve uploaded/output files
app.use('/uploads', express.static(uploadDir));
app.use('/outputs', express.static(outputDir));

app.listen(port, () => {
  console.log(`Kaleidoscope app running at http://localhost:${port}`);
  console.log(`Upload directory: ${uploadDir}`);
  console.log(`Output directory: ${outputDir}`);
});
