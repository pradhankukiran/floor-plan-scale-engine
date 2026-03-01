/**
 * demo.ts — Demo runner for the floor plan scale engine.
 *
 * Reads all JSON sample files from ./samples/, runs the scale-computation
 * pipeline, prints formatted results to the console, and generates SVG
 * visualizations in ./output/.
 *
 * Usage:
 *   tsx src/demo.ts
 */

import { readFile, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

import { computeScale } from './scale.js';
import { generateSVG, saveSVG } from './visualize.js';
import type { Point } from './geometry.js';

// ---------------------------------------------------------------------------
// Path setup
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAMPLES_DIR = path.resolve(__dirname, '..', 'samples');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'output');

// ---------------------------------------------------------------------------
// Types for sample JSON files
// ---------------------------------------------------------------------------

interface SampleFile {
  name: string;
  description: string;
  walls: Point[];
  dimensions: string[];
  expectedScale: number;
  expectedUnit: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const SEPARATOR_THICK = '\u2550'.repeat(39);
const SEPARATOR_THIN = '\u2500'.repeat(39);

function formatInchesLabel(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remaining = Math.round((inches - feet * 12) * 10) / 10;
  const inchStr = Number.isInteger(remaining) ? String(remaining) : remaining.toFixed(1);
  return `${feet}' ${inchStr}"`;
}

function printSampleResult(sample: SampleFile, result: ReturnType<typeof computeScale>): void {
  const scaleStr = result.pixelsPerInch.toFixed(2);
  const expectedStr = sample.expectedScale.toFixed(3);
  const confidenceStr = (result.confidence * 100).toFixed(0);
  const matchCount = result.matches.length;
  const totalDims = sample.dimensions.length;

  console.log(SEPARATOR_THICK);
  console.log(`\uD83D\uDCD0 ${sample.name}`);
  console.log(SEPARATOR_THIN);
  console.log(`Scale:      ${scaleStr} px/inch`);
  console.log(`Expected:   ${expectedStr} px/inch`);
  console.log(`Confidence: ${confidenceStr}%`);
  console.log(`Matches:    ${matchCount}/${totalDims} dimensions matched`);
  console.log('');

  for (const match of result.matches) {
    const dimLabel = formatInchesLabel(match.dimension.inches);
    const pxDist = match.pair.perpendicularDistance.toFixed(1);
    const ppi = match.pixelsPerInch.toFixed(3);
    console.log(`  \u2022 ${dimLabel} \u2194 ${pxDist}px (${ppi} px/in)`);
  }

  console.log(SEPARATOR_THICK);
  console.log('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  // Ensure the output directory exists.
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Read all JSON files from the samples directory.
  const entries = await readdir(SAMPLES_DIR);
  const jsonFiles = entries
    .filter((f) => f.endsWith('.json'))
    .sort();

  if (jsonFiles.length === 0) {
    console.log('No sample JSON files found in', SAMPLES_DIR);
    return;
  }

  let svgCount = 0;

  for (const fileName of jsonFiles) {
    const filePath = path.join(SAMPLES_DIR, fileName);
    const raw = await readFile(filePath, 'utf-8');
    const sample = JSON.parse(raw) as SampleFile;

    // Run the scale-computation pipeline.
    const result = computeScale({
      walls: sample.walls,
      dimensions: sample.dimensions,
    });

    // Print formatted results.
    printSampleResult(sample, result);

    // Generate and save SVG visualization.
    const svg = generateSVG({
      walls: sample.walls,
      segments: result.segments,
      matches: result.matches,
      pixelsPerInch: result.pixelsPerInch,
      confidence: result.confidence,
    });

    const baseName = path.basename(fileName, '.json');
    const svgPath = path.join(OUTPUT_DIR, `${baseName}.svg`);
    await saveSVG(svg, svgPath);
    svgCount++;
  }

  console.log(`Generated ${svgCount} visualizations in ./output/`);
}

main().catch((err: unknown) => {
  console.error('Demo failed:', err);
  process.exit(1);
});
