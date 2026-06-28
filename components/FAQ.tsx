'use client'

import { useState } from 'react'

interface FaqItem {
  question: string
  answer: string
}

const faqItems: FaqItem[] = [
  {
    question: 'Koji su portali za nekretnine pokriveni skeniranjem?',
    answer:
      'Naš AI sistem u realnom vremenu skenira preko 14 vodećih portala u regionu, uključujući HaloOglase, 4Zida, Nekretnine.rs, Sasomange, kao i ključne oglasnike u BiH i Crnoj Gori.',
  },
  {
    question: 'Kako softver prepoznaje da je oglas postavio direktan vlasnik?',
    answer:
      'AI algoritam analizira kompletan tekst oglasa, strukturu rečenica, priložene brojeve telefona i istoriju oglašivača. Ako sistem detektuje prepoznatljive agencijske fraze ili brojeve koji pripadaju bazi registrovanih posrednika, oglas se automatski filtrira. Vama ostaju isključivo izvorni vlasnici.',
  },
  {
    question: 'Da li stvarno nije potrebna kreditna kartica za probni period?',
    answer:
      'Da, apsolutno. Prilikom kreiranja naloga odmah dobijate punih 7 dana besplatnog pristupa. Nema nikakvih skrivenih troškova, sitnih slova niti tražimo da unesete podatke o vašoj kartici.',
  },
  {
    question: 'Kako se instalira Chrome ekstenzija i da li radi na Mac-u?',
    answer:
      'Instalacija se završava u jednom jedinom kliku preko zvaničnog Chrome Web Store-a. Pošto se pokreće direktno unutar vašeg Google Chrome pretraživača, ekstenzija savršeno i stabilno funkcioniše i na Windows i na Mac računarima.',
  },
]

function PlusIcon({ open }: { open: boolean }) {
  return (
    <span className={`faq-icon${open ? ' faq-icon-open' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggle = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  return (
    <section className="faq-section" aria-labelledby="faq-heading">
      {/* Section header */}
      <div className="faq-header">
        <div className="s2-badge">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Rešavamo Dileme
        </div>

        <h2 className="hiw-h2" id="faq-heading">
          Sve što vas zanima o našem{' '}
          <span style={{ color: 'var(--accent)' }}>AI sistemu</span>
        </h2>

        <p className="faq-subtitle">
          Imate pitanja? Imamo brze i jasne odgovore. Ako ne pronađete ono što tražite,
          naša podrška je uvek tu.
        </p>
      </div>

      {/* Accordion list */}
      <div className="faq-container">
        <div className="faq-list">
          {faqItems.map((item, index) => {
            const isOpen = openIndex === index
            const panelId = `faq-panel-${index}`
            const triggerId = `faq-trigger-${index}`

            return (
              <article
                key={item.question}
                className={`faq-item${isOpen ? ' faq-item-open' : ''}`}
              >
                <button
                  type="button"
                  id={triggerId}
                  className="faq-trigger"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <span className="faq-question">{item.question}</span>
                  <PlusIcon open={isOpen} />
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  className={`faq-answer-grid${isOpen ? ' faq-answer-grid-open' : ''}`}
                >
                  <div className="faq-answer-inner">
                    <p className="faq-answer">{item.answer}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
