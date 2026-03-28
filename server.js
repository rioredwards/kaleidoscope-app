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
app.post('/api/process', upload.single('image'), (req, res) => {
  try {
    const { effect, params, existingImage } = req.body;

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
        command = `-virtual-pixel tile -distort DePolar 0 -gravity Center -crop ${params.cropSize || '17%'}x100%+0+0 +repage -flop `;
        for(let i = 0; i < 6; i++) {
          command += `-clone 0 `;
        }
        command += `+append -distort Polar 0`;
        break;

      case '8fold_kaleidoscope':
        command = `-virtual-pixel tile -distort DePolar 0 -gravity Center -crop ${params.cropSize || '12%'}x100%+0+0 +repage -flop `;
        for(let i = 0; i < 8; i++) {
          command += `-clone 0 `;
        }
        command += `+append -distort Polar 0`;
        break;

      case '12fold_kaleidoscope':
        command = `-virtual-pixel tile -distort DePolar 0 -gravity Center -crop ${params.cropSize || '8%'}x100%+0+0 +repage -flop `;
        for(let i = 0; i < 12; i++) {
          command += `-clone 0 `;
        }
        command += `+append -distort Polar 0`;
        break;

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

      case 'barrel':
        const barrel = params.strength || '0.3';
        command = `-virtual-pixel white -distort Barrel "0 0 -${barrel}"`;
        break;

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
      { id: '6fold_kaleidoscope', name: '6-Fold Kaleidoscope', params: { cropSize: '17%' } },
      { id: '8fold_kaleidoscope', name: '8-Fold Kaleidoscope', params: { cropSize: '12%' } },
      { id: '12fold_kaleidoscope', name: '12-Fold Kaleidoscope', params: { cropSize: '8%' } },
      { id: 'mandala', name: 'Mandala (8-way rotation)', params: {} },
      { id: 'edge_detect', name: 'Edge Detection', params: {} },
      { id: 'high_contrast', name: 'High Contrast', params: { contrast: '5' } },
      { id: 'barrel', name: 'Barrel Distortion', params: { strength: '0.3' } },
      { id: 'sharpen', name: 'Sharpen', params: { amount: '2' } },
    ]
  });
});

// Serve uploaded/output files
app.use('/uploads', express.static(uploadDir));
app.use('/outputs', express.static(outputDir));

app.listen(port, () => {
  console.log(`Kaleidoscope app running at http://localhost:${port}`);
  console.log(`Upload directory: ${uploadDir}`);
  console.log(`Output directory: ${outputDir}`);
});
