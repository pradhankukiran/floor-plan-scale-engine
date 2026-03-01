import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeScale } from '../src/scale.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const samplesDir = resolve(__dirname, '..', 'samples');

interface SampleData {
  name: string;
  description: string;
  walls: [number, number][];
  dimensions: string[];
  expectedScale: number;
  expectedUnit: string;
}

async function loadSample(filename: string): Promise<SampleData> {
  const raw = await readFile(resolve(samplesDir, filename), 'utf-8');
  return JSON.parse(raw) as SampleData;
}

/**
 * Assert that `actual` is within `tolerancePct` percent of `expected`.
 * For example, tolerancePct = 5 means the value must be within 5 % of expected.
 */
function expectWithinTolerance(
  actual: number,
  expected: number,
  tolerancePct: number,
  label: string,
): void {
  const lower = expected * (1 - tolerancePct / 100);
  const upper = expected * (1 + tolerancePct / 100);
  expect(
    actual,
    `${label}: expected ${actual} to be within ${tolerancePct}% of ${expected} (range [${lower.toFixed(4)}, ${upper.toFixed(4)}])`,
  ).toBeGreaterThanOrEqual(lower);
  expect(
    actual,
    `${label}: expected ${actual} to be within ${tolerancePct}% of ${expected} (range [${lower.toFixed(4)}, ${upper.toFixed(4)}])`,
  ).toBeLessThanOrEqual(upper);
}

// ---------------------------------------------------------------------------
// Full pipeline tests
// ---------------------------------------------------------------------------

describe('computeScale — full pipeline', () => {
  const TOLERANCE_PCT = 5;

  it('should compute scale for a simple rectangle (bedroom)', async () => {
    const sample = await loadSample('rectangle.json');
    const result = computeScale({
      walls: sample.walls,
      dimensions: sample.dimensions,
    });

    expectWithinTolerance(
      result.pixelsPerInch,
      sample.expectedScale,
      TOLERANCE_PCT,
      sample.name,
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should compute scale for an L-shaped room', async () => {
    const sample = await loadSample('l-shape.json');
    const result = computeScale({
      walls: sample.walls,
      dimensions: sample.dimensions,
    });

    expectWithinTolerance(
      result.pixelsPerInch,
      sample.expectedScale,
      TOLERANCE_PCT,
      sample.name,
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should compute scale for a U-shaped room', async () => {
    const sample = await loadSample('u-shape.json');
    const result = computeScale({
      walls: sample.walls,
      dimensions: sample.dimensions,
    });

    expectWithinTolerance(
      result.pixelsPerInch,
      sample.expectedScale,
      TOLERANCE_PCT,
      sample.name,
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should compute scale for a room with compound/fractional dimensions', async () => {
    const sample = await loadSample('compound.json');
    const result = computeScale({
      walls: sample.walls,
      dimensions: sample.dimensions,
    });

    expectWithinTolerance(
      result.pixelsPerInch,
      sample.expectedScale,
      TOLERANCE_PCT,
      sample.name,
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should compute scale for a metric room', async () => {
    const sample = await loadSample('metric.json');
    const result = computeScale({
      walls: sample.walls,
      dimensions: sample.dimensions,
    });

    expectWithinTolerance(
      result.pixelsPerInch,
      sample.expectedScale,
      TOLERANCE_PCT,
      sample.name,
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
  });

  it('should compute scale for a polygon with a diagonal closing edge', () => {
    // The closing edge (1300,660)->(906,601) is diagonal, so the 675px
    // vertical span is not detected by parallel-pair analysis alone.
    // Bbox extents fill the gap: X=394px (11'0"=132in), Y=675px (18'10"=226in).
    const result = computeScale({
      walls: [
        [906, 601],
        [906, 1276],
        [1004, 1276],
        [1004, 1180],
        [1300, 1180],
        [1300, 660],
      ],
      dimensions: ["18'10\"", "11'0\""],
    });

    expectWithinTolerance(
      result.pixelsPerInch,
      2.985, // ~675/226 ≈ ~394/132
      TOLERANCE_PCT,
      'diagonal-closing-edge',
    );
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.matches.length).toBeGreaterThanOrEqual(2);
  });
});
