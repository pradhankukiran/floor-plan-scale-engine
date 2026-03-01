/**
 * index.ts — Barrel re-export for the floor plan scale engine.
 *
 * Consumers can import everything from a single entry point:
 *
 *   import { computeScale, findBestMatching, ... } from 'floorplan-scale-engine';
 */

export * from './geometry.js';
export * from './parser.js';
export * from './matcher.js';
export * from './scale.js';
