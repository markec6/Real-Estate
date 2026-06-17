/* ============================================================
   BALKAN REAL ESTATE INTELLIGENCE — script.js
   ============================================================ */

(function () {
  'use strict';

  /* ─── Theme Toggle ─────────────────────────────────────── */
  const html = document.documentElement;
  const themeToggle = document.getElementById('theme-toggle');

  // Restore preference from localStorage
  const saved = localStorage.getItem('brei-theme');
  if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    html.classList.add('dark');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const isDark = html.classList.toggle('dark');
      localStorage.setItem('brei-theme', isDark ? 'dark' : 'light');
      themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    });
  }

  /* ─── Sparkline Chart ──────────────────────────────────── */
  function buildSparkline() {
    const svg = document.getElementById('sparkline-svg');
    if (!svg) return;

    // Price data points (normalised 0-100, higher = higher price)
    const points = [92, 88, 85, 83, 80, 76, 72, 70, 65, 60];
    const W = svg.parentElement.offsetWidth || 200;
    const H = 40;
    const padX = 4;

    const xs = points.map((_, i) => padX + (i / (points.length - 1)) * (W - padX * 2));
    const ys = points.map(v => H - 4 - ((v - 55) / 45) * (H - 10));

    const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');

    // Area fill path
    const areaD = pathD + ` L${xs[xs.length - 1].toFixed(1)},${H} L${xs[0].toFixed(1)},${H} Z`;

    svg.innerHTML = `
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#22c55e" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaD}" fill="url(#spark-grad)" stroke="none"/>
      <path d="${pathD}" fill="none" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${xs[xs.length - 1].toFixed(1)}" cy="${ys[ys.length - 1].toFixed(1)}" r="3" fill="#22c55e"/>
    `;

    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }

  /* ─── Init ─────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    buildSparkline();

    // Re-draw sparkline on resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(buildSparkline, 120);
    });
  });
})();
