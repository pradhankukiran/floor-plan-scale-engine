<div align="center">

# floorplan-scale-engine

**Deterministic scale extraction for architectural floor plans.**

Takes wall polygon coordinates (pixels) and OCR dimension strings, returns a reliable pixels-per-inch scale factor with confidence scoring.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![Vite](https://img.shields.io/badge/Built_with-Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen)](package.json)
[![Vercel](https://img.shields.io/badge/Demo-Live-black?logo=vercel&logoColor=white)](https://floor-plan-scale-engine.vercel.app)

[Live Demo](https://floor-plan-scale-engine.vercel.app) &middot; [API Reference](#api) &middot; [How It Works](#how-it-works)

</div>

---

## Why

Computer vision can extract room geometry from floor plans -- wall polygons as pixel coordinates and dimension labels via OCR (e.g., `23' 6"`, `4.5m`). Converting pixels to real-world measurements requires a **scale factor**.

Simple approaches break on L-shaped rooms, compound dimensions, diagonal closing edges, and non-rectangular layouts. This engine handles all of them.

## Quick Start

```bash
npm install
npm test        # run test suite
npm run demo    # run against sample floor plans (SVG output)
npm run dev     # launch interactive web demo
```

## API

```ts
import { computeScale } from 'floorplan-scale-engine';

const result = computeScale({
  walls: [[0,0], [500,0], [500,300], [200,300], [200,500], [0,500]],
  dimensions: ["23' 6\"", "13' 0\"", "10' 6\""]
});

console.log(result.pixelsPerInch);  // 1.77
console.log(result.confidence);     // 1.0 (all dimensions matched)
console.log(result.matches);        // detailed match info
```

### Options

```ts
computeScale({
  walls: Point[],          // polygon vertices in pixel coordinates
  dimensions: string[],    // OCR-extracted dimension labels
  minWallLength?: number,  // minimum segment length in px (default: 20)
})
```

### Output

```ts
interface ScaleOutput {
  pixelsPerInch: number;             // consensus scale factor
  confidence: number;                // 0-1 confidence score
  matches: DimensionMatch[];         // matched pair-dimension associations
  unmatchedPairs: ParallelPair[];    // wall pairs with no matching dimension
  unmatchedDimensions: ParsedDimension[]; // dimensions with no matching wall pair
  segments: Segment[];               // extracted wall segments
}
```

## Supported Formats

| Format | Example | Parsed As |
|--------|---------|-----------|
| Feet and inches | `23' 6"` | 282 in |
| Dash separated | `23'-6"` | 282 in |
| With `ft`/`in` | `23 ft 6 in` | 282 in |
| Feet only | `13'` | 156 in |
| Inches only | `6"` | 6 in |
| Decimal feet | `23.5'` | 282 in |
| Fractions | `10' 6 1/2"` | 126.5 in |
| Meters | `4.5m` | 177.17 in |
| Centimeters | `450cm` | 177.17 in |
| Millimeters | `4500mm` | 177.17 in |

## How It Works

```
                   OCR Strings                    Pixel Polygon
                       |                               |
                  [ parser.ts ]                  [ geometry.ts ]
                       |                               |
              ParsedDimension[]          Segments + ParallelPairs + ExtentPairs
                       |                               |
                       +----------- merge -------------+
                                      |
                               [ matcher.ts ]
                                      |
                        Consensus Scale + Confidence
```

1. **Segment extraction** -- Convert the wall polygon into edge segments, discard degenerate zero-length edges
2. **Parallel pair detection** -- Find opposing wall segments within angular tolerance, compute perpendicular distances
3. **Extent pair synthesis** -- Project the polygon onto its dominant orientations to recover spans missed by diagonal closing edges
4. **Deduplication** -- Merge near-equal pairs, keeping the one with longer combined wall length
5. **Dimension parsing** -- Parse OCR strings into inches (imperial + metric, fractions, mixed formats)
6. **Matching** -- Try every candidate scale (pair/dimension combo), greedily assign within 5% tolerance, select the candidate maximizing weighted coverage
7. **Consensus** -- Weighted average of matched scales (longer dimensions carry more weight)

## Edge Cases Handled

- **Diagonal closing edges** -- Bounding-box extent pairs recover missing spans automatically
- **L-shaped rooms** -- Multiple parallel pairs at different orientations
- **U-shaped rooms** -- Overlapping parallel segments
- **Trapezoids / irregular polygons** -- Axis-aligned extents provide matches even without parallel segments
- **Wall stubs** -- Short segments filtered by configurable minimum length
- **Wall thickness** -- Close parallel pairs filtered out (not actual room dimensions)
- **Compound dimensions** -- Fractional inches, mixed formats
- **Metric units** -- Automatic detection and conversion
- **OCR noise** -- Forgiving parser handles extra spaces and formatting variations

## Confidence Scoring

Confidence is the average of four normalized components:

| Component | What it measures |
|-----------|-----------------|
| Dimension coverage | Fraction of total dimension inches matched |
| Pair coverage | Fraction of relevant wall-pair distance matched |
| Largest span | Whether the biggest wall span was matched |
| Residual quality | How tightly matches agree on the same scale |

**100%** = every dimension matched a wall span at a consistent scale. **0%** = no consistent scale found.

## Web Demo

The [interactive demo](https://floor-plan-scale-engine.vercel.app) lets you select sample floor plans, draw custom polygons on a canvas, and enter dimension strings to compute scale in real time.

```bash
npm run dev         # start dev server
npm run build:web   # production build
npm run preview     # preview production build
```

## Visualization

Run `npm run demo` to generate SVG visualizations in `./output/`. Each SVG shows:

- Room polygon outline
- Detected parallel wall pairs (color-coded)
- Matched dimension labels with pixel distances
- Computed scale and confidence

## Project Structure

```
src/
  geometry.ts    -- Segment extraction, parallel detection, extent pairs
  parser.ts      -- Dimension string parsing (imperial + metric)
  matcher.ts     -- Match pixel distances to dimensions, confidence scoring
  scale.ts       -- Main pipeline & public API
  visualize.ts   -- SVG visualization output
  demo.ts        -- Demo runner

web/
  index.html     -- Interactive web demo
  src/
    main.ts      -- Entry point
    editor.ts    -- Canvas polygon editor
    results.ts   -- Results rendering
    samples.ts   -- Sample floor plan data

test/
  geometry.test.ts
  parser.test.ts
  scale.test.ts
  matcher.test.ts
```

## License

[MIT](LICENSE)
