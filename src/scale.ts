/**
 * scale.ts — Main public API for the floor plan scale calculator.
 *
 * Orchestrates the full pipeline: polygon -> segments -> parallel pairs ->
 * dimension parsing -> matching -> consensus scale. Consumers should
 * typically only need to call `computeScale()`.
 *
 * Zero external dependencies.
 */

import {
  polygonToSegments,
  findParallelPairs,
  findExtentPairs,
  deduplicatePairs,
} from './geometry.js';
import type { Point, Segment, ParallelPair } from './geometry.js';
import { parseDimensions } from './parser.js';
import { findBestMatching } from './matcher.js';
import type { MatchResult } from './matcher.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Input to the scale-computation pipeline. */
export interface ScaleInput {
  /** Ordered polygon vertices representing wall outlines, in pixels. */
  walls: Point[];
  /** Raw OCR dimension strings (e.g. "12' 6\"", "3.5m", "14 ft"). */
  dimensions: string[];
  /**
   * Minimum wall segment length in pixels. Segments shorter than this are
   * ignored as noise. Also used as the minimum perpendicular separation for
   * parallel pairs. Defaults to 20.
   */
  minWallLength?: number;
}

/** Full output of the scale-computation pipeline. */
export interface ScaleOutput extends MatchResult {
  /** All wall segments extracted from the polygon. */
  segments: Segment[];
  /** All parallel pairs discovered among the wall segments. */
  parallelPairs: ParallelPair[];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the pixels-per-inch scale factor for a floor plan.
 *
 * Pipeline stages:
 * 1. Convert the wall polygon to line segments.
 * 2. Discover parallel wall pairs (opposing walls of rooms).
 * 3. Parse raw OCR dimension strings into structured values.
 * 4. Match pairs to dimensions and derive a consensus scale.
 *
 * @param input  Wall polygon vertices, raw dimension strings, and options.
 * @returns      The consensus scale, all matches, and intermediate data.
 */
export function computeScale(input: ScaleInput): ScaleOutput {
  const minLength = input.minWallLength ?? 20;

  // Stage 1: Polygon vertices -> edge segments.
  const segments = polygonToSegments(input.walls);

  // Stage 2: Segments -> parallel pairs (opposing walls).
  const parallelPairs = findParallelPairs(segments, minLength);

  // Stage 2b: Add axis-aligned bbox extent pairs to catch spans missed by
  // diagonal closing edges, then deduplicate the merged list.
  const extentPairs = findExtentPairs(input.walls, minLength);
  const allPairs = deduplicatePairs(
    [...parallelPairs, ...extentPairs].sort(
      (a, b) => b.perpendicularDistance - a.perpendicularDistance,
    ),
  );

  // Stage 3: Raw OCR strings -> structured ParsedDimension objects.
  const parsedDimensions = parseDimensions(input.dimensions);

  // Stage 4: Pair-dimension matching -> consensus scale.
  const matchResult = findBestMatching(allPairs, parsedDimensions);

  return {
    ...matchResult,
    segments,
    parallelPairs: allPairs,
  };
}
