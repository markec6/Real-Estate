'use client'

import { useState } from 'react'

type Billing = 'monthly' | 'annual'

type FeatureItem = string | { strong: string; rest: string }

interface Plan {
  id: string
  name: string
  price: Record<Billing, string>
  period: Record<Billing, string>
  hook?: string
  features: FeatureItem[]
  cta: string
  btnClass: string
  popular?: boolean
}

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Probni Period',
    price: { monthly: 'Besplatno', annual: 'Besplatno' },
    period: { monthly: '7 dana · bez kartice', annual: '7 dana · bez kartice' },
    hook: 'Bez unosa kreditne kartice. Aktivacija za 10 sekundi.',
    features: [
      'Skeniranje 3 glavna portala',
      'Osnovni AI filter duplikata',
      'Pametna sveska za do 20 oglasa',
    ],
    cta: 'Započni Besplatno',
    btnClass: 'pricing-btn-free',
  },
  {
    id: 'pro',
    name: 'Agent Pro',
    price: { monthly: '49 €', annual: '39 €' },
    period: { monthly: '/ mesec', annual: '/ mesec · godišnja naplata' },
    features: [
      { strong: 'NEOGRANIČENO', rest: ' AI skeniranje svih 14 portala' },
      'Instant otključavanje telefona vlasnika',
      'Istorija promjena cijena i hronologija oglasa',
      'Automatska filtracija agencijskih kopija',
      'Prioritetna Viber/WhatsApp podrška',
    ],
    cta: 'Postani Pro Agent',
    btnClass: 'pricing-btn-pro',
    popular: true,
  },
  {
    id: 'team',
    name: 'Agencija / Tim',
    price: { monthly: '129 €', annual: '99 €' },
    period: { monthly: '/ mesec · do 10 agenata', annual: '/ mesec · do 10 agenata' },
    features: [
      'Sve iz AGENT PRO paketa',
      'Zajednički timski panel bez duplikacije poziva',
      'Menadžerska analitika efikasnosti tima',
      'Dedicated Account Manager',
    ],
    cta: 'Nadogradi Ceo Tim',
    btnClass: 'pricing-btn-team',
  },
]

const trustItems = [
  { emoji: '🛡️', text: 'Sigurno plaćanje (SSL Enkripcija)' },
  { emoji: '⚡', text: 'Otkazivanje pretplate u bilo kom trenutku' },
  { emoji: '🤝', text: 'Bez skrivenih ugovornih obaveza' },
]

function CheckIcon() {
  return (
    <svg className="pricing-check" viewBox="0 0 24 24" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function FeatureText({ f }: { f: FeatureItem }) {
  if (typeof f === 'string') return <>{f}</>
  return (
    <>
      <strong className="pricing-feature-highlight">{f.strong}</strong>
      {f.rest}
    </>
  )
}

export default function Pricing() {
  const [billing, setBilling] = useState<Billing>('monthly')

  return (
    <section className="pricing-section">
      {/* Section header */}
      <div className="pricing-header">
        <div className="s2-badge">
          <svg
            width="12" height="12" viewBox="0 0 24 24"
            fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          Fleksibilni Paketi
        </div>

        <h2 className="hiw-h2">
          Investicija koja se isplati<br />
          <span style={{ color: 'var(--accent)' }}>već nakon prve ekskluzive</span>
        </h2>

        <p className="hiw-subtitle">
          Izaberite paket prilagođen vašem obimu posla. Svi paketi uključuju
          stabilnu podršku i nultu stopu skrivenih troškova.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="pricing-toggle-wrap">
        <div className="pricing-toggle" data-billing={billing} role="tablist" aria-label="Period naplate">
          <div className="pricing-bubble" aria-hidden="true" />

          <button
            className={`pricing-tab${billing === 'monthly' ? ' active' : ''}`}
            onClick={() => setBilling('monthly')}
            role="tab"
            aria-selected={billing === 'monthly'}
          >
            Mesečno
          </button>

          <button
            className={`pricing-tab${billing === 'annual' ? ' active' : ''}`}
            onClick={() => setBilling('annual')}
            role="tab"
            aria-selected={billing === 'annual'}
          >
            Godišnje
            <span className="pricing-save-tag">Uštedi 20%</span>
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="pricing-container">
        <div className="pricing-grid">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`pricing-card${plan.popular ? ' pricing-card-pro' : ''}`}
            >
              {/* Popular ribbon */}
              {plan.popular && (
                <div className="pricing-popular-badge" aria-label="Najpopularniji paket">
                  ★ NAJPOPULARNIJE
                </div>
              )}

              {/* Plan name */}
              <p className="pricing-plan-name">{plan.name}</p>

              {/* Price — React key triggers re-mount → CSS animation on every toggle */}
              <div className="pricing-price-wrap">
                <span
                  key={`${plan.id}-${billing}`}
                  className="pricing-price-val"
                >
                  {plan.price[billing]}
                </span>
              </div>

              <p className="pricing-period">{plan.period[billing]}</p>

              {plan.hook && <p className="pricing-hook">{plan.hook}</p>}

              <hr className="pricing-divider" />

              {/* Features */}
              <ul className="pricing-features" aria-label={`${plan.name} features`}>
                {plan.features.map((f, i) => (
                  <li key={i} className="pricing-feature">
                    <CheckIcon />
                    <span className="pricing-feature-text">
                      <FeatureText f={f} />
                    </span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                type="button"
                className={`pricing-btn ${plan.btnClass}`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Trust badges */}
        <div className="pricing-trust-row" role="list" aria-label="Sigurnosne garancije">
          {trustItems.map((item) => (
            <div key={item.text} className="pricing-trust-item" role="listitem">
              <span role="img" aria-hidden="true" style={{ fontSize: '1.125rem', lineHeight: 1 }}>
                {item.emoji}
              </span>
              {item.text}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
