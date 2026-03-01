import type { Point } from '@engine/geometry.js';
export interface EditorApi {
    setVertices(vertices: Point[]): void;
    clear(): void;
}
export declare function createEditor(canvasId: string, onChange: (vertices: Point[]) => void): EditorApi;
//# sourceMappingURL=editor.d.ts.map