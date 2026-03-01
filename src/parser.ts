/**
 * parser.ts -- Architectural dimension string parser.
 *
 * Parses OCR-extracted dimension strings from floor plans into a
 * consistent unit (inches). Handles imperial (feet/inches with
 * fractions, decimal feet) and metric (m, cm, mm) formats.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParsedDimension {
  /** The raw input string. */
  original: string;
  /** Total value converted to inches. */
  inches: number;
  /** Whole-feet component (imperial) or 0 (metric). */
  feet: number;
  /** Remaining inches component (imperial) or 0 (metric). */
  inchPart: number;
  /** Whether the source string was imperial or metric. */
  unit: 'imperial' | 'metric';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const METERS_TO_INCHES = 39.3701;
const CM_TO_INCHES = METERS_TO_INCHES / 100;
const MM_TO_INCHES = METERS_TO_INCHES / 1000;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Evaluate a fractional string such as "1/2" and return its decimal
 * value.  Returns 0 when the input is empty or undefined.
 */
function parseFraction(frac: string | undefined): number {
  if (!frac) return 0;
  const trimmed = frac.trim();
  if (!trimmed) return 0;
  const parts = trimmed.split('/');
  if (parts.length !== 2) return 0;
  const num = Number(parts[0]);
  const den = Number(parts[1]);
  if (den === 0 || Number.isNaN(num) || Number.isNaN(den)) return 0;
  return num / den;
}

/**
 * Round to a fixed number of decimal places to avoid floating-point
 * drift (e.g. 39.3701 * 4.5 = 177.16545000000002).
 */
function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Regex patterns -- ordered from most specific to least specific so
// the first match wins.
// ---------------------------------------------------------------------------

/**
 * Metric patterns.
 *
 * Examples:
 *   4.5m   4.5 m   4500mm   450cm
 *
 * Capture groups:
 *   1 = numeric value (may contain decimals)
 *   2 = unit (m, cm, mm)
 */
const METRIC_RE = /^\s*(\d+(?:\.\d+)?)\s*(mm|cm|m)\s*$/i;

/**
 * Feet-and-inches with an optional fraction on the inch part.
 *
 * Examples:
 *   23' 6"          23'-6"          23' 6''
 *   23'6"           23' - 6"        23 ft 6 in
 *   10' 6 1/2"      10'-6 1/2"
 *
 * Breakdown:
 *   ^\s*                        leading whitespace
 *   (\d+(?:\.\d+)?)             (1) feet value (integer or decimal)
 *   \s*(?:'|ft)\s*              feet marker: ' or "ft"
 *   (?:                         begin optional inch group
 *     [-\s]*\s*                   separator: dash and/or spaces
 *     (\d+)?\s*                   (2) whole inches (optional)
 *     (\d+\/\d+)?\s*             (3) fraction e.g. "1/2" (optional)
 *     (?:"|''|in)                 inch marker: " or '' or "in"
 *   )?                          end optional inch group
 *   \s*$                        trailing whitespace
 */
const FEET_INCHES_RE =
  /^\s*(\d+(?:\.\d+)?)\s*(?:'|ft)\s*(?:[-\s]*\s*(\d+)?\s*(\d+\/\d+)?\s*(?:"|''|in))?\s*$/;

/**
 * Inches-only (no feet marker).
 *
 * Examples:
 *   6"     6''     6 1/2"
 *
 * Capture groups:
 *   1 = whole inches
 *   2 = fraction (optional)
 */
const INCHES_ONLY_RE = /^\s*(\d+)\s*(\d+\/\d+)?\s*(?:"|''|in)\s*$/;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse a single dimension string into a {@link ParsedDimension}.
 *
 * Returns `null` when the string cannot be understood.
 */
export function parseDimension(raw: string): ParsedDimension | null {
  if (!raw || typeof raw !== 'string') return null;

  // Normalise the input: collapse multiple spaces, trim.
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return null;

  // --- Metric -----------------------------------------------------------
  const metricMatch = cleaned.match(METRIC_RE);
  if (metricMatch) {
    const value = Number(metricMatch[1]);
    const unit = metricMatch[2].toLowerCase();

    let inches: number;
    switch (unit) {
      case 'm':
        inches = value * METERS_TO_INCHES;
        break;
      case 'cm':
        inches = value * CM_TO_INCHES;
        break;
      case 'mm':
        inches = value * MM_TO_INCHES;
        break;
      default:
        return null;
    }

    // Round to 4 decimal places to tame floating-point noise while
    // preserving useful precision for downstream scale calculations.
    inches = round(inches);

    return {
      original: raw,
      inches,
      feet: 0,
      inchPart: 0,
      unit: 'metric',
    };
  }

  // --- Feet (optionally with inches) ------------------------------------
  const feetMatch = cleaned.match(FEET_INCHES_RE);
  if (feetMatch) {
    const feetValue = Number(feetMatch[1]);
    const wholeInches = feetMatch[2] ? Number(feetMatch[2]) : 0;
    const fracInches = parseFraction(feetMatch[3]);

    const totalInchPart = round(wholeInches + fracInches);
    const feet = Math.floor(feetValue);
    const decimalFeetInches = round((feetValue - feet) * 12);
    const totalInches = round(feet * 12 + decimalFeetInches + totalInchPart);

    return {
      original: raw,
      inches: totalInches,
      feet,
      inchPart: round(decimalFeetInches + totalInchPart),
      unit: 'imperial',
    };
  }

  // --- Inches only ------------------------------------------------------
  const inchMatch = cleaned.match(INCHES_ONLY_RE);
  if (inchMatch) {
    const whole = Number(inchMatch[1]);
    const frac = parseFraction(inchMatch[2]);
    const totalInches = round(whole + frac);

    return {
      original: raw,
      inches: totalInches,
      feet: 0,
      inchPart: totalInches,
      unit: 'imperial',
    };
  }

  // No pattern matched.
  return null;
}

/**
 * Parse an array of dimension strings, discard unparseable entries,
 * and return the results sorted by inches descending (largest first).
 */
export function parseDimensions(raws: string[]): ParsedDimension[] {
  const results: ParsedDimension[] = [];

  for (const raw of raws) {
    const parsed = parseDimension(raw);
    if (parsed) {
      results.push(parsed);
    }
  }

  // Sort descending by total inches.
  results.sort((a, b) => b.inches - a.inches);
  return results;
}

/**
 * Format a value in inches as a human-readable feet-and-inches string.
 *
 * Examples:
 *   282   -> `23' 6"`
 *   156   -> `13' 0"`
 *     6   -> `0' 6"`
 *   126.5 -> `10' 6.5"`
 */
export function formatInches(inches: number): string {
  const totalInches = Math.abs(inches);
  const feet = Math.floor(totalInches / 12);
  const remaining = round(totalInches - feet * 12);

  // Decide how to render the inch part: omit unnecessary decimals.
  const inchStr = Number.isInteger(remaining)
    ? String(remaining)
    : String(remaining);

  return `${feet}' ${inchStr}"`;
}
