# Kaleidoscope — trippy art for album covers

A small web app for turning photos into **symmetric, glitchy, high-color artwork** in the browser. It is built for **album art**, single covers, and social tiles: upload a source image, stack effects, then **download PNG** or save to disk through the local server.

**Processing runs in your browser** with [p5.js](https://p5js.org/). You only need **Node.js** to run the dev server and optional save/preset APIs. **ImageMagick is not required** for the normal UI workflow.

## Setup

```bash
node --version   # 18+ recommended
cd kaleidoscope-app
npm install
```

### Development (hot reload + API)

```bash
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api`, `/uploads`, and `/outputs` to the API on port **3000**.

### Production-style (built UI + API on one port)

```bash
npm run build
npm start
```

Open **http://localhost:3000**.

## How to use

1. **Upload** or drag an image (or use a previous **result** as the new source).
2. **Pick an effect** in the toolbar; the preview updates when you change parameters.
3. Use **Sharp pixels** / **preview size** when you want crisp pixels or a larger preview (still capped for performance).
4. **Download** for a PNG, or **Save** / **Save → source** to keep working on the server and chain effects.
5. **Presets** store named effect + parameter combos for repeat looks.

Chaining is the secret sauce for cover art: e.g. **Kaleidoscope → Color adjust → Glitch → Tile**, re-using each result as source until it feels right.

## What you can do

| Kind             | Effects (examples)                                                                  |
| ---------------- | ----------------------------------------------------------------------------------- |
| Symmetry         | **Kaleidoscope** (folds + crop), **Mandala**                                        |
| Color            | **Invert**, **Color adjust** (contrast, saturation, hue), **High contrast**         |
| Warp             | **Barrel**, **Wave warp**                                                           |
| Glitch / texture | **Glitch**, **Chromatic aberration**, **Noise burst**, **Edge detect**, **Sharpen** |
| Layout / layers  | **Tile** (repeat grid), **Blend** (second image + modes)                            |

Parameters are in the popover next to each effect (and the blend row when **Blend** is selected).

## Project layout

```
kaleidoscope-app/
├── index.html              # Shell + toolbar
├── src/
│   ├── main.js             # UI, presets, history, crop
│   ├── effects.js          # All image effects (client-side)
│   ├── p5-canvas.js        # p5 instance, preview scaling, export
│   └── style.css
├── server.js               # Express: static files, /api/effects, presets, save-canvas
├── vite.config.js
├── uploads/                # Created when using upload APIs
└── outputs/                # Saved results (PNG)
```

## Adding or changing effects

1. Implement the effect in **`src/effects.js`** and register it on the **`EFFECTS`** object.
2. Add the same `id`, display name, and **`params`** schema to **`/api/effects`** in **`server.js`** so the toolbar and presets stay in sync.

## Troubleshooting

- **Slow or heavy preview:** Lower **Preview** resolution in the sub-toolbar, or start from a smaller source image.
- **Port in use:** Change `port` in `server.js` (and match Vite’s proxy in `vite.config.js` if you use `npm run dev`).
- **Blend says “Choose a blend image”:** Pick a top layer with **Choose image** or **Use result** in the blend bar.

## Optional: MCP and `/api/process`

The repo includes an **`mcp-server.js`** helper that can call **`POST /api/process`**, which still builds **ImageMagick** command lines in **`server.js`**. That path is separate from the main web UI; ignore it unless you are wiring automation and have `magick` installed.

---

Have fun making weird, loud cover art.
