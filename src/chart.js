/**
 * chart.js
 * Lightweight canvas chart renderer — no external dependencies.
 *
 * Supports:
 *   drawBarChart(canvas, options)  — bar chart with PPL colors
 *   drawLineChart(canvas, options) — line chart for exercise history
 *
 * options = {
 *   labels:  string[]        — x-axis labels
 *   values:  number[]        — data values
 *   colors:  string[]        — bar colors (hex, one per bar)
 *   tooltip: (i) => string   — tooltip text on tap/hover
 *   type:    'bar' | 'line'  — default 'bar'
 *   unit:    string          — optional unit suffix for y-axis
 * }
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const FONT      = "'Manrope', system-ui, sans-serif";
const C_AXIS    = '#2a2a2a';
const C_LABEL   = '#484847';
const C_GRID    = 'rgba(255,255,255,0.03)';
const C_TOOLTIP_BG  = '#1a1a1a';
const C_TOOLTIP_TXT = '#f2f2f0';
const C_TOOLTIP_BRD = '#2e2e2e';
const BAR_RADIUS    = 4;
const PAD = { top: 16, right: 12, bottom: 40, left: 40 };

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Draw bar or line chart on a canvas element.
 * Handles resize via ResizeObserver.
 * Attaches tooltip on pointermove / pointerleave.
 */
export function drawBarChart(canvas, options = {}) {
  const {
    labels  = [],
    values  = [],
    colors  = [],
    tooltip = null,
    type    = 'bar',
    unit    = '',
  } = options;

  if (!canvas || !labels.length) return;

  // Resolve CSS variables to actual color strings
  // Canvas 2D doesn't support CSS vars — we read computed styles
  const resolvedColors = colors.map(c => _resolveCssColor(c, canvas));

  const ctx = canvas.getContext('2d');

  // Store state for tooltip
  canvas._chartData = { labels, values, resolvedColors, tooltip, type, unit };

  // Attach event listeners once
  if (!canvas._chartBound) {
    canvas._chartBound = true;
    canvas.addEventListener('pointermove', _onPointerMove);
    canvas.addEventListener('pointerleave', _onPointerLeave);
    // Redraw on resize
    const ro = new ResizeObserver(() => _draw(canvas));
    ro.observe(canvas);
    canvas._ro = ro;
  }

  _draw(canvas);
}

export function destroyChart(canvas) {
  if (!canvas) return;
  canvas.removeEventListener('pointermove', _onPointerMove);
  canvas.removeEventListener('pointerleave', _onPointerLeave);
  canvas._ro?.disconnect();
  canvas._chartData = null;
  canvas._chartBound = false;
}

// ─── Draw ────────────────────────────────────────────────────────────────────

function _draw(canvas, highlightIdx = -1) {
  const d = canvas._chartData;
  if (!d) return;

  // Set canvas resolution
  const rect = canvas.getBoundingClientRect();
  const dpr  = window.devicePixelRatio || 1;
  canvas.width  = rect.width  * dpr;
  canvas.height = canvas.getAttribute('height')
    ? parseInt(canvas.getAttribute('height'), 10) * dpr
    : rect.height * dpr;
  canvas.style.width  = rect.width + 'px';
  canvas.style.height = (canvas.height / dpr) + 'px';

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const W = canvas.width  / dpr;
  const H = canvas.height / dpr;

  const { labels, values, resolvedColors, type } = d;
  const n = labels.length;
  if (!n) return;

  const maxVal = Math.max(...values, 1);
  const minVal = type === 'line' ? Math.min(...values) : 0;
  const range  = maxVal - minVal || 1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top  - PAD.bottom;

  // ── Grid lines ────────────────────────────────────────────────────────────
  ctx.strokeStyle = C_GRID;
  ctx.lineWidth   = 0.5;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = PAD.top + (plotH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();

    // y-axis label
    const val = Math.round(maxVal - (range / gridLines) * i);
    ctx.fillStyle = C_LABEL;
    ctx.font      = `500 9px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(val + (d.unit ? ` ${d.unit}` : ''), PAD.left - 4, y + 3);
  }

  // ── X-axis ────────────────────────────────────────────────────────────────
  ctx.strokeStyle = C_AXIS;
  ctx.lineWidth   = 0.5;
  ctx.beginPath();
  ctx.moveTo(PAD.left, PAD.top + plotH);
  ctx.lineTo(PAD.left + plotW, PAD.top + plotH);
  ctx.stroke();

  if (type === 'bar') {
    _drawBars(ctx, { labels, values, resolvedColors, n, plotW, plotH, maxVal, minVal, range, W, H, highlightIdx });
  } else {
    _drawLine(ctx, { labels, values, resolvedColors, n, plotW, plotH, maxVal, minVal, range, W, H, highlightIdx });
  }

  // ── Tooltip ───────────────────────────────────────────────────────────────
  if (highlightIdx >= 0 && d.tooltip) {
    const text = d.tooltip(highlightIdx);
    _drawTooltip(ctx, {
      text,
      x: _barX(highlightIdx, n, plotW) + PAD.left,
      y: PAD.top + plotH * (1 - (values[highlightIdx] - minVal) / range),
      W, H,
    });
  }
}

// ─── Bar chart ───────────────────────────────────────────────────────────────

function _drawBars(ctx, { labels, values, resolvedColors, n, plotW, plotH, maxVal, minVal, range, W, H, highlightIdx }) {
  const barW   = Math.max(4, plotW / n * 0.6);
  const gap    = plotW / n;

  for (let i = 0; i < n; i++) {
    const x      = PAD.left + gap * i + gap / 2 - barW / 2;
    const val    = values[i];
    const barH   = Math.max(2, (val / maxVal) * plotH);
    const y      = PAD.top + plotH - barH;
    const color  = resolvedColors[i] || '#555';
    const alpha  = highlightIdx >= 0 ? (i === highlightIdx ? 1 : 0.35) : 1;

    ctx.globalAlpha = alpha;
    ctx.fillStyle   = color;
    _roundRect(ctx, x, y, barW, barH, BAR_RADIUS);
    ctx.fill();
    ctx.globalAlpha = 1;

    // x label (skip if too many)
    if (n <= 14 || i % Math.ceil(n / 14) === 0) {
      ctx.fillStyle = i === highlightIdx ? C_TOOLTIP_TXT : C_LABEL;
      ctx.font      = `600 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], x + barW / 2, PAD.top + plotH + 14);
    }
  }
}

// ─── Line chart ──────────────────────────────────────────────────────────────

function _drawLine(ctx, { labels, values, resolvedColors, n, plotW, plotH, maxVal, minVal, range, W, H, highlightIdx }) {
  const color = resolvedColors[0] || '#818cf8';
  const pts   = values.map((v, i) => ({
    x: PAD.left + (plotW / (n - 1)) * i,
    y: PAD.top  + plotH * (1 - (v - minVal) / range),
  }));

  // Area fill
  ctx.beginPath();
  ctx.moveTo(pts[0].x, PAD.top + plotH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, PAD.top + plotH);
  ctx.closePath();
  ctx.fillStyle = color + '18';
  ctx.fill();

  // Line
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2;
  ctx.lineJoin    = 'round';
  ctx.stroke();

  // Dots
  pts.forEach((p, i) => {
    const isHL = i === highlightIdx;
    ctx.beginPath();
    ctx.arc(p.x, p.y, isHL ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isHL ? '#fff' : color;
    ctx.fill();
    if (isHL) {
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.stroke();
    }
  });

  // Labels
  pts.forEach((p, i) => {
    if (n <= 12 || i % Math.ceil(n / 12) === 0) {
      ctx.fillStyle = i === highlightIdx ? C_TOOLTIP_TXT : C_LABEL;
      ctx.font      = `600 8px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(labels[i], p.x, PAD.top + plotH + 14);
    }
  });
}

// ─── Tooltip ────────────────────────────────────────────────────────────────

function _drawTooltip(ctx, { text, x, y, W, H }) {
  const lines  = text.split('\n');
  const lineH  = 16;
  const padX   = 10;
  const padY   = 8;
  const maxW   = lines.reduce((a, l) => Math.max(a, ctx.measureText(l).width), 0);
  const boxW   = maxW + padX * 2;
  const boxH   = lines.length * lineH + padY * 2;

  let tx = x - boxW / 2;
  let ty = y - boxH - 10;
  tx = Math.max(4, Math.min(W - boxW - 4, tx));
  ty = Math.max(4, ty);

  ctx.fillStyle   = C_TOOLTIP_BG;
  ctx.strokeStyle = C_TOOLTIP_BRD;
  ctx.lineWidth   = 0.5;
  _roundRect(ctx, tx, ty, boxW, boxH, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = C_TOOLTIP_TXT;
  ctx.font      = `700 10px ${FONT}`;
  ctx.textAlign = 'left';
  lines.forEach((line, i) => {
    ctx.fillText(line, tx + padX, ty + padY + lineH * i + 10);
  });
}

// ─── Pointer events ──────────────────────────────────────────────────────────

function _onPointerMove(e) {
  const canvas = e.currentTarget;
  const d      = canvas._chartData;
  if (!d) return;

  const rect   = canvas.getBoundingClientRect();
  const mx     = e.clientX - rect.left;
  const n      = d.labels.length;
  const plotW  = rect.width - PAD.left - PAD.right;
  const gap    = plotW / n;
  const idx    = Math.floor((mx - PAD.left) / gap);

  if (idx >= 0 && idx < n) {
    canvas._hlIdx = idx;
    _draw(canvas, idx);
  }
}

function _onPointerLeave(e) {
  const canvas = e.currentTarget;
  canvas._hlIdx = -1;
  _draw(canvas, -1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function _barX(i, n, plotW) {
  const gap  = plotW / n;
  const barW = Math.max(4, gap * 0.6);
  return gap * i + gap / 2 - barW / 2;
}

function _roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

/**
 * Resolves a CSS variable color to a usable hex/rgb string.
 * Falls back to the raw value if not a var().
 */
function _resolveCssColor(color, el) {
  if (!color.startsWith('var(')) return color;
  const varName = color.match(/var\(([^)]+)\)/)?.[1];
  if (!varName) return '#555';
  return getComputedStyle(el ?? document.documentElement)
    .getPropertyValue(varName).trim() || '#555';
}

export default { drawBarChart, destroyChart };
