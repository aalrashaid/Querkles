

# Querkles Generator (HTML • CSS • JS)

A browser-based **Querkles** art generator:
Numbered circles (1..5) or **Classic Rings** using Poisson-Disk sampling, 5 quantized size levels, and smart edge-weighting. Supports saving settings and exporting **PNG / SVG / PDF** for **A6 → A3** print sizes.

## Table of Contents

- [Querkles Generator (HTML • CSS • JS)](#querkles-generator-html--css--js)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Quick Setup](#quick-setup)
  - [Project Structure](#project-structure)
  - [Usage](#usage)
  - [Settings](#settings)
  - [Density Control](#density-control)
    - [Quick console helpers](#quick-console-helpers)
  - [Export \& Print](#export--print)
  - [Tips for True Querkles Look](#tips-for-true-querkles-look)
  - [Common Issues](#common-issues)
  - [Development](#development)
  - [Credits](#credits)
  - [License](#license)

---

## Features

* 🟢 **Two Drawing Modes**

  * **Numbered Circles** (1..5) with light fill for easy manual coloring.
  * **Classic Rings** with multiple outlines for shading effect.

* 🎯 **Smart Sampling**

  * Poisson-Disk to avoid overlapping circles.
  * **Quantized** to 5 radius levels (true Querkles style).
  * **Edge-weight** to emphasize outlines (eyes, eyebrows, mouth).

* 💾 **Save Settings** locally (name, colors, mode…).

* 🖨️ **Export** as PNG / SVG / PDF for A6–A3 sizes with custom DPI.

* ⚙️ **Manual Density Control** + helper functions for target coverage.

---

## Quick Setup

No build or dependencies required — just open `index.html` in your browser (Chrome/Edge/Firefox).

> To run locally with a simple server:

```bash
npx serve .
# or
python3 -m http.server 8080
```

---

## Project Structure

```
.
├─ index.html   # UI & HTML structure
├─ app.css      # Styling
└─ app.js       # Core logic: generate / draw / export / save
```

**Important sections inside `app.js`:**

* Config: `CFG` (rMin=3, rMax=18, density=0.87 by default).
* Sampling: `generatePoisson()`, `edgeWeight()`, `quantizedRadiusAt()`.
* Drawing: `drawNumbered()` and `drawClassic()`.
* Export: `exportPNGPrint`, `exportSVG`, `exportPDF`.
* Save/Load: `saveSettings`, `loadSettings`.

---

## Usage

1. Open the page.
2. **Upload** an image (best results with high contrast).
3. Choose **Numbered** or **Classic Rings** mode.
4. Adjust colors / name / size if needed.
5. Click **Convert**.
6. Optionally, click **Save Settings**, then **Export**.

---

## Settings

* **Palette (1..5):** Colors for layers (for numbers & fill / ring colors).
* **Mode:** Numbered or Classic Rings.
* **Export:** Choose **Size** (A6..A3), **Orientation** (Portrait/Landscape), **DPI**, and **Format** (PNG/SVG/PDF).
* **Save Settings:** Stores everything locally in the browser.

---

## Density Control

Density controls the **number of circles** and thus the coverage percentage.
Default is tuned for \~50% coverage depending on the image:

```js
// app.js
const CFG = {
  rMin: 3,
  rMax: 18,
  k: 18,
  density: 0.87,   // Change if needed
  ringAlpha: 0.35,
  fillAlpha: 0.08
};
```

### Quick console helpers

After you **Convert**, you can tweak density instantly:

* **Set a target coverage (%):**

```js
setDensityForTarget(45);  // Adjusts CFG.density to aim for 45% coverage
```

* **Small adjustments:**

```js
nudgeDensityUp();     // +0.05 (e.g., 0.87 → 0.92 for more detail)
nudgeDensityDown();   // -0.05
```

> For a classic coloring book style: keep it between **0.70 – 0.85** (≈35–45% coverage).

---

## Export & Print

1. Select **Size**: A6 / A5 / A4 / A3 and **Orientation**.
2. Select **DPI** (PNG only) — 300 DPI is great for print.
3. Select **Format**:

   * **PNG**: Raster image at chosen resolution.
   * **SVG**: Vector (ideal for Illustrator edits).
   * **PDF**: Opens print/save as PDF dialog.
4. Click **Export**.

> Note: SVG/PDF are fully vector-based (circles/numbers), perfect for large-scale prints.

---

## Tips for True Querkles Look

* Increase `rMax` (e.g., 20) for larger circles in lighter areas.
* Lower `density` if you see crowding, or use `nudgeDensityDown()` step-by-step.
* **Classic Rings:** Try `ringAlpha` between `0.25 – 0.40` depending on paper/printer.
* For low-contrast images: increase density + raise `rMin` slightly (4 instead of 3).

---

## Common Issues

* **Pop-up blocked?** PDF export needs pop-ups — enable them.
* **Image too large?** The app downsizes to 1400px width max for speed.
* **Slow performance?** Lower `density` or reduce `rMax`.
* **Too many tiny circles?** Increase `rMin` or lower `density`.

---

## Development

* Algorithm: Poisson-Disk (Bridson) with **quantized radius** (5 sizes).
* **Edge-weight** uses brightness gradients to add points along edges.
* Drawing uses **Canvas 2D**; SVG/PDF are built as vector elements.

---

## Credits

Querkles concept inspired by Thomas Pavitte’s “Querkles” coloring books.
This project is an open-source web implementation of the technique.

---

## License

MIT — free to use, modify, and distribute. Attribution appreciated 👍

---

If you want, I can now **add preview images and GitHub badges** so your README looks pro when people open it. Would you like me to prepare that?
