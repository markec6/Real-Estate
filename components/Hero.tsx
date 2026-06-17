'use client'

import { useEffect, useRef } from 'react'

export default function Hero() {
  const sparklineRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    function buildSparkline() {
      const svg = sparklineRef.current
      if (!svg) return

      const points = [92, 88, 85, 83, 80, 76, 72, 70, 65, 60]
      const W = (svg.parentElement?.offsetWidth || 200)
      const H = 40
      const padX = 4

      const xs = points.map((_, i) => padX + (i / (points.length - 1)) * (W - padX * 2))
      const ys = points.map(v => H - 4 - ((v - 55) / 45) * (H - 10))

      const pathD = xs.map((x, i) =>
        `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`
      ).join(' ')
      const lastX = xs[xs.length - 1].toFixed(1)
      const lastY = ys[ys.length - 1].toFixed(1)
      const areaD = `${pathD} L${lastX},${H} L${xs[0].toFixed(1)},${H} Z`

      svg.innerHTML = `
        <defs>
          <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#22c55e" stop-opacity="0.18"/>
            <stop offset="100%" stop-color="#22c55e" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#spark-grad)" stroke="none"/>
        <path d="${pathD}" fill="none" stroke="#22c55e" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${lastX}" cy="${lastY}" r="3" fill="#22c55e"/>
      `
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
    }

    let resizeTimer: ReturnType<typeof setTimeout>
    function handleResize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(buildSparkline, 120)
    }

    buildSparkline()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [])

  return (
    <section className="hero">
      <div className="hero-inner">
        {/* Badge */}
        <div className="hero-badge anim-hero-badge">
          <span className="badge-dot" />
          AI-Powered Platform · Beta Access
        </div>

        {/* H1 */}
        <h1 className="hero-h1 anim-hero-h1">
          Pronađi pravi stan.<br />
          <span className="accent-word">Bez duplikata.</span> Bez gubljenja vremena.
        </h1>

        {/* H2 */}
        <p className="hero-h2 anim-hero-h2">
          AI asistent koji skenira sve balkanske portale, filtrira duplikate i
          pronalazi direktne kontakte vlasnika — sve u manje od 3 sekunde.
        </p>

        {/* CTA */}
        <div className="cta-wrap anim-cta">
          <a href="#" className="cta-btn">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            Isprobaj Besplatno — Beta
          </a>
          <p className="cta-sub">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            Nema kreditne kartice · Odmah spreman
          </p>
        </div>

        {/* Browser Mockup */}
        <div className="mockup-wrap anim-mockup">
          <div className="browser-mockup">
            {/* Chrome bar */}
            <div className="browser-chrome">
              <div className="traffic-light tl-red" />
              <div className="traffic-light tl-yellow" />
              <div className="traffic-light tl-green" />
              <div className="browser-url-bar">
                <svg
                  style={{
                    width: '10px', height: '10px', stroke: 'currentColor',
                    fill: 'none', strokeWidth: 2, strokeLinecap: 'round',
                    strokeLinejoin: 'round', marginRight: '4px', flexShrink: 0
                  }}
                  viewBox="0 0 24 24" aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                app.balkanrealestate.ai/dashboard
              </div>
            </div>

            {/* Browser body */}
            <div className="browser-body">
              {/* Left: Scanner panel */}
              <div className="panel-scanner">
                <div className="building-wireframe">
                  <svg viewBox="0 0 120 160" aria-hidden="true">
                    {/* Base */}
                    <rect x="10" y="30" width="100" height="125" rx="2"/>
                    {/* Roof triangle */}
                    <polygon points="60,5 110,30 10,30"/>
                    {/* Windows row 1 */}
                    <rect x="20" y="45" width="18" height="20" rx="2"/>
                    <rect x="51" y="45" width="18" height="20" rx="2"/>
                    <rect x="82" y="45" width="18" height="20" rx="2"/>
                    {/* Windows row 2 */}
                    <rect x="20" y="78" width="18" height="20" rx="2"/>
                    <rect x="51" y="78" width="18" height="20" rx="2"/>
                    <rect x="82" y="78" width="18" height="20" rx="2"/>
                    {/* Windows row 3 */}
                    <rect x="20" y="111" width="18" height="20" rx="2"/>
                    <rect x="82" y="111" width="18" height="20" rx="2"/>
                    {/* Door */}
                    <rect x="44" y="108" width="32" height="47" rx="3"/>
                    {/* Center line */}
                    <line x1="60" y1="108" x2="60" y2="155"/>
                    {/* Chimney */}
                    <rect x="75" y="8" width="12" height="24" rx="1"/>
                  </svg>
                  <div className="scanner-laser" />
                </div>
                <p className="scanner-label">AI Skeniranje Aktivno</p>
              </div>

              {/* Right: Intelligence cards */}
              <div className="panel-cards">
                {/* Card 1 — Verified Listing */}
                <div className="micro-card">
                  <div className="card-header">
                    <div className="card-icon card-icon-green">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                    </div>
                    <div>
                      <div className="card-title">Stan Potvrđen — Direktno</div>
                      <div className="card-subtitle">Beograd, Vračar · 68m² · 4. sprat</div>
                    </div>
                  </div>
                  <div className="status-row">
                    <div className="status-dot dot-green" />
                    <span className="status-text">Vlasnik dostupan · Bez posrednika</span>
                  </div>
                </div>

                {/* Card 2 — Price drop */}
                <div className="micro-card">
                  <div className="card-header">
                    <div className="card-icon card-icon-amber">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                        <path d="M2 17l10 5 10-5"/>
                        <path d="M2 12l10 5 10-5"/>
                      </svg>
                    </div>
                    <div>
                      <div className="card-title">Pad Cijene Detektovan</div>
                      <div className="card-subtitle">Sarajevo, Ilidža · Ažurirano prije 12min</div>
                    </div>
                  </div>
                  <div className="price-row">
                    <span className="price-old">€142.000</span>
                    <svg className="price-arrow" viewBox="0 0 24 24" aria-hidden="true">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                    <span className="price-new">€128.500</span>
                    <span className="price-drop-badge">−9.5%</span>
                  </div>
                  {/* Sparkline */}
                  <div className="sparkline-wrap">
                    <svg ref={sparklineRef} aria-label="Price trend chart" />
                  </div>
                </div>
              </div>

              {/* Overlay pill */}
              <div className="mockup-overlay">
                <div className="mockup-overlay-pill">
                  Analizirano 2.847 oglasa · 14 portala · Ažurirano upravo
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
