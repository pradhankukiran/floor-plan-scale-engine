import { describe, it, expect } from 'vitest';
import {
  parseDimension,
  parseDimensions,
  formatInches,
} from '../src/parser.js';

// ---------------------------------------------------------------------------
// parseDimension — Imperial formats
// ---------------------------------------------------------------------------

describe('parseDimension — imperial formats', () => {
  it('should parse 23\' 6" as 282 inches', () => {
    const result = parseDimension('23\' 6"');
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(282);
  });

  it('should parse 23\'-6" as 282 inches', () => {
    const result = parseDimension('23\'-6"');
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(282);
  });

  it("should parse 23' 6'' as 282 inches", () => {
    const result = parseDimension("23' 6''");
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(282);
  });

  it('should parse 23\'6" as 282 inches', () => {
    const result = parseDimension('23\'6"');
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(282);
  });

  it('should parse 13\' 0" as 156 inches', () => {
    const result = parseDimension('13\' 0"');
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(156);
  });

  it("should parse 13' (feet only, no inches) as 156 inches", () => {
    const result = parseDimension("13'");
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(156);
  });

  it('should parse 6" (inches only) as 6 inches', () => {
    const result = parseDimension('6"');
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(6);
  });

  it('should parse decimal inches-only values', () => {
    const result = parseDimension('8.25in');
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(8.25);
    expect(result!.inchPart).toBe(8.25);
  });

  it("should parse 23.5' (decimal feet) as 282 inches", () => {
    const result = parseDimension("23.5'");
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(282);
  });

  it('should parse 10\' 6 1/2" (fractional inches) as 126.5 inches', () => {
    const result = parseDimension('10\' 6 1/2"');
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(126.5);
  });

  it('should normalize carried inches in mixed decimal-feet inputs', () => {
    const result = parseDimension('10.5\' 6"');
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(132);
    expect(result!.feet).toBe(11);
    expect(result!.inchPart).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseDimension — Metric formats
// ---------------------------------------------------------------------------

describe('parseDimension — metric formats', () => {
  it('should parse 4.5m as approximately 177.165 inches', () => {
    const result = parseDimension('4.5m');
    expect(result).not.toBeNull();
    expect(result!.inches).toBeCloseTo(177.165, 1);
    expect(result!.unit).toBe('metric');
  });

  it('should parse 450cm as approximately 177.165 inches', () => {
    const result = parseDimension('450cm');
    expect(result).not.toBeNull();
    expect(result!.inches).toBeCloseTo(177.165, 1);
    expect(result!.unit).toBe('metric');
  });

  it('should parse 4500mm as approximately 177.165 inches', () => {
    const result = parseDimension('4500mm');
    expect(result).not.toBeNull();
    expect(result!.inches).toBeCloseTo(177.165, 1);
    expect(result!.unit).toBe('metric');
  });

  it('should parse leading-decimal metric values', () => {
    const result = parseDimension('.5m');
    expect(result).not.toBeNull();
    expect(result!.inches).toBeCloseTo(19.685, 2);
    expect(result!.unit).toBe('metric');
  });

  it('should parse mixed-number metric values', () => {
    const result = parseDimension('1 1/2 m');
    expect(result).not.toBeNull();
    expect(result!.inches).toBe(59.0552);
    expect(result!.unit).toBe('metric');
  });
});

// ---------------------------------------------------------------------------
// parseDimension — Garbage / invalid input
// ---------------------------------------------------------------------------

describe('parseDimension — invalid input', () => {
  it('should return null for a garbage string', () => {
    const result = parseDimension('not a dimension at all');
    expect(result).toBeNull();
  });

  it('should return null for an empty string', () => {
    const result = parseDimension('');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseDimensions (batch)
// ---------------------------------------------------------------------------

describe('parseDimensions', () => {
  it('should filter out unparseable entries and sort remaining descending by inches', () => {
    const results = parseDimensions([
      '23\' 6"',
      'garbage',
      '13\' 0"',
      '6"',
    ]);

    // "garbage" should be filtered out, leaving 3 valid entries.
    expect(results).toHaveLength(3);

    // Results should be sorted descending by inches.
    expect(results[0]!.inches).toBe(282); // 23' 6"
    expect(results[1]!.inches).toBe(156); // 13' 0"
    expect(results[2]!.inches).toBe(6);   // 6"
  });
});

// ---------------------------------------------------------------------------
// formatInches
// ---------------------------------------------------------------------------

describe('formatInches', () => {
  it('should format 282 inches as 23\' 6"', () => {
    expect(formatInches(282)).toBe('23\' 6"');
  });

  it('should format 156 inches as 13\' 0"', () => {
    expect(formatInches(156)).toBe('13\' 0"');
  });
});
