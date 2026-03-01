# floorplan-scale-engine

Deterministic scale calculation for architectural floor plans. Takes wall polygon coordinates (pixels) and OCR dimension strings, returns a reliable pixels-per-inch scale factor.

## The Problem

Computer vision extracts room geometry from floor plans:
- Wall polygons as pixel coordinates
- Dimension labels via OCR (e.g., "23' 6\"", "13' 0\"")

Converting pixel coordinates to real-world measurements requires a scale factor. Simple approaches break on L-shaped rooms, compound dimensions, and non-rectangular layouts.

## The Solution

Dimension labels on floor plans measure **perpendicular distances between parallel walls**. This engine:

1. Extracts wall segments from the polygon
2. Detects parallel wall pairs
3. Computes perpendicular distances between parallel segments
4. Matches pixel distances to OCR dimensions
5. Derives a consensus scale factor with confidence scoring

## Quick Start

```bash
npm install
npm run demo    # run against sample floor plans
npm test        # run test suite
```

## API

```ts
import { computeScale } from 'floorplan-scale-engine';

const result = computeScale({
  walls: [[0,0], [500,0], [500,300], [200,300], [200,500], [0,500]],
  dimensions: ["23' 6\"", "13' 0\"", "10' 6\""]
});

console.log(result.pixelsPerInch);  // 1.77
console.log(result.confidence);     // 0.95
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

- **L-shaped rooms**: Multiple parallel pairs at different orientations
- **U-shaped rooms**: Overlapping parallel segments
- **Wall stubs**: Short segments filtered by configurable minimum length
- **Wall thickness**: Close parallel pairs filtered out (not actual room dimensions)
- **Compound dimensions**: Fractional inches, mixed formats
- **Metric units**: Automatic detection and conversion
- **OCR noise**: Forgiving parser handles extra spaces and formatting variations

## Architecture

```
src/
├── geometry.ts    # Segment extraction, parallel detection, perpendicular distance
├── parser.ts      # Dimension string parsing (imperial + metric)
├── matcher.ts     # Match pixel distances to real dimensions
├── scale.ts       # Main pipeline & public API
├── visualize.ts   # SVG debug output
└── demo.ts        # Demo runner
```

## Visualization

Run `npm run demo` to generate SVG visualizations in `./output/`. Each SVG shows:
- Room polygon outline
- Detected parallel wall pairs (color-coded)
- Matched dimension labels with pixel distances
- Computed scale and confidence

## License

MIT
