import type { Point } from '@engine/geometry.js';

export interface EditorApi {
  setVertices(vertices: Point[]): void;
  clear(): void;
}

const VERTEX_RADIUS = 6;
const HIT_RADIUS = 12;
const GRID_SIZE = 20;

export function createEditor(
  canvasId: string,
  onChange: (vertices: Point[]) => void,
): EditorApi {
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  let vertices: Point[] = [];
  let draggingIndex: number | null = null;
  let hoverIndex: number | null = null;

  // Data-space bounding box for mapping
  let dataBounds = { minX: 0, minY: 0, maxX: 500, maxY: 500 };

  function updateBounds() {
    if (vertices.length === 0) {
      dataBounds = { minX: 0, minY: 0, maxX: 500, maxY: 500 };
      return;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of vertices) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    // Add some padding
    const padX = Math.max((maxX - minX) * 0.15, 30);
    const padY = Math.max((maxY - minY) * 0.15, 30);
    dataBounds = { minX: minX - padX, minY: minY - padY, maxX: maxX + padX, maxY: maxY + padY };
  }

  function dataToCanvas(p: Point): [number, number] {
    const { minX, minY, maxX, maxY } = dataBounds;
    const dataW = maxX - minX || 1;
    const dataH = maxY - minY || 1;
    const scale = Math.min(canvas.width / dataW, canvas.height / dataH);
    const offsetX = (canvas.width - dataW * scale) / 2;
    const offsetY = (canvas.height - dataH * scale) / 2;
    return [
      offsetX + (p[0] - minX) * scale,
      offsetY + (p[1] - minY) * scale,
    ];
  }

  function canvasToData(cx: number, cy: number): Point {
    const { minX, minY, maxX, maxY } = dataBounds;
    const dataW = maxX - minX || 1;
    const dataH = maxY - minY || 1;
    const scale = Math.min(canvas.width / dataW, canvas.height / dataH);
    const offsetX = (canvas.width - dataW * scale) / 2;
    const offsetY = (canvas.height - dataH * scale) / 2;
    return [
      Math.round((cx - offsetX) / scale + minX),
      Math.round((cy - offsetY) / scale + minY),
    ];
  }

  function findVertexAt(cx: number, cy: number): number | null {
    for (let i = 0; i < vertices.length; i++) {
      const [vx, vy] = dataToCanvas(vertices[i]!);
      const dx = cx - vx;
      const dy = cy - vy;
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) return i;
    }
    return null;
  }

  function draw() {
    const w = canvas.width;
    const h = canvas.height;

    // Read CSS custom properties
    const style = getComputedStyle(canvas);
    const bgColor = style.getPropertyValue('--canvas-bg').trim() || '#181b24';
    const gridColor = style.getPropertyValue('--canvas-grid').trim() || '#242836';
    const edgeColor = style.getPropertyValue('--canvas-edge').trim() || '#6366f1';
    const vertexColor = style.getPropertyValue('--canvas-vertex').trim() || '#818cf8';
    const fillColor = style.getPropertyValue('--canvas-fill').trim() || 'rgba(99,102,241,0.08)';

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(w, y + 0.5);
      ctx.stroke();
    }

    if (vertices.length === 0) {
      // Empty state hint
      ctx.fillStyle = style.getPropertyValue('--text-tertiary').trim() || '#6b7280';
      ctx.font = '13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Click to place vertices', w / 2, h / 2);
      return;
    }

    // Polygon fill
    if (vertices.length >= 3) {
      ctx.beginPath();
      const [sx, sy] = dataToCanvas(vertices[0]!);
      ctx.moveTo(sx, sy);
      for (let i = 1; i < vertices.length; i++) {
        const [px, py] = dataToCanvas(vertices[i]!);
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    // Edges
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const [sx, sy] = dataToCanvas(vertices[0]!);
    ctx.moveTo(sx, sy);
    for (let i = 1; i < vertices.length; i++) {
      const [px, py] = dataToCanvas(vertices[i]!);
      ctx.lineTo(px, py);
    }
    if (vertices.length >= 3) ctx.closePath();
    ctx.stroke();

    // Vertices
    for (let i = 0; i < vertices.length; i++) {
      const [vx, vy] = dataToCanvas(vertices[i]!);
      ctx.beginPath();
      ctx.arc(vx, vy, VERTEX_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = i === hoverIndex ? '#fff' : vertexColor;
      ctx.fill();
      ctx.strokeStyle = edgeColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Index label
      ctx.fillStyle = style.getPropertyValue('--text-secondary').trim() || '#9ca3b4';
      ctx.font = '10px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(i), vx, vy - VERTEX_RADIUS - 4);
    }
  }

  function getCanvasPos(e: MouseEvent): [number, number] {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return [
      (e.clientX - rect.left) * scaleX,
      (e.clientY - rect.top) * scaleY,
    ];
  }

  canvas.addEventListener('mousedown', (e) => {
    const [cx, cy] = getCanvasPos(e);
    const idx = findVertexAt(cx, cy);

    if (e.button === 2) {
      // Right-click: remove vertex
      e.preventDefault();
      if (idx !== null) {
        vertices.splice(idx, 1);
        updateBounds();
        draw();
        onChange(vertices);
      }
      return;
    }

    if (idx !== null) {
      draggingIndex = idx;
    } else {
      // Add new vertex
      const dataP = canvasToData(cx, cy);
      vertices.push(dataP);
      updateBounds();
      draw();
      onChange(vertices);
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const [cx, cy] = getCanvasPos(e);

    if (draggingIndex !== null) {
      vertices[draggingIndex] = canvasToData(cx, cy);
      updateBounds();
      draw();
      onChange(vertices);
      return;
    }

    const idx = findVertexAt(cx, cy);
    if (idx !== hoverIndex) {
      hoverIndex = idx;
      canvas.style.cursor = idx !== null ? 'grab' : 'crosshair';
      draw();
    }
  });

  canvas.addEventListener('mouseup', () => {
    draggingIndex = null;
  });

  canvas.addEventListener('mouseleave', () => {
    draggingIndex = null;
    if (hoverIndex !== null) {
      hoverIndex = null;
      draw();
    }
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // --- Public API ---
  function setVertices(newVertices: Point[]) {
    vertices = newVertices.map(([x, y]) => [x, y] as Point);
    updateBounds();
    draw();
  }

  function clear() {
    vertices = [];
    updateBounds();
    draw();
  }

  // Initial draw
  draw();

  return { setVertices, clear };
}
