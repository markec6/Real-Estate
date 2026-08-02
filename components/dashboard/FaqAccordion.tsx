'use client'

import { useState } from 'react'
import type { FaqDetailItem } from '@/lib/dashboard/analysisDetailTypes'

type FaqAccordionProps = {
  faqs: FaqDetailItem[]
}

function PlusIcon({ open }: { open: boolean }) {
  return (
    <span
      className={`dash-faq-icon${open ? ' dash-faq-icon-open' : ''}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </span>
  )
}

export default function FaqAccordion({ faqs }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  function toggle(index: number) {
    setOpenIndex((prev) => (prev === index ? null : index))
  }

  return (
    <section className="dash-faq dashboard-glass" aria-labelledby="dash-faq-title">
      <h2 id="dash-faq-title" className="detail-card-title">
        Česta pitanja o oglasu
      </h2>

      {faqs.length === 0 ? (
        <p className="detail-empty-state">Nema sačuvanih pitanja za ovaj oglas.</p>
      ) : (
        <div className="dash-faq-list">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index
            const panelId = `dash-faq-panel-${index}`
            const triggerId = `dash-faq-trigger-${index}`

            return (
              <article
                key={`${item.question}-${index}`}
                className={`dash-faq-item${isOpen ? ' dash-faq-item-open' : ''}`}
              >
                <button
                  type="button"
                  id={triggerId}
                  className="dash-faq-trigger"
                  onClick={() => toggle(index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  <span className="dash-faq-question">{item.question}</span>
                  <PlusIcon open={isOpen} />
                </button>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={triggerId}
                  className={`dash-faq-answer-grid${isOpen ? ' dash-faq-answer-grid-open' : ''}`}
                >
                  <div className="dash-faq-answer-inner">
                    <p className="dash-faq-answer">{item.answer}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
