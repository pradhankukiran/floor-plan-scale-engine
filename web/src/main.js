import { computeScale } from '@engine/scale.js';
import { samples } from './samples.js';
import { renderResults, clearResults } from './results.js';
import { createEditor } from './editor.js';
// --- State ---
let currentWalls = [];
let currentDims = [];
let activeSampleId = null;
// --- DOM refs ---
const wallsInput = document.getElementById('walls-input');
const dimsInput = document.getElementById('dims-input');
const computeBtn = document.getElementById('compute-btn');
const clearBtn = document.getElementById('clear-btn');
const pillContainer = document.getElementById('sample-pills');
// --- Editor ---
const editor = createEditor('editor-canvas', (walls) => {
    currentWalls = walls;
    wallsInput.value = JSON.stringify(walls);
});
// --- Sample pills ---
for (const sample of samples) {
    const pill = document.createElement('button');
    pill.className = 'pill';
    pill.textContent = sample.name;
    pill.dataset.id = sample.id;
    pill.addEventListener('click', () => selectSample(sample.id));
    pillContainer.appendChild(pill);
}
function selectSample(id) {
    const sample = samples.find((s) => s.id === id);
    if (!sample)
        return;
    activeSampleId = id;
    // Update pills
    for (const pill of pillContainer.querySelectorAll('.pill')) {
        pill.classList.toggle('active', pill.dataset.id === id);
    }
    // Populate inputs
    currentWalls = sample.walls;
    currentDims = sample.dimensions;
    wallsInput.value = JSON.stringify(sample.walls);
    dimsInput.value = sample.dimensions.join('\n');
    // Update canvas editor
    editor.setVertices(sample.walls);
    // Auto-compute
    runCompute();
}
// --- Compute ---
function runCompute() {
    // Parse walls from textarea
    try {
        const parsed = JSON.parse(wallsInput.value);
        if (Array.isArray(parsed) && parsed.length >= 3) {
            currentWalls = parsed;
        }
    }
    catch {
        // Keep current walls if JSON is invalid
    }
    // Parse dimensions from textarea
    currentDims = dimsInput.value
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    if (currentWalls.length < 3 || currentDims.length === 0) {
        clearResults();
        return;
    }
    const output = computeScale({
        walls: currentWalls,
        dimensions: currentDims,
    });
    renderResults(output, currentWalls);
}
// --- Event listeners ---
computeBtn.addEventListener('click', () => {
    // Deselect sample pill when manually computing
    activeSampleId = null;
    for (const pill of pillContainer.querySelectorAll('.pill')) {
        pill.classList.remove('active');
    }
    runCompute();
});
clearBtn.addEventListener('click', () => {
    wallsInput.value = '';
    dimsInput.value = '';
    currentWalls = [];
    currentDims = [];
    activeSampleId = null;
    for (const pill of pillContainer.querySelectorAll('.pill')) {
        pill.classList.remove('active');
    }
    editor.clear();
    clearResults();
});
// Sync textarea changes back to editor
wallsInput.addEventListener('input', () => {
    try {
        const parsed = JSON.parse(wallsInput.value);
        if (Array.isArray(parsed) && parsed.length >= 3) {
            editor.setVertices(parsed);
        }
    }
    catch {
        // Ignore invalid JSON while user is typing
    }
});
// --- Load first sample on start ---
selectSample('rectangle');
//# sourceMappingURL=main.js.map