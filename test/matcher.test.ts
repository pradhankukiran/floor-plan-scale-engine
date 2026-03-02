import { describe, it, expect } from 'vitest';
import { findBestMatching } from '../src/matcher.js';
import type { ParallelPair } from '../src/geometry.js';
import type { ParsedDimension } from '../src/parser.js';

function makePair(distance: number): ParallelPair {
  return {
    segA: [[0, 0], [100, 0]],
    segB: [[0, distance], [100, distance]],
    perpendicularDistance: distance,
  };
}

function makeDimension(original: string, inches: number): ParsedDimension {
  const feet = Math.floor(inches / 12);
  const inchPart = Number((inches - feet * 12).toFixed(4));

  return {
    original,
    inches,
    feet,
    inchPart,
    unit: 'imperial',
  };
}

describe('findBestMatching', () => {
  it('should prefer larger structural spans over more numerous small-span matches', () => {
    const pairs: ParallelPair[] = [
      makePair(480),
      makePair(480),
      makePair(80),
      makePair(80),
      makePair(80),
    ];
    const dimensions: ParsedDimension[] = [
      makeDimension('12\' 0"', 144),
      makeDimension('12\' 0"', 144),
      makeDimension('2\' 6"', 30),
      makeDimension('2\' 6"', 30),
      makeDimension('2\' 6"', 30),
    ];

    const result = findBestMatching(pairs, dimensions);

    expect(result.pixelsPerInch).toBeCloseTo(480 / 144, 6);
    expect(result.matches).toHaveLength(2);
    expect(result.matches.every((match) => match.dimension.inches === 144)).toBe(true);
  });

  it('should keep confidence below perfect when only small spans are covered', () => {
    const pairs: ParallelPair[] = [
      makePair(400),
      makePair(400),
      makePair(80),
      makePair(80),
      makePair(80),
    ];
    const dimensions: ParsedDimension[] = [
      makeDimension('2\' 6"', 30),
      makeDimension('2\' 6"', 30),
      makeDimension('2\' 6"', 30),
    ];

    const result = findBestMatching(pairs, dimensions);

    expect(result.pixelsPerInch).toBeCloseTo(80 / 30, 6);
    expect(result.confidence).toBeLessThan(0.75);
  });
});
