'use client'

import { useId, useState } from 'react'
import type { DetailContact } from '@/lib/dashboard/analysisDetailTypes'

type CopyState = 'idle' | 'copied' | 'error'

type ContactCardProps = {
  contact: DetailContact | null
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.68 2.35a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.73-1.27a2 2 0 0 1 2.11-.45c.75.32 1.54.55 2.35.68A2 2 0 0 1 22 16.92z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="m22 6-10 7L2 6" />
    </svg>
  )
}

export default function ContactCard({ contact }: ContactCardProps) {
  const feedbackId = useId()
  const [copyState, setCopyState] = useState<CopyState>('idle')

  if (!contact) {
    return (
      <section className="contact-card dashboard-glass" aria-label="Kontakt">
        <h2 className="detail-card-title">Kontakt oglašivača</h2>
        <p className="detail-empty-state">Nije deo sačuvane analize</p>
      </section>
    )
  }

  async function copyPhone() {
    if (!contact?.phoneNumber) return

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(contact.phoneNumber)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = contact.phoneNumber
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2200)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2200)
    }
  }

  const copyFeedback =
    copyState === 'copied'
      ? 'Broj je kopiran.'
      : copyState === 'error'
        ? 'Kopiranje nije uspelo. Pokušajte ručno.'
        : ''

  return (
    <section className="contact-card dashboard-glass" aria-label="Kontakt">
      <div className="contact-card-header">
        <div className="contact-card-identity">
          <p className="contact-card-label">Oglašivač</p>
          <h2 className="contact-card-name">{contact.displayName}</h2>
        </div>
        <span
          className={
            contact.badgeLabel === 'Fizičko lice'
              ? 'listing-badge listing-badge-owner'
              : 'listing-badge listing-badge-agency'
          }
        >
          {contact.badgeLabel}
        </span>
      </div>

      {contact.phoneNumber ? (
        <p className="contact-card-phone">{contact.phoneNumber}</p>
      ) : (
        <p className="detail-empty-state">Broj telefona nije sačuvan.</p>
      )}

      <div className="contact-card-actions">
        {contact.telHref ? (
          <a className="contact-action contact-action-primary" href={contact.telHref}>
            <PhoneIcon />
            Pozovi Odmah
          </a>
        ) : null}

        {contact.phoneNumber ? (
          <button
            type="button"
            className="contact-action contact-action-secondary"
            onClick={copyPhone}
            aria-describedby={copyFeedback ? feedbackId : undefined}
          >
            <CopyIcon />
            {copyState === 'copied' ? 'Kopirano' : 'Kopiraj Broj'}
          </button>
        ) : null}

        {contact.mailtoHref ? (
          <a
            className="contact-action contact-action-secondary"
            href={contact.mailtoHref}
          >
            <MailIcon />
            Pošalji Email
          </a>
        ) : null}
      </div>

      {copyFeedback ? (
        <p id={feedbackId} className="contact-copy-feedback" aria-live="polite">
          {copyFeedback}
        </p>
      ) : null}
    </section>
  )
}
