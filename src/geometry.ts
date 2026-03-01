/**
 * geometry.ts — Core computational geometry for the floor plan scale calculator.
 *
 * Pure math, zero dependencies. All coordinates are in pixel space unless
 * otherwise noted. Angles are in radians.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A 2-D point as [x, y]. */
export type Point = [number, number];

/** A line segment defined by its two endpoints. */
export type Segment = [Point, Point];

/** A pair of parallel segments together with their perpendicular separation. */
export interface ParallelPair {
  segA: Segment;
  segB: Segment;
  /** Perpendicular distance between the two segments, in pixels. */
  perpendicularDistance: number;
}

// ---------------------------------------------------------------------------
// Helpers (not exported)
// ---------------------------------------------------------------------------

const DEG_TO_RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a closed polygon (given as an ordered list of vertices) into its
 * edge segments. The last vertex is connected back to the first.
 *
 * Zero-length (degenerate) segments are silently discarded.
 */
export function polygonToSegments(vertices: Point[]): Segment[] {
  const segments: Segment[] = [];
  const n = vertices.length;

  for (let i = 0; i < n; i++) {
    const start = vertices[i];
    const end = vertices[(i + 1) % n];

    // Skip degenerate zero-length segments.
    if (start[0] === end[0] && start[1] === end[1]) {
      continue;
    }

    segments.push([start, end]);
  }

  return segments;
}

/**
 * Return the angle of a segment in radians, normalized to the half-open
 * interval [0, PI).
 *
 * Because direction does not matter for parallelism checks we collapse
 * opposing directions into the same angle.
 */
export function segmentAngle(seg: Segment): number {
  const dx = seg[1][0] - seg[0][0];
  const dy = seg[1][1] - seg[0][1];

  // atan2 returns (-PI, PI]. We normalize to [0, PI).
  let angle = Math.atan2(dy, dx);

  if (angle < 0) {
    angle += Math.PI;
  }

  // atan2 can return exactly PI for segments pointing in the -x direction.
  // Normalize PI -> 0 so that 0-degree and 180-degree segments compare equal.
  if (angle >= Math.PI) {
    angle -= Math.PI;
  }

  return angle;
}

/**
 * Euclidean length of a segment.
 */
export function segmentLength(seg: Segment): number {
  const dx = seg[1][0] - seg[0][0];
  const dy = seg[1][1] - seg[0][1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Test whether two segments are parallel within a given angular tolerance.
 *
 * @param toleranceDeg  Maximum allowed angle difference in **degrees**.
 *                      Defaults to 5.
 */
export function areParallel(
  a: Segment,
  b: Segment,
  toleranceDeg: number = 5,
): boolean {
  const angleA = segmentAngle(a);
  const angleB = segmentAngle(b);

  const toleranceRad = toleranceDeg * DEG_TO_RAD;

  // The raw difference lies in [0, PI) because both angles are normalized.
  let diff = Math.abs(angleA - angleB);

  // Account for wraparound at PI (e.g. 1-degree vs 179-degree are only
  // 2 degrees apart in terms of parallelism).
  if (diff > Math.PI / 2) {
    diff = Math.PI - diff;
  }

  return diff <= toleranceRad;
}

/**
 * Perpendicular (shortest) distance between two parallel segments.
 *
 * Implementation: project the midpoint of segment B onto the infinite line
 * through segment A, then return the absolute distance.
 *
 * For line A defined by points p1 -> p2, the distance from an arbitrary
 * point q is:
 *
 *     d = | (p2 - p1) x (q - p1) | / | p2 - p1 |
 *
 * where "x" denotes the 2-D cross product (scalar).
 */
export function perpendicularDistance(a: Segment, b: Segment): number {
  const [p1, p2] = a;

  // Midpoint of segment B.
  const q: Point = [
    (b[0][0] + b[1][0]) / 2,
    (b[0][1] + b[1][1]) / 2,
  ];

  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];

  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return 0;

  // 2-D cross product: (p2 - p1) x (q - p1)
  const cross = dx * (q[1] - p1[1]) - dy * (q[0] - p1[0]);

  return Math.abs(cross) / len;
}

/**
 * Orthogonal projection of `point` onto the infinite line passing through
 * `lineStart` and `lineEnd`.
 *
 * Returns the coordinates of the projected point.
 */
export function projectPointOnLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
): Point {
  const dx = lineEnd[0] - lineStart[0];
  const dy = lineEnd[1] - lineStart[1];

  const lenSq = dx * dx + dy * dy;

  // Degenerate case: lineStart and lineEnd are the same point.
  if (lenSq === 0) {
    return [lineStart[0], lineStart[1]];
  }

  // Parameter t of the projection along the line direction.
  const t =
    ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / lenSq;

  return [lineStart[0] + t * dx, lineStart[1] + t * dy];
}

/**
 * Discover all pairs of parallel segments that are likely to represent
 * opposing walls in a floor plan.
 *
 * @param segments   The raw wall segments (e.g. from `polygonToSegments`).
 * @param minLength  Minimum segment length in pixels. Segments shorter than
 *                   this are ignored to filter out tiny stubs. Also used as
 *                   the minimum perpendicular separation threshold (pairs
 *                   closer than this are assumed to be wall-thickness
 *                   artifacts). Defaults to 20.
 * @returns          Parallel pairs sorted by perpendicular distance
 *                   descending, deduplicated so that near-equal distances
 *                   keep only the pair with the greater combined length.
 */
export function findParallelPairs(
  segments: Segment[],
  minLength: number = 20,
): ParallelPair[] {
  // ----- Step 1: filter out short segments --------------------------------
  const long = segments.filter((s) => segmentLength(s) >= minLength);

  // ----- Step 2: collect all parallel pairs --------------------------------
  const pairs: ParallelPair[] = [];

  for (let i = 0; i < long.length; i++) {
    for (let j = i + 1; j < long.length; j++) {
      if (!areParallel(long[i], long[j])) continue;

      const dist = perpendicularDistance(long[i], long[j]);

      // Skip pairs that are too close — likely wall thickness, not room span.
      if (dist < minLength) continue;

      pairs.push({
        segA: long[i],
        segB: long[j],
        perpendicularDistance: dist,
      });
    }
  }

  // ----- Step 3: sort descending by perpendicular distance -----------------
  pairs.sort((a, b) => b.perpendicularDistance - a.perpendicularDistance);

  // ----- Step 4: deduplicate near-equal distances --------------------------
  return deduplicatePairs(pairs);
}

/**
 * Deduplicate parallel pairs with near-equal perpendicular distances.
 *
 * When two pairs have very similar distances (within 5 px), keep only the one
 * whose two segments have the greater combined length. Input should be sorted
 * descending by perpendicular distance.
 */
export function deduplicatePairs(pairs: ParallelPair[]): ParallelPair[] {
  const DISTANCE_TOLERANCE = 5; // pixels

  const combinedLength = (p: ParallelPair): number =>
    segmentLength(p.segA) + segmentLength(p.segB);

  const deduplicated: ParallelPair[] = [];

  for (const pair of pairs) {
    const duplicate = deduplicated.find(
      (existing) =>
        Math.abs(existing.perpendicularDistance - pair.perpendicularDistance) <=
        DISTANCE_TOLERANCE,
    );

    if (duplicate) {
      if (combinedLength(pair) > combinedLength(duplicate)) {
        const idx = deduplicated.indexOf(duplicate);
        deduplicated[idx] = pair;
      }
    } else {
      deduplicated.push(pair);
    }
  }

  return deduplicated;
}

/**
 * Compute bounding-box axis-aligned extent pairs for a polygon.
 *
 * Returns up to 2 synthetic `ParallelPair` objects representing the full X and
 * Y extents of the polygon's bounding box. These capture room spans that may
 * not appear as parallel segment pairs when the polygon has diagonal closing
 * edges.
 *
 * @param vertices   Ordered polygon vertices.
 * @param minLength  Minimum extent in pixels; extents smaller than this are
 *                   omitted. Defaults to 20.
 */
export function findExtentPairs(
  vertices: Point[],
  minLength: number = 20,
): ParallelPair[] {
  if (vertices.length < 3) return [];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [x, y] of vertices) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const pairs: ParallelPair[] = [];

  const xExtent = maxX - minX;
  if (xExtent >= minLength) {
    // Two vertical segments on left/right bbox edges.
    pairs.push({
      segA: [[minX, minY], [minX, maxY]],
      segB: [[maxX, minY], [maxX, maxY]],
      perpendicularDistance: xExtent,
    });
  }

  const yExtent = maxY - minY;
  if (yExtent >= minLength) {
    // Two horizontal segments on top/bottom bbox edges.
    pairs.push({
      segA: [[minX, minY], [maxX, minY]],
      segB: [[minX, maxY], [maxX, maxY]],
      perpendicularDistance: yExtent,
    });
  }

  return pairs;
}
