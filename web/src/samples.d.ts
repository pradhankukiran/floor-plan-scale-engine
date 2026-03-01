import type { Point } from '@engine/geometry.js';
export interface Sample {
    id: string;
    name: string;
    description: string;
    walls: Point[];
    dimensions: string[];
    expectedScale: number;
}
export declare const samples: Sample[];
//# sourceMappingURL=samples.d.ts.map