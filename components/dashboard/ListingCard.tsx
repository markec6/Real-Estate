'use client'

import {
  formatEuro,
  formatEuroPerSqm,
} from '@/lib/dashboard/parseListingDisplay'
import type { ListingDisplay } from '@/lib/dashboard/types'

type ListingCardProps = {
  listing: ListingDisplay
  selected?: boolean
  onSelect: (savedId: number) => void
}

function ThumbIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21h18M3 18h18M6 18V9M10 18V9M14 18V9M18 18V9M4 9h16M12 3l8 6H4l8-6z" />
    </svg>
  )
}

export default function ListingCard({
  listing,
  selected = false,
  onSelect,
}: ListingCardProps) {
  const locationParts = [listing.city, listing.neighborhood].filter(Boolean)
  const locationLabel = locationParts.length > 0 ? locationParts.join(' · ') : 'Lokacija nije dostupna'

  return (
    <button
      type="button"
      className={selected ? 'listing-card listing-card-selected' : 'listing-card'}
      onClick={() => onSelect(listing.savedId)}
      aria-pressed={selected}
    >
      <div className="listing-card-thumb" aria-hidden="true">
        <ThumbIcon />
      </div>
      <div className="listing-card-body">
        <div className="listing-card-title-row">
          <h3 className="listing-card-title">{listing.title}</h3>
          <span
            className={
              listing.isOwner ? 'listing-badge listing-badge-owner' : 'listing-badge listing-badge-agency'
            }
          >
            {listing.advertiserLabel}
          </span>
        </div>
        <p className="listing-card-price">{formatEuro(listing.priceEur)}</p>
        <p className="listing-card-meta">
          <span>{formatEuroPerSqm(listing.pricePerSqm)}</span>
          <span>{locationLabel}</span>
        </p>
      </div>
    </button>
  )
}
