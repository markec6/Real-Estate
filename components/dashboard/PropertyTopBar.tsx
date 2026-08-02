'use client'

import { formatEuro } from '@/lib/dashboard/parseListingDisplay'
import type { ListingDisplay } from '@/lib/dashboard/types'

type PropertyTopBarProps = {
  selected: ListingDisplay | null
  totalCount: number
  onOpenSwitcher: () => void
}

export default function PropertyTopBar({
  selected,
  totalCount,
  onOpenSwitcher,
}: PropertyTopBarProps) {
  return (
    <div className="property-top-bar dashboard-mobile-only">
      <p className="property-top-bar-label">Moje Nekretnine</p>
      <div className="property-top-bar-row">
        <div className="property-top-bar-current">
          <h2 className="property-top-bar-title">
            {selected?.title ?? 'Izaberite oglas'}
          </h2>
          <p className="property-top-bar-meta">
            {selected ? formatEuro(selected.priceEur) : 'Nema izabranog oglasa'}
            {selected?.city ? ` · ${selected.city}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="property-switch-button"
          onClick={onOpenSwitcher}
          aria-haspopup="dialog"
        >
          Promeni oglas ({totalCount})
        </button>
      </div>
    </div>
  )
}
