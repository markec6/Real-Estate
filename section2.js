/* ============================================================
   BALKAN REAL ESTATE INTELLIGENCE — section2.js
   Section 2: The Blueprint Transformation Grid
   ============================================================ */

(function () {
  'use strict';

  /* ─── Element References ───────────────────────────────── */
  const section  = document.getElementById('section2');
  const tabs     = section ? section.querySelectorAll('.s2-tab') : [];
  const trendPath = section ? section.querySelector('.s2-trend-path') : null;
  const trendArea = section ? section.querySelector('.s2-trend-area') : null;

  if (!section) return;

  /* ─── Trend Chart Animation ────────────────────────────── */

  /**
   * Animate the SVG upward trend line from hidden to fully drawn.
   * Uses double-rAF to ensure the reset stroke-dashoffset is painted
   * before re-enabling the CSS transition, allowing a clean replay
   * every time the AI mode is activated.
   */
  function playTrend() {
    if (!trendPath || !trendArea) return;

    // Instantly reset to hidden state (no transition)
    trendPath.style.transition = 'none';
    trendArea.style.transition = 'none';
    trendPath.style.strokeDashoffset = '600';
    trendArea.style.opacity = '0';

    // Wait two frames so the browser commits the reset paint
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        trendPath.style.transition = 'stroke-dashoffset 0.9s 0.08s cubic-bezier(0.22, 1, 0.36, 1)';
        trendArea.style.transition = 'opacity 0.85s 0.12s ease';
        trendPath.style.strokeDashoffset = '0';
        trendArea.style.opacity = '1';
      });
    });
  }

  /** Reset trend chart to its hidden state instantly (no animation). */
  function resetTrend() {
    if (!trendPath || !trendArea) return;
    trendPath.style.transition = 'none';
    trendArea.style.transition = 'none';
    trendPath.style.strokeDashoffset = '600';
    trendArea.style.opacity = '0';
  }

  /* ─── Mode Switcher ────────────────────────────────────── */

  /**
   * Switch the active mode of section 2.
   * @param {'manual'|'ai'} mode
   */
  function setMode(mode) {
    section.setAttribute('data-mode', mode);

    tabs.forEach(function (tab) {
      const isActive = tab.dataset.target === mode;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });

    if (mode === 'ai') {
      playTrend();
    } else {
      resetTrend();
    }
  }

  /* ─── Event Listeners ──────────────────────────────────── */

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      setMode(tab.dataset.target);
    });

    // Keyboard accessibility: activate on Enter / Space
    tab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setMode(tab.dataset.target);
      }
    });
  });

})();
