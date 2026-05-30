/**
 * chart.js — Canvas bar chart renderer.
 * Single responsibility: draw the score chart onto <canvas id="score-chart">.
 * Uses a ResizeObserver for efficient redraws on container resize.
 */

import { state }         from './state.js';
import { getScoreColor } from './helpers.js';

/** @type {ResizeObserver|null} */
let _resizeObserver = null;

// ─── INTERNAL DEBOUNCE (no import needed, keeps this module self-contained) ─
function _debounce(fn, ms) {
  let t;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

// ─── MAIN DRAW ────────────────────────────────────────────────
/**
 * Render the bar chart. Safe to call any time — handles empty state gracefully.
 */
export function renderChart() {
  const canvas  = document.getElementById('score-chart');
  const emptyEl = document.getElementById('chart-empty');

  if (!canvas) return;

  const { subjects } = state;

  // Empty state
  if (!subjects.length) {
    canvas.style.display = 'none';
    emptyEl?.classList.remove('hidden');
    return;
  }

  canvas.style.display = 'block';
  emptyEl?.classList.add('hidden');

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const ctx    = canvas.getContext('2d');
  const dpr    = window.devicePixelRatio || 1;
  const W      = (canvas.parentElement?.clientWidth ?? 560) - 40;
  const H      = 260;

  // DPI-aware sizing
  canvas.width        = W * dpr;
  canvas.height       = H * dpr;
  canvas.style.width  = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const PAD    = { l: 44, r: 16, t: 20, b: 60 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  // Draw oldest → newest left to right
  const data     = [...subjects].reverse();
  const barCount = data.length;
  const barGap   = Math.max(4, Math.min(10, (chartW / barCount) * 0.2));
  const barW     = Math.max(8, (chartW - barGap * (barCount - 1)) / barCount);

  const col = {
    text:  isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
    grid:  isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
  };

  // ── Y-axis grid + labels ──────────────────────────────────
  ctx.font         = `500 10px 'JetBrains Mono', monospace`;
  ctx.fillStyle    = col.text;
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';

  [0, 25, 50, 75, 100].forEach((v) => {
    const y = PAD.t + chartH - (v / 100) * chartH;
    ctx.beginPath();
    ctx.strokeStyle = col.grid;
    ctx.lineWidth   = 1;
    ctx.setLineDash([3, 4]);
    ctx.moveTo(PAD.l, y);
    ctx.lineTo(PAD.l + chartW, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText(String(v), PAD.l - 6, y);
  });

  // ── Bars ─────────────────────────────────────────────────
  data.forEach((s, i) => {
    const x     = PAD.l + i * (barW + barGap);
    const bH    = (s.score / 100) * chartH;
    const y     = PAD.t + chartH - bH;
    const color = getScoreColor(s.score);
    const r     = Math.min(4, barW / 2);

    // Gradient fill
    const grad = ctx.createLinearGradient(0, y, 0, PAD.t + chartH);
    grad.addColorStop(0, color);
    grad.addColorStop(1, color + '28');

    ctx.shadowColor = color;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = grad;

    // Rounded-top bar path
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, PAD.t + chartH);
    ctx.lineTo(x, PAD.t + chartH);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Score label above bar
    if (barW > 18) {
      ctx.font         = `600 10px 'JetBrains Mono', monospace`;
      ctx.fillStyle    = color;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'bottom';
      ctx.shadowColor  = color;
      ctx.shadowBlur   = 4;
      ctx.fillText(String(s.score), x + barW / 2, y - 3);
      ctx.shadowBlur   = 0;
    }

    // X-axis label (rotated)
    if (barW > 14) {
      ctx.font         = `500 10px 'Outfit', sans-serif`;
      ctx.fillStyle    = col.text;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'top';
      const maxLen = Math.max(3, Math.floor(barW / 5));
      const label  = s.name.length > maxLen ? `${s.name.slice(0, maxLen)}…` : s.name;
      ctx.save();
      ctx.translate(x + barW / 2, PAD.t + chartH + 8);
      ctx.rotate(-Math.PI / 5);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }
  });
}

// ─── RESIZE OBSERVER ──────────────────────────────────────────
/**
 * Attach a ResizeObserver to the chart container so the chart
 * redraws automatically when the layout changes (e.g. sidebar toggle,
 * window resize). Replaces the old window 'resize' listener pattern.
 */
export function initChartResizeObserver() {
  const container = document.querySelector('.chart-container');
  if (!container || typeof ResizeObserver === 'undefined') return;

  // Disconnect any existing observer first
  _resizeObserver?.disconnect();

  const debouncedRender = _debounce(renderChart, 150);
  _resizeObserver = new ResizeObserver(debouncedRender);
  _resizeObserver.observe(container);
}
