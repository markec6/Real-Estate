'use client'

import { useState, useRef, useCallback } from 'react'

type Mode = 'manual' | 'ai'

export default function Comparison() {
  const [mode, setMode] = useState<Mode>('manual')
  const trendPathRef = useRef<SVGPathElement>(null)
  const trendAreaRef = useRef<SVGPathElement>(null)

  const playTrend = useCallback(() => {
    const path = trendPathRef.current
    const area = trendAreaRef.current
    if (!path || !area) return

    path.style.transition = 'none'
    area.style.transition = 'none'
    path.style.strokeDashoffset = '600'
    area.style.opacity = '0'

    /* Double rAF forces the browser to paint the reset before re-animating */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        path.style.transition = 'stroke-dashoffset 0.9s 0.08s cubic-bezier(0.22, 1, 0.36, 1)'
        area.style.transition = 'opacity 0.85s 0.12s ease'
        path.style.strokeDashoffset = '0'
        area.style.opacity = '1'
      })
    })
  }, [])

  const resetTrend = useCallback(() => {
    const path = trendPathRef.current
    const area = trendAreaRef.current
    if (!path || !area) return
    path.style.transition = 'none'
    area.style.transition = 'none'
    path.style.strokeDashoffset = '600'
    area.style.opacity = '0'
  }, [])

  function handleSetMode(next: Mode) {
    setMode(next)
    if (next === 'ai') {
      /* Let React commit the data-mode attribute, then animate */
      setTimeout(playTrend, 0)
    } else {
      resetTrend()
    }
  }

  return (
    <section id="section2" className="section2" data-mode={mode}>
      {/* Section header */}
      <div className="s2-header">
        <div className="s2-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          Blueprint Transformation Grid
        </div>
        <h2 className="s2-h2">
          Manualni rad vs.<br />
          <span style={{ color: 'var(--accent)' }}>AI Inteligencija</span>
        </h2>
        <p className="s2-subtitle">
          Vidi razliku u realnom vremenu. Prebaci prekidač i gledaj kako se
          svaki aspekt tvog radnog dana transformiše.
        </p>
      </div>

      {/* Toggle */}
      <div className="s2-toggle-wrap">
        <div className="s2-toggle" data-mode={mode}>
          <div className="s2-toggle-bubble" aria-hidden="true" />
          <button
            className={`s2-tab${mode === 'manual' ? ' active' : ''}`}
            onClick={() => handleSetMode('manual')}
            aria-selected={mode === 'manual'}
            role="tab"
          >
            ⚠️ Manualni Rad
          </button>
          <button
            className={`s2-tab${mode === 'ai' ? ' active' : ''}`}
            onClick={() => handleSetMode('ai')}
            aria-selected={mode === 'ai'}
            role="tab"
          >
            ✦ AI Rješenje
          </button>
        </div>
      </div>

      <div className="s2-container">
        <div className="s2-grid">
          {/* ── Left: Counter Card ─────────────────────────────── */}
          <div className="s2-counter-card">
            {/* Manual metrics */}
            <div className="s2-metrics manual-metrics">
              <div className="s2-metric">
                <div className="s2-metric-value danger">67%</div>
                <p className="s2-metric-label">
                  oglasa je duplikat ili zastarjelo — ali ti ne znaš koji
                </p>
              </div>
              <div className="s2-metric">
                <div className="s2-metric-value danger">4.2h</div>
                <p className="s2-metric-label">
                  dnevno provedeno na ručnoj provjeri i pozivanju posrednika
                </p>
              </div>
            </div>

            {/* AI metrics */}
            <div className="s2-metrics ai-metrics">
              <div className="s2-metric">
                <div className="s2-metric-value success">3 sek</div>
                <p className="s2-metric-label">
                  AI skenira 14 portala, filtrira duplikate i vraća čiste podatke
                </p>
              </div>
              <div className="s2-metric">
                <div className="s2-metric-value success">94%</div>
                <p className="s2-metric-label">
                  tačnost pri detekciji direktnih vlasnika — bez agencija
                </p>
              </div>
            </div>

            <div className="s2-mode-bar" />
          </div>

          {/* ── Right: Glass Cards Column ───────────────────────── */}
          <div className="s2-cards-col">
            {/* Card 1 — Portal Intelligence */}
            <div className="s2-glass-card">
              <div className="s2-card-label">Pokrivenost portala</div>
              <div className="s2-portal-row">
                {[
                  { color: '#f97316', label: 'Nekretnine.ba' },
                  { color: '#3b82f6', label: 'Halooglasi' },
                  { color: '#8b5cf6', label: 'Oglasi.ba' },
                  { color: '#ec4899', label: 'KupujemProdajem' },
                  { color: '#14b8a6', label: '+10 portala' },
                ].map(({ color, label }) => (
                  <span className="s2-portal-pill" key={label}>
                    <span className="s2-portal-dot" style={{ background: color }} />
                    {label}
                  </span>
                ))}
              </div>
              <div className="s2-portal-card-body">
                <div className="s2-card-status manual-status">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                  Manualna provjera svakog portala ponaosob — duplikati nevidljivi, kontakti zakopani
                </div>
                <div className="s2-card-status ai-status">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  AI agregira sve portale u sekundi — svaki oglas deduplikovan, svaki vlasnik identificiran
                </div>
              </div>
            </div>

            {/* Card 2 — Financial Impact */}
            <div className="s2-glass-card">
              <div className="s2-card-label">Finansijski uticaj</div>
              <div className="s2-finance-content">
                {/* Manual: flatline */}
                <div className="s2-finance-state manual-finance">
                  <div className="s2-flatline">
                    <span className="s2-flatline-text">Propuštena provizija</span>
                    <div className="s2-flatline-line" />
                  </div>
                </div>

                {/* AI: trend chart */}
                <div className="s2-finance-state ai-finance">
                  <div className="s2-trend-wrap">
                    <svg
                      className="s2-trend-chart"
                      viewBox="0 0 260 52"
                      preserveAspectRatio="none"
                      aria-label="Revenue trend chart"
                    >
                      <defs>
                        <linearGradient id="trend-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.22"/>
                          <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      {/* Area fill */}
                      <path
                        ref={trendAreaRef}
                        className="s2-trend-area"
                        d="M 0,48 C 30,44 50,38 80,30 C 110,22 130,18 160,12 C 190,6 220,4 260,2 L 260,52 L 0,52 Z"
                        fill="url(#trend-grad)"
                        stroke="none"
                        style={{ opacity: 0 }}
                      />
                      {/* Line */}
                      <path
                        ref={trendPathRef}
                        className="s2-trend-path"
                        d="M 0,48 C 30,44 50,38 80,30 C 110,22 130,18 160,12 C 190,6 220,4 260,2"
                        strokeDasharray="600"
                        strokeDashoffset="600"
                        style={{ strokeDashoffset: 600 }}
                      />
                    </svg>
                    <div className="s2-unlock-badge">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 1l3 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l7-1.01L12 1z"/>
                      </svg>
                      Prihod +38% za 60 dana
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
