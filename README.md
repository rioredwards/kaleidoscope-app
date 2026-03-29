# Kaleidoscope Generator Web App

An interactive web app for creating mesmerizing kaleidoscope effects from your images using ImageMagick.

## Setup

1. Make sure you have Node.js and ImageMagick installed:
```bash
# Check if installed
node --version
magick --version
```

2. Install dependencies:
```bash
cd ~/kaleidoscope-app
npm install
```

3. Development (Vite HMR + API on port 3000):
```bash
npm run dev
```
Open **http://localhost:5173** (Vite proxies `/api`, `/uploads`, `/outputs` to the API server).

4. Production-style (built static files + API on one port):
```bash
npm run build
npm start
```
Open **http://localhost:3000**

## Features

- **6-Fold Kaleidoscope**: Classic 6-way symmetric pattern
- **8-Fold Kaleidoscope**: 8-way geometric symmetry
- **12-Fold Kaleidoscope**: Maximum detail with 12-way symmetry
- **Mandala**: 8-way rotational mirror effect
- **Edge Detection**: Emphasize edges and details
- **High Contrast**: Increase contrast dramatically
- **Barrel Distortion**: Curved lens effect
- **Sharpen**: Enhance details and edges

## How to Use

1. **Upload** an image by clicking the upload area or dragging a file
2. **Select** an effect from the available options
3. **Adjust** parameters if available for the effect
4. Click **Generate Kaleidoscope** to process
5. **Download** your result or try another effect

## Understanding the Effects

### Kaleidoscope Effects (6/8/12-fold)
These use ImageMagick's DePolar, crop, flip, and Polar distortions to create traditional kaleidoscope patterns. The fold number determines how many repeating sections appear.

### Mandala
Creates a mandala-like effect by rotating the image 8 times and blending them together using screen composition.

### Edge Detection & Contrast
Emphasizes the geometric details and structure by detecting edges and increasing contrast.

## Advanced: Adding New Effects

To add a new effect, edit `server.js` in the `/api/process` route:

```javascript
case 'my_effect':
  command = `-your -imagemagick -commands -here`;
  break;
```

Then add it to the effects list returned by `/api/effects`.

## ImageMagick Commands Reference

The app builds ImageMagick commands dynamically. Common operations:

```
-distort DePolar [radius]     # Convert to polar coordinates
-distort Polar [radius]       # Convert from polar coordinates
-edge [radius]                # Edge detection
-sharpen [kernel]             # Sharpen image
-contrast-stretch             # Auto-contrast
-sigmoidal-contrast           # S-curve contrast
-distort Barrel               # Barrel distortion
```

## Troubleshooting

**"ImageMagick error" when processing:**
- Make sure ImageMagick is installed: `brew install imagemagick`
- Check that the image format is supported (JPG, PNG)

**Port already in use:**
- Edit the `port` variable in server.js to use a different port (e.g., 3001)

**Out of memory:**
- For very large images, ImageMagick might need more resources
- Try with a smaller input image

## File Structure

```
kaleidoscope-app/
├── server.js              # Express server & ImageMagick API
├── public/
│   └── index.html         # Web UI
├── uploads/               # (Created) Uploaded images
├── outputs/               # (Created) Generated results
└── package.json
```

## Tips

- Start with smaller images (800x800 or less) for faster processing
- The results are saved and you can download them
- Experiment with different parameter values for the same effect
- Combine effects by using the output of one as input to another

Enjoy creating! ✨
