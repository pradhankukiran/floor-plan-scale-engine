/**
 * matcher.ts — Matching engine for the floor plan scale calculator.
 *
 * Matches pixel distances from parallel wall pairs to real-world dimensions
 * (parsed from OCR strings) and computes a consensus pixels-per-inch scale
 * factor.
 *
 * Pure logic, zero external dependencies.
 */

import type { ParallelPair } from './geometry.js';
import type { ParsedDimension } from './parser.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single matched pair-dimension association with its derived scale. */
export interface DimensionMatch {
  pair: ParallelPair;
  dimension: ParsedDimension;
  /** Derived scale: pair.perpendicularDistance / dimension.inches. */
  pixelsPerInch: number;
  /** How far this match's scale deviates from the consensus (0 = perfect). */
  residual: number;
}

/** The result of running the matching algorithm. */
export interface MatchResult {
  /** Consensus pixels-per-inch scale factor. */
  pixelsPerInch: number;
  /** Confidence score in the range [0, 1]. */
  confidence: number;
  /** Successfully matched pair-dimension associations. */
  matches: DimensionMatch[];
  /** Pairs that could not be matched to any dimension. */
  unmatchedPairs: ParallelPair[];
  /** Dimensions that could not be matched to any pair. */
  unmatchedDimensions: ParsedDimension[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum relative error allowed when matching a pair to a dimension.
 * A pair's pixel distance must be within 5 % of the expected distance
 * (dimension.inches * candidateScale) to be considered a match.
 */
const MATCH_TOLERANCE = 0.05;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Attempt to greedily assign pairs to dimensions under a given candidate
 * scale. Each pair is matched to the dimension whose expected pixel distance
 * is closest, provided the relative error is within `MATCH_TOLERANCE`.
 *
 * Both pairs and dimensions are consumed at most once (one-to-one matching).
 *
 * @returns An array of [pairIndex, dimensionIndex] tuples for the matches
 *          found, plus the sum of absolute relative errors (total residual).
 */
function matchUnderScale(
  pairs: ParallelPair[],
  dimensions: ParsedDimension[],
  scale: number,
): { assignments: [number, number][]; totalResidual: number } {
  const usedDimensions = new Set<number>();
  const assignments: [number, number][] = [];
  let totalResidual = 0;

  for (let pi = 0; pi < pairs.length; pi++) {
    const pairDist = pairs[pi]!.perpendicularDistance;

    let bestDi = -1;
    let bestError = Infinity;

    for (let di = 0; di < dimensions.length; di++) {
      if (usedDimensions.has(di)) continue;

      const expectedDist = dimensions[di]!.inches * scale;
      const relativeError = Math.abs(pairDist - expectedDist) / expectedDist;

      if (relativeError < bestError) {
        bestError = relativeError;
        bestDi = di;
      }
    }

    // Accept the match only if within tolerance.
    if (bestDi !== -1 && bestError <= MATCH_TOLERANCE) {
      usedDimensions.add(bestDi);
      assignments.push([pi, bestDi]);
      totalResidual += bestError;
    }
  }

  return { assignments, totalResidual };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a weighted-average consensus scale from a set of matches.
 *
 * Longer dimensions carry more weight because they yield more precise scale
 * measurements (a 1-pixel error matters less over 500 pixels than over 50).
 *
 * @returns The weighted average of `pixelsPerInch` across all matches,
 *          or `0` if there are no matches.
 */
export function computeConsensusScale(matches: DimensionMatch[]): number {
  if (matches.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const m of matches) {
    const weight = m.dimension.inches;
    weightedSum += m.pixelsPerInch * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Find the optimal matching between parallel wall pairs and parsed
 * dimensions, and derive a consensus pixels-per-inch scale factor.
 *
 * Algorithm overview:
 * 1. Generate every candidate scale from each (pair, dimension) combo.
 * 2. For each candidate scale, greedily match all pairs to dimensions
 *    within a 5 % tolerance.
 * 3. Select the candidate that maximizes the number of matches.
 *    Ties are broken by lowest total residual.
 * 4. Refine the final scale using a weighted average of matched scales.
 */
export function findBestMatching(
  pairs: ParallelPair[],
  dimensions: ParsedDimension[],
): MatchResult {
  // Edge case: nothing to match.
  if (pairs.length === 0 || dimensions.length === 0) {
    return {
      pixelsPerInch: 0,
      confidence: 0,
      matches: [],
      unmatchedPairs: [...pairs],
      unmatchedDimensions: [...dimensions],
    };
  }

  // Sort pairs by perpendicular distance descending (largest rooms first).
  const sortedPairs = [...pairs].sort(
    (a, b) => b.perpendicularDistance - a.perpendicularDistance,
  );

  // Sort dimensions by inches descending (largest real-world dims first).
  const sortedDims = [...dimensions].sort((a, b) => b.inches - a.inches);

  // ----- Step 1: Generate all candidate scale values -----------------------
  //
  // For each pair i and dimension j, scale_ij = pixelDist_i / inches_j.
  // We deduplicate close values later implicitly by picking the best scorer.

  interface Candidate {
    scale: number;
    assignments: [number, number][];
    totalResidual: number;
  }

  let bestCandidate: Candidate | undefined;

  for (let pi = 0; pi < sortedPairs.length; pi++) {
    for (let di = 0; di < sortedDims.length; di++) {
      const inches = sortedDims[di]!.inches;
      if (inches <= 0) continue; // Guard against zero/negative dimensions.

      const candidateScale =
        sortedPairs[pi]!.perpendicularDistance / inches;

      // ----- Step 2: Score this candidate ----------------------------------
      const { assignments, totalResidual } = matchUnderScale(
        sortedPairs,
        sortedDims,
        candidateScale,
      );

      // ----- Step 3: Keep the best -----------------------------------------
      const isBetter =
        bestCandidate === undefined ||
        assignments.length > bestCandidate.assignments.length ||
        (assignments.length === bestCandidate.assignments.length &&
          totalResidual < bestCandidate.totalResidual);

      if (isBetter) {
        bestCandidate = { scale: candidateScale, assignments, totalResidual };
      }
    }
  }

  // Should never happen given the early return above, but satisfy TS.
  if (!bestCandidate || bestCandidate.assignments.length === 0) {
    return {
      pixelsPerInch: 0,
      confidence: 0,
      matches: [],
      unmatchedPairs: [...pairs],
      unmatchedDimensions: [...dimensions],
    };
  }

  // ----- Step 4: Build DimensionMatch objects & compute consensus ---------

  const matchedPairIndices = new Set<number>();
  const matchedDimIndices = new Set<number>();

  // First pass: build preliminary matches (residual will be filled later).
  const preliminaryMatches: DimensionMatch[] = [];

  for (const [pi, di] of bestCandidate.assignments) {
    const pair = sortedPairs[pi]!;
    const dim = sortedDims[di]!;
    const ppi = pair.perpendicularDistance / dim.inches;

    matchedPairIndices.add(pi);
    matchedDimIndices.add(di);

    preliminaryMatches.push({
      pair,
      dimension: dim,
      pixelsPerInch: ppi,
      residual: 0, // Placeholder — filled after consensus is known.
    });
  }

  // Compute refined consensus scale from the actual matches.
  const consensusScale = computeConsensusScale(preliminaryMatches);

  // Second pass: fill in residuals relative to the consensus scale.
  for (const m of preliminaryMatches) {
    m.residual =
      consensusScale > 0
        ? Math.abs(m.pixelsPerInch - consensusScale) / consensusScale
        : 0;
  }

  // Confidence: fraction of dimensions that were successfully matched.
  // We use dimensions (not pairs) as the denominator because a polygon
  // naturally produces many more wall-span pairs than labeled dimensions.
  // Unmatched pairs are expected; unmatched dimensions are the real signal.
  const confidence = preliminaryMatches.length / sortedDims.length;

  // Collect unmatched items (using original arrays to preserve identity).
  const unmatchedPairs = sortedPairs.filter(
    (_, i) => !matchedPairIndices.has(i),
  );
  const unmatchedDimensions = sortedDims.filter(
    (_, i) => !matchedDimIndices.has(i),
  );

  return {
    pixelsPerInch: consensusScale,
    confidence,
    matches: preliminaryMatches,
    unmatchedPairs,
    unmatchedDimensions,
  };
}
