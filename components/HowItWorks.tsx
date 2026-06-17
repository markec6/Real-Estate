/* Pure Server Component — every interaction is CSS-driven (no 'use client' needed) */

const portals = [
  { color: '#f97316', name: 'HaloOglasi.com',  count: '1.247' },
  { color: '#3b82f6', name: 'Nekretnine.ba',   count: '894'   },
  { color: '#8b5cf6', name: '4zida.rs',         count: '638'   },
]

function ExtensionMockup() {
  return (
    <div className="hiw-ext-bar">
      {/* Chrome title-bar */}
      <div className="hiw-ext-chrome">
        <div className="hiw-ext-tl" style={{ background: '#ff5f57' }} />
        <div className="hiw-ext-tl" style={{ background: '#ffbd2e' }} />
        <div className="hiw-ext-tl" style={{ background: '#28c840' }} />
        <span className="hiw-ext-url">chrome://extensions</span>
      </div>

      {/* Extension body */}
      <div className="hiw-ext-body">
        {/* Logo row */}
        <div className="hiw-ext-row">
          <div className="hiw-ext-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 21h18M3 18h18M6 18V9M10 18V9M14 18V9M18 18V9M4 9h16M12 3l8 6H4l8-6z"/>
            </svg>
          </div>
          <div className="hiw-ext-info">
            <span className="hiw-ext-name">Balkan Real Estate AI</span>
            <span className="hiw-ext-desc">Chrome Extension · v1.0</span>
          </div>
          <div className="hiw-ext-toggle" aria-label="Extension enabled" />
        </div>

        {/* Status row */}
        <div className="hiw-ext-row" style={{ justifyContent: 'space-between' }}>
          <span className="hiw-ext-status">Aktivan i skenira</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--accent)', fontWeight: 700 }}>
            7 dana besplatno
          </span>
        </div>
      </div>
    </div>
  )
}

function ScannerMockup() {
  return (
    <div className="hiw-portal-stack">
      {/* Laser sweep — CSS-animated */}
      <div className="hiw-portal-laser" aria-hidden="true" />

      {portals.map(({ color, name, count }) => (
        <div className="hiw-portal-card-row" key={name}>
          <span
            style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}
            aria-hidden="true"
          />
          <span style={{ fontSize: '0.7rem', fontWeight: 600 }}>{name}</span>
          <span className="hiw-ai-chip">{count} oglasa</span>
        </div>
      ))}

      <p className="hiw-portal-count">+ 11 portala · 2.779 oglasa ukupno</p>
    </div>
  )
}

function LeadMockup() {
  return (
    <div className="hiw-lead-card">
      {/* Verified badge */}
      <div className="hiw-lead-verified">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        Potvrđeni Vlasnik
      </div>

      {/* Identity */}
      <div>
        <div className="hiw-lead-name">Marko Petrović</div>
        <div className="hiw-lead-meta">Stan · 68m² · Vračar · 4. sprat</div>
      </div>

      {/* Blurred phone — reveals on CSS :hover of .hiw-step-mockup */}
      <div className="hiw-phone-row">
        <svg className="hiw-phone-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5
            19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2
            2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91
            8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339
            1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        <span className="hiw-phone">+387 61 234 567</span>
        <span className="hiw-reveal-hint">HOVER</span>
      </div>

      {/* Call button — spring scale on hover */}
      <button className="hiw-call-btn" type="button">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5
            19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.4 2 2 0 0 1 3.6 1.22h3a2
            2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91
            8.85a16 16 0 0 0 6.29 6.29l.95-.96a2 2 0 0 1 2.11-.45c.907.339
            1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
        </svg>
        Pozovi Vlasnika
      </button>
    </div>
  )
}

/* ── Main exported component ─────────────────────────────── */

export default function HowItWorks() {
  return (
    <section className="hiw-section">
      {/* Section header */}
      <div className="hiw-header">
        <div className="s2-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          3 Prosta Koraka
        </div>

        <h2 className="hiw-h2">
          Od instalacije do ekskluzivnog<br />
          <span style={{ color: 'var(--accent)' }}>ugovora za 60 sekundi</span>
        </h2>

        <p className="hiw-subtitle">
          Zaboravite na komplikovane obuke i softvere. Naš sistem je napravljen
          da bude intuitivan.
        </p>
      </div>

      {/* Steps — CSS grid on desktop, timeline on mobile */}
      <div className="hiw-container">
        <div className="hiw-steps-wrapper">

          {/* ── STEP 1: One-click install ─────────────── */}
          <article className="hiw-step-card">
            <div className="hiw-step-badge-wrap">
              <div className="hiw-step-badge" aria-hidden="true">01</div>
            </div>
            <div className="hiw-step-inner">
              <div className="hiw-step-mockup">
                <ExtensionMockup />
              </div>
              <h3 className="hiw-step-title">Instalacija u 1 klik</h3>
              <p className="hiw-step-body">
                Dodajte ekstenziju u vaš Chrome browser za manje od 10 sekundi.
                Bez unošenja kreditne kartice, odmah dobijate 7 dana potpunog
                besplatnog pristupa.
              </p>
            </div>
          </article>

          {/* ── STEP 2: AI scanner ───────────────────── */}
          <article className="hiw-step-card">
            <div className="hiw-step-badge-wrap">
              <div className="hiw-step-badge" aria-hidden="true">02</div>
            </div>
            <div className="hiw-step-inner">
              <div className="hiw-step-mockup">
                <ScannerMockup />
              </div>
              <h3 className="hiw-step-title">AI Autopilot Skeniranje</h3>
              <p className="hiw-step-body">
                Otvorite bilo koji oglas. Naš AI u pozadini trenutno skenira
                stranicu, filtrira agencijske duplikate i izoluje prve, prave
                objave vlasnika.
              </p>
            </div>
          </article>

          {/* ── STEP 3: Close the deal ────────────────── */}
          <article className="hiw-step-card">
            <div className="hiw-step-badge-wrap">
              <div className="hiw-step-badge" aria-hidden="true">03</div>
            </div>
            <div className="hiw-step-inner">
              <div className="hiw-step-mockup">
                <LeadMockup />
              </div>
              <h3 className="hiw-step-title">Zatvaranje Ugovora</h3>
              <p className="hiw-step-body">
                Svi podaci i istorija oglasa su ispred vas. Pozovite direktnog
                vlasnika pre nego što konkurentske agencije uopšte saznaju da
                oglas postoji.
              </p>
            </div>
          </article>

        </div>
      </div>
    </section>
  )
}
