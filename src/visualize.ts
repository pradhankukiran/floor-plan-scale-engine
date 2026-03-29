/**
 * visualize.ts -- SVG visualization for floor plan scale analysis.
 *
 * Generates clean, self-contained SVG strings that illustrate the room
 * polygon, detected parallel wall pairs, dimension label matches, and
 * the computed scale.  Output can be written to a `.svg` file and
 * opened in any browser.
 *
 * No external dependencies beyond Node.js built-ins.
 */

import type { Point, Segment } from './geometry.js';
import type { DimensionMatch } from './matcher.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface VisualizeOptions {
  walls: Point[];
  segments: Segment[];
  matches: DimensionMatch[];
  pixelsPerInch: number;
  confidence: number;
  width?: number;
  height?: number;
  padding?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIGHLIGHT_COLORS = [
  '#e74c3c',
  '#3498db',
  '#2ecc71',
  '#f39c12',
  '#9b59b6',
] as const;

const POLYGON_FILL = '#f0f0f0';
const POLYGON_STROKE = '#333';
const POLYGON_STROKE_WIDTH = 2;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Compute axis-aligned bounding box of a set of points. */
function boundingBox(points: Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  return { minX, minY, maxX, maxY };
}

/** Midpoint of a segment. */
function midpoint(seg: Segment): Point {
  return [
    (seg[0][0] + seg[1][0]) / 2,
    (seg[0][1] + seg[1][1]) / 2,
  ];
}

/**
 * Build a coordinate transform that maps floor-plan pixel space into
 * SVG viewport space.
 *
 *  - Flips the Y axis (floor plans: y-up; SVG: y-down).
 *  - Uniformly scales to fit within the available area.
 *  - Centers the drawing.
 */
function buildTransform(
  bb: { minX: number; minY: number; maxX: number; maxY: number },
  svgWidth: number,
  svgHeight: number,
  padding: number,
): (p: Point) => Point {
  const availW = svgWidth - 2 * padding;
  const availH = svgHeight - 2 * padding;

  const dataW = bb.maxX - bb.minX || 1;
  const dataH = bb.maxY - bb.minY || 1;

  const scale = Math.min(availW / dataW, availH / dataH);

  // Center offsets after scaling.
  const offsetX = padding + (availW - dataW * scale) / 2;
  const offsetY = padding + (availH - dataH * scale) / 2;

  return ([x, y]: Point): Point => [
    offsetX + (x - bb.minX) * scale,
    // Flip Y: map maxY -> padding edge, minY -> bottom edge.
    offsetY + (bb.maxY - y) * scale,
  ];
}

/** Escape text for safe embedding in SVG/XML. */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Format a dimension match label: e.g. `23' 6" (500px)` */
function formatMatchLabel(match: DimensionMatch): string {
  const pxStr = Math.round(match.pair.perpendicularDistance);
  return `${match.dimension.original} (${pxStr}px)`;
}

// ---------------------------------------------------------------------------
// SVG component builders
// ---------------------------------------------------------------------------

function buildStyles(): string {
  return `  <style>
    text {
      font-family: 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    }
    .title {
      font-size: 16px;
      font-weight: 600;
      fill: #222;
    }
    .match-label {
      font-size: 12px;
      font-weight: 500;
      fill: #222;
    }
    .match-label-bg {
      fill: #fff;
      opacity: 0.85;
    }
    .legend-title {
      font-size: 12px;
      font-weight: 600;
      fill: #333;
    }
    .legend-text {
      font-size: 11px;
      fill: #555;
    }
  </style>`;
}

function buildPolygon(walls: Point[], transform: (p: Point) => Point): string {
  if (walls.length === 0) return '';

  const points = walls
    .map((p) => {
      const [tx, ty] = transform(p);
      return `${tx.toFixed(2)},${ty.toFixed(2)}`;
    })
    .join(' ');

  return `  <polygon
    points="${points}"
    fill="${POLYGON_FILL}"
    stroke="${POLYGON_STROKE}"
    stroke-width="${POLYGON_STROKE_WIDTH}"
    stroke-linejoin="round"
  />`;
}

function buildMatchOverlay(
  match: DimensionMatch,
  colorIndex: number,
  transform: (p: Point) => Point,
): string {
  const color = HIGHLIGHT_COLORS[colorIndex % HIGHLIGHT_COLORS.length]!;
  const parts: string[] = [];

  // --- Highlight segments of the parallel pair ---
  for (const seg of [match.pair.segA, match.pair.segB]) {
    const [ax, ay] = transform(seg[0]);
    const [bx, by] = transform(seg[1]);
    parts.push(
      `  <line x1="${ax.toFixed(2)}" y1="${ay.toFixed(2)}" ` +
        `x2="${bx.toFixed(2)}" y2="${by.toFixed(2)}" ` +
        `stroke="${color}" stroke-width="4" stroke-linecap="round" opacity="0.85" />`,
    );
  }

  // --- Dashed connector between midpoints ---
  const midA = midpoint(match.pair.segA);
  const midB = midpoint(match.pair.segB);
  const [mAx, mAy] = transform(midA);
  const [mBx, mBy] = transform(midB);

  parts.push(
    `  <line x1="${mAx.toFixed(2)}" y1="${mAy.toFixed(2)}" ` +
      `x2="${mBx.toFixed(2)}" y2="${mBy.toFixed(2)}" ` +
      `stroke="${color}" stroke-width="1.5" stroke-dasharray="6,4" opacity="0.7" />`,
  );

  // --- Label at midpoint of dashed line ---
  const labelX = (mAx + mBx) / 2;
  const labelY = (mAy + mBy) / 2;
  const label = escapeXml(formatMatchLabel(match));

  // Estimate text width for background rect (rough: 7px per char).
  const estimatedWidth = label.length * 7 + 12;
  const rectHeight = 20;

  parts.push(
    `  <rect class="match-label-bg" ` +
      `x="${(labelX - estimatedWidth / 2).toFixed(2)}" ` +
      `y="${(labelY - rectHeight / 2 - 1).toFixed(2)}" ` +
      `width="${estimatedWidth}" height="${rectHeight}" rx="4" />`,
  );
  parts.push(
    `  <text class="match-label" ` +
      `x="${labelX.toFixed(2)}" y="${(labelY + 4).toFixed(2)}" ` +
      `text-anchor="middle">${label}</text>`,
  );

  return parts.join('\n');
}

function buildTitle(
  pixelsPerInch: number,
  confidence: number,
  svgWidth: number,
): string {
  const scaleStr = pixelsPerInch.toFixed(2);
  const confStr = (confidence * 100).toFixed(0);
  const label = escapeXml(`Scale: ${scaleStr} px/in | Confidence: ${confStr}%`);

  return `  <text class="title" x="${(svgWidth / 2).toFixed(0)}" y="28" text-anchor="middle">${label}</text>`;
}

function buildLegend(
  matches: DimensionMatch[],
  svgWidth: number,
  svgHeight: number,
): string {
  if (matches.length === 0) return '';

  const parts: string[] = [];
  const legendX = svgWidth - 180;
  const legendY = Math.max(10, svgHeight - 20 - matches.length * 22 - 30);
  const boxWidth = 170;
  const boxHeight = matches.length * 22 + 30;

  // Background box.
  parts.push(
    `  <rect x="${legendX}" y="${legendY}" ` +
      `width="${boxWidth}" height="${boxHeight}" ` +
      `rx="6" fill="#fff" stroke="#ccc" stroke-width="1" opacity="0.92" />`,
  );

  // Title.
  parts.push(
    `  <text class="legend-title" ` +
      `x="${legendX + 10}" y="${legendY + 18}">Dimension Matches</text>`,
  );

  // Entries.
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const color = HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length]!;
    const entryY = legendY + 36 + i * 22;

    // Color swatch.
    parts.push(
      `  <rect x="${legendX + 10}" y="${entryY - 9}" ` +
        `width="14" height="14" rx="2" fill="${color}" />`,
    );

    // Label text.
    const label = escapeXml(match.dimension.original);
    parts.push(
      `  <text class="legend-text" ` +
        `x="${legendX + 30}" y="${entryY + 2}">${label}</text>`,
    );
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a self-contained SVG string visualizing the floor plan scale
 * analysis results.
 *
 * The SVG shows:
 *  - The room polygon outline.
 *  - Detected parallel wall pairs highlighted per match.
 *  - Dashed connector lines with dimension labels.
 *  - A header with scale and confidence values.
 *  - A legend in the bottom-right corner.
 */
export function generateSVG(options: VisualizeOptions): string {
  const {
    walls,
    matches,
    pixelsPerInch,
    confidence,
    width = 800,
    height = 600,
    padding = 60,
  } = options;

  // ---- Bounding box & transform ------------------------------------------
  const bb = boundingBox(walls);

  // Guard against empty walls producing Infinity/-Infinity bounding box,
  // which cascades NaN through the transform.
  if (walls.length === 0) {
    const svg = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" ` +
        `width="${width}" height="${height}" ` +
        `viewBox="0 0 ${width} ${height}">`,
      buildStyles(),
      `  <rect width="100%" height="100%" fill="#fff" />`,
      buildTitle(pixelsPerInch, confidence, width),
      `</svg>`,
    ].join('\n');
    return svg;
  }

  const transform = buildTransform(bb, width, height, padding);

  // ---- Assemble SVG layers -----------------------------------------------
  const layers: string[] = [];

  // Layer 0: polygon outline.
  layers.push(buildPolygon(walls, transform));

  // Layer 1: match overlays (drawn on top of polygon).
  for (let i = 0; i < matches.length; i++) {
    layers.push(buildMatchOverlay(matches[i]!, i, transform));
  }

  // Layer 2: header text.
  layers.push(buildTitle(pixelsPerInch, confidence, width));

  // Layer 3: legend.
  layers.push(buildLegend(matches, width, height));

  // ---- Compose final SVG -------------------------------------------------
  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
      `width="${width}" height="${height}" ` +
      `viewBox="0 0 ${width} ${height}">`,
    buildStyles(),
    `  <rect width="100%" height="100%" fill="#fff" />`,
    ...layers,
    `</svg>`,
  ].join('\n');

  return svg;
}

/**
 * Write an SVG string to a file.
 *
 * Creates or overwrites the file at `filePath`.
 */
export async function saveSVG(svg: string, filePath: string): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(filePath, svg, 'utf-8');
}
