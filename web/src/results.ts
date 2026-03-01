import type { ScaleOutput } from '@engine/scale.js';
import type { VisualizeOptions } from '@engine/visualize.js';
import { generateSVG } from '@engine/visualize.js';
import type { Point } from '@engine/geometry.js';

const HIGHLIGHT_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
const CIRCUMFERENCE = 2 * Math.PI * 52; // r=52 from the SVG ring

export function renderResults(output: ScaleOutput, walls: Point[]): void {
  const placeholder = document.getElementById('results-placeholder')!;
  const container = document.getElementById('results-container')!;

  placeholder.hidden = true;
  container.hidden = false;

  // Force re-trigger fadeIn animation
  container.classList.remove('results-container');
  void container.offsetWidth;
  container.classList.add('results-container');

  // --- Hero scale ---
  const heroScale = document.getElementById('hero-scale')!;
  heroScale.textContent = output.pixelsPerInch.toFixed(3);

  // --- Confidence ring ---
  const confPct = Math.round(output.confidence * 100);
  const confArc = document.getElementById('confidence-arc')!;
  const confText = document.getElementById('confidence-text')!;

  const offset = CIRCUMFERENCE * (1 - output.confidence);
  confArc.style.transition = 'stroke-dashoffset 600ms ease';
  confArc.style.strokeDashoffset = String(offset);
  confText.textContent = `${confPct}%`;

  // Color the ring based on confidence
  if (output.confidence >= 0.8) {
    confArc.style.stroke = 'var(--success)';
  } else if (output.confidence >= 0.5) {
    confArc.style.stroke = 'var(--warning)';
  } else {
    confArc.style.stroke = 'var(--error)';
  }

  // --- Matches table ---
  const tbody = document.getElementById('matches-body')!;
  tbody.innerHTML = '';

  for (let i = 0; i < output.matches.length; i++) {
    const m = output.matches[i]!;
    const color = HIGHLIGHT_COLORS[i % HIGHLIGHT_COLORS.length]!;
    const residualPct = (m.residual * 100).toFixed(2);

    let residualClass = 'residual-low';
    if (m.residual > 0.03) residualClass = 'residual-high';
    else if (m.residual > 0.01) residualClass = 'residual-med';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="color-swatch" style="background:${color}"></span>${escapeHtml(m.dimension.original)}</td>
      <td>${m.pair.perpendicularDistance.toFixed(1)}</td>
      <td>${m.pixelsPerInch.toFixed(4)}</td>
      <td class="${residualClass}">${residualPct}%</td>
    `;
    tbody.appendChild(tr);
  }

  // --- Unmatched info ---
  const unmatchedInfo = document.getElementById('unmatched-info')!;
  const parts: string[] = [];
  if (output.unmatchedPairs.length > 0) {
    parts.push(`${output.unmatchedPairs.length} unmatched wall pair${output.unmatchedPairs.length > 1 ? 's' : ''}`);
  }
  if (output.unmatchedDimensions.length > 0) {
    parts.push(`${output.unmatchedDimensions.length} unmatched dimension${output.unmatchedDimensions.length > 1 ? 's' : ''}`);
  }
  if (parts.length > 0) {
    unmatchedInfo.textContent = parts.join(', ');
    unmatchedInfo.hidden = false;
  } else {
    unmatchedInfo.hidden = true;
  }

  // --- SVG visualization ---
  const svgContainer = document.getElementById('svg-container')!;
  const vizOptions: VisualizeOptions = {
    walls,
    segments: output.segments,
    matches: output.matches,
    pixelsPerInch: output.pixelsPerInch,
    confidence: output.confidence,
    width: 800,
    height: 600,
    padding: 60,
  };

  const svgString = generateSVG(vizOptions);
  // Strip the XML declaration for inline embedding
  svgContainer.innerHTML = svgString.replace(/<\?xml[^?]*\?>\s*/, '');
}

export function clearResults(): void {
  const placeholder = document.getElementById('results-placeholder')!;
  const container = document.getElementById('results-container')!;
  placeholder.hidden = false;
  container.hidden = true;
}

function escapeHtml(text: string): string {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}
