# floorplan-scale-engine

Deterministic scale calculation for architectural floor plans. Takes wall polygon coordinates (pixels) and OCR dimension strings, returns a reliable pixels-per-inch scale factor.

## The Problem

Computer vision extracts room geometry from floor plans:
- Wall polygons as pixel coordinates
- Dimension labels via OCR (e.g., "23' 6\"", "13' 0\"")

Converting pixel coordinates to real-world measurements requires a scale factor. Simple approaches break on L-shaped rooms, compound dimensions, diagonal closing edges, and non-rectangular layouts.

## The Solution

Dimension labels on floor plans measure **perpendicular distances between parallel walls**. This engine:

1. Extracts wall segments from the polygon
2. Detects parallel wall pairs (opposing walls of rooms)
3. Computes axis-aligned bounding-box extents to catch spans missed by diagonal edges
4. Deduplicates and merges all candidate pairs
5. Parses OCR dimension strings into structured values
6. Matches pixel distances to dimensions and derives a consensus scale with confidence scoring

## Quick Start

```bash
npm install
npm test        # run test suite
npm run demo    # run against sample floor plans (SVG output)
npm run dev     # launch interactive web demo
```

## Web Demo

The interactive web demo lets you select sample floor plans, draw custom polygons on a canvas, and enter dimension strings to compute scale in real time.

```bash
npm run dev         # start dev server
npm run build:web   # production build
npm run preview     # preview production build
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

## Supported Formats

| Format | Example | Parsed As |
|--------|---------|-----------|
| Feet and inches | `23' 6"` | 282 inches |
| Dash separated | `23'-6"` | 282 inches |
| Feet only | `13'` | 156 inches |
| Inches only | `6"` | 6 inches |
| Decimal feet | `23.5'` | 282 inches |
| Fractions | `10' 6 1/2"` | 126.5 inches |
| Meters | `4.5m` | 177.17 inches |
| Centimeters | `450cm` | 177.17 inches |
| Millimeters | `4500mm` | 177.17 inches |

## Edge Cases Handled

- **Diagonal closing edges**: OCR-traced polygons often have a diagonal edge connecting two walls. Bounding-box extent pairs recover the missing spans automatically.
- **L-shaped rooms**: Multiple parallel pairs at different orientations
- **U-shaped rooms**: Overlapping parallel segments
- **Trapezoids / irregular polygons**: Axis-aligned extents provide matches even when no parallel segment pairs exist
- **Wall stubs**: Short segments filtered by configurable minimum length
- **Wall thickness**: Close parallel pairs filtered out (not actual room dimensions)
- **Compound dimensions**: Fractional inches, mixed formats
- **Metric units**: Automatic detection and conversion
- **OCR noise**: Forgiving parser handles extra spaces and formatting variations

## Architecture

```
src/
├── geometry.ts    # Segment extraction, parallel detection, extent pairs, deduplication
├── parser.ts      # Dimension string parsing (imperial + metric)
├── matcher.ts     # Match pixel distances to real dimensions, confidence scoring
├── scale.ts       # Main pipeline & public API
├── visualize.ts   # SVG debug output
└── demo.ts        # Demo runner

web/
├── index.html     # Interactive web demo
├── style.css
├── vite.config.ts
└── src/
    ├── main.ts    # Entry point
    ├── editor.ts  # Canvas polygon editor
    ├── results.ts # Results rendering
    └── samples.ts # Sample floor plan data
```

## How Confidence Works

Confidence = fraction of provided dimensions that were successfully matched to a wall span. A polygon naturally produces more wall-span pairs than there are labeled dimensions, so unmatched pairs don't reduce confidence — only unmatched dimensions do.

- **100%**: Every dimension matched a wall span at a consistent scale
- **50%**: Half the dimensions matched
- **0%**: No consistent scale found

## Visualization

Run `npm run demo` to generate SVG visualizations in `./output/`. Each SVG shows:
- Room polygon outline
- Detected parallel wall pairs (color-coded)
- Matched dimension labels with pixel distances
- Computed scale and confidence

## License

MIT
