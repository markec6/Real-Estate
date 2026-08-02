'use client'

import ContactCard from '@/components/dashboard/ContactCard'
import FaqAccordion from '@/components/dashboard/FaqAccordion'
import FinancesCard from '@/components/dashboard/FinancesCard'
import MicrolocationCard from '@/components/dashboard/MicrolocationCard'
import NegotiationCard from '@/components/dashboard/NegotiationCard'
import RedFlagsCard from '@/components/dashboard/RedFlagsCard'
import { parseAiAnalysisDetail } from '@/lib/dashboard/parseAiAnalysisDetail'
import type { ListingDisplay } from '@/lib/dashboard/types'

type ListingDetailViewProps = {
  listing: ListingDisplay
}

const SPEC_LABELS = [
  { key: 'totalPriceLabel' as const, label: 'Ukupna cena' },
  { key: 'sizeLabel' as const, label: 'Kvadratura' },
  { key: 'pricePerSqmLabel' as const, label: 'Cena / m²' },
  { key: 'floorLabel' as const, label: 'Sprat' },
  { key: 'registrationLabel' as const, label: 'Uknjiženost' },
]

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14 3h7v7" />
      <path d="M10 14 21 3" />
      <path d="M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6" />
    </svg>
  )
}

export default function ListingDetailView({ listing }: ListingDetailViewProps) {
  const detail = parseAiAnalysisDetail(listing)

  return (
    <div className="listing-detail">
      <header className="listing-detail-header dashboard-glass">
        <div className="listing-detail-header-top">
          <div className="listing-detail-titles">
            <p className="listing-detail-eyebrow">Detaljna analiza</p>
            <h1 className="listing-detail-title">{detail.title}</h1>
            <p className="listing-detail-location">{detail.locationLabel}</p>
          </div>

          {detail.portalUrl ? (
            <a
              className="listing-detail-portal"
              href={detail.portalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Otvori originalni oglas
              <ExternalLinkIcon />
            </a>
          ) : null}
        </div>

        <dl className="quick-specs">
          {SPEC_LABELS.map((spec) => (
            <div key={spec.key} className="quick-spec">
              <dt className="quick-spec-label">{spec.label}</dt>
              <dd className="quick-spec-value">{detail.quickSpecs[spec.key]}</dd>
            </div>
          ))}
        </dl>
      </header>

      <ContactCard contact={detail.contact} />

      <div className="analysis-grid">
        <FinancesCard finances={detail.finances} />
        <RedFlagsCard redFlags={detail.redFlags} />
        <NegotiationCard negotiation={detail.negotiation} />
        <MicrolocationCard microlocation={detail.microlocation} />
      </div>

      <FaqAccordion faqs={detail.faqs} />
    </div>
  )
}
