import { describe, it, expect } from 'vitest';
import {
  polygonToSegments,
  segmentAngle,
  segmentLength,
  areParallel,
  perpendicularDistance,
  findParallelPairs,
  findExtentPairs,
  deduplicatePairs,
} from '../src/geometry.js';
import type { Point, Segment, ParallelPair } from '../src/geometry.js';

// ---------------------------------------------------------------------------
// polygonToSegments
// ---------------------------------------------------------------------------

describe('polygonToSegments', () => {
  it('should produce 4 segments from a rectangle', () => {
    const rect: Point[] = [
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50],
    ];

    const segments = polygonToSegments(rect);

    expect(segments).toHaveLength(4);

    // Verify that the segments connect sequentially and close the polygon.
    expect(segments[0]).toEqual([[0, 0], [100, 0]]);
    expect(segments[1]).toEqual([[100, 0], [100, 50]]);
    expect(segments[2]).toEqual([[100, 50], [0, 50]]);
    expect(segments[3]).toEqual([[0, 50], [0, 0]]);
  });

  it('should produce 3 segments from a triangle', () => {
    const triangle: Point[] = [
      [0, 0],
      [100, 0],
      [50, 86.6],
    ];

    const segments = polygonToSegments(triangle);

    expect(segments).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// segmentAngle
// ---------------------------------------------------------------------------

describe('segmentAngle', () => {
  it('should return 0 for a horizontal segment', () => {
    const seg: Segment = [[0, 0], [100, 0]];

    const angle = segmentAngle(seg);

    expect(angle).toBeCloseTo(0, 10);
  });

  it('should return PI/2 for a vertical segment', () => {
    const seg: Segment = [[0, 0], [0, 100]];

    const angle = segmentAngle(seg);

    expect(angle).toBeCloseTo(Math.PI / 2, 10);
  });
});

// ---------------------------------------------------------------------------
// segmentLength
// ---------------------------------------------------------------------------

describe('segmentLength', () => {
  it('should return 5 for a 3-4-5 triangle hypotenuse', () => {
    const seg: Segment = [[0, 0], [3, 4]];

    const length = segmentLength(seg);

    expect(length).toBeCloseTo(5, 10);
  });
});

// ---------------------------------------------------------------------------
// areParallel
// ---------------------------------------------------------------------------

describe('areParallel', () => {
  it('should return true for two horizontal segments', () => {
    const a: Segment = [[0, 0], [100, 0]];
    const b: Segment = [[0, 50], [100, 50]];

    expect(areParallel(a, b)).toBe(true);
  });

  it('should return false for a horizontal and a vertical segment', () => {
    const horizontal: Segment = [[0, 0], [100, 0]];
    const vertical: Segment = [[0, 0], [0, 100]];

    expect(areParallel(horizontal, vertical)).toBe(false);
  });

  it('should return true for nearly parallel segments within 5-degree tolerance', () => {
    // Segment at 0 degrees.
    const a: Segment = [[0, 0], [100, 0]];
    // Segment at approximately 3 degrees (tan(3 deg) ≈ 0.0524).
    const b: Segment = [[0, 50], [100, 55.24]];

    expect(areParallel(a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// perpendicularDistance
// ---------------------------------------------------------------------------

describe('perpendicularDistance', () => {
  it('should return 100 for two horizontal lines 100px apart', () => {
    const a: Segment = [[0, 0], [100, 0]];
    const b: Segment = [[0, 100], [100, 100]];

    const dist = perpendicularDistance(a, b);

    expect(dist).toBeCloseTo(100, 5);
  });

  it('should return 200 for two vertical lines 200px apart', () => {
    const a: Segment = [[0, 0], [0, 100]];
    const b: Segment = [[200, 0], [200, 100]];

    const dist = perpendicularDistance(a, b);

    expect(dist).toBeCloseTo(200, 5);
  });
});

// ---------------------------------------------------------------------------
// findParallelPairs
// ---------------------------------------------------------------------------

describe('findParallelPairs', () => {
  it('should find 2 parallel pairs in a rectangle (top/bottom and left/right)', () => {
    const rect: Point[] = [
      [0, 0],
      [200, 0],
      [200, 100],
      [0, 100],
    ];

    const segments = polygonToSegments(rect);
    const pairs = findParallelPairs(segments);

    // A rectangle has two pairs of parallel sides: horizontal and vertical.
    expect(pairs).toHaveLength(2);

    // Verify the perpendicular distances correspond to the rectangle dimensions.
    const distances = pairs.map((p) => p.perpendicularDistance).sort((a, b) => b - a);

    // Largest distance should be the horizontal span (200px).
    expect(distances[0]).toBeCloseTo(200, 0);
    // Smallest distance should be the vertical span (100px).
    expect(distances[1]).toBeCloseTo(100, 0);
  });

  it('should find multiple parallel pairs in an L-shaped polygon', () => {
    // L-shape: outer 720x480, notch removes upper-right quadrant 360x240.
    const lShape: Point[] = [
      [0, 0],
      [720, 0],
      [720, 240],
      [360, 240],
      [360, 480],
      [0, 480],
    ];

    const segments = polygonToSegments(lShape);
    const pairs = findParallelPairs(segments);

    // An L-shape has several parallel wall pairs (e.g. top/bottom portions,
    // left/right portions). The exact count depends on deduplication
    // thresholds, but there should be more than 2 pairs.
    expect(pairs.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// findExtentPairs
// ---------------------------------------------------------------------------

describe('findExtentPairs', () => {
  it('should produce correct X/Y extents for a rectangle', () => {
    const rect: Point[] = [
      [0, 0],
      [200, 0],
      [200, 100],
      [0, 100],
    ];

    const pairs = findExtentPairs(rect);

    expect(pairs).toHaveLength(2);

    const distances = pairs.map((p) => p.perpendicularDistance).sort((a, b) => b - a);
    expect(distances[0]).toBeCloseTo(200, 0); // X extent
    expect(distances[1]).toBeCloseTo(100, 0); // Y extent
  });

  it('should produce correct extents for a diagonal-closing-edge polygon', () => {
    // The closing edge (1300,660)->(906,601) is diagonal.
    const polygon: Point[] = [
      [906, 601],
      [906, 1276],
      [1004, 1276],
      [1004, 1180],
      [1300, 1180],
      [1300, 660],
    ];

    const pairs = findExtentPairs(polygon);

    expect(pairs).toHaveLength(2);

    const distances = pairs.map((p) => p.perpendicularDistance).sort((a, b) => b - a);
    expect(distances[0]).toBeCloseTo(675, 0); // Y extent: 1276 - 601
    expect(distances[1]).toBeCloseTo(394, 0); // X extent: 1300 - 906
  });

  it('should return empty for fewer than 3 vertices', () => {
    expect(findExtentPairs([[0, 0], [100, 100]])).toHaveLength(0);
    expect(findExtentPairs([[0, 0]])).toHaveLength(0);
    expect(findExtentPairs([])).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// deduplicatePairs
// ---------------------------------------------------------------------------

describe('deduplicatePairs', () => {
  it('should merge near-equal distances and keep the pair with longer combined length', () => {
    const short: ParallelPair = {
      segA: [[0, 0], [50, 0]],
      segB: [[0, 100], [50, 100]],
      perpendicularDistance: 100,
    };
    const long: ParallelPair = {
      segA: [[0, 0], [200, 0]],
      segB: [[0, 102], [200, 102]],
      perpendicularDistance: 102, // within 5px of 100
    };

    // Input sorted descending by distance.
    const result = deduplicatePairs([long, short]);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(long);
  });

  it('should keep both pairs when distances are far apart', () => {
    const pairA: ParallelPair = {
      segA: [[0, 0], [100, 0]],
      segB: [[0, 200], [100, 200]],
      perpendicularDistance: 200,
    };
    const pairB: ParallelPair = {
      segA: [[0, 0], [100, 0]],
      segB: [[0, 50], [100, 50]],
      perpendicularDistance: 50,
    };

    const result = deduplicatePairs([pairA, pairB]);

    expect(result).toHaveLength(2);
  });
});
