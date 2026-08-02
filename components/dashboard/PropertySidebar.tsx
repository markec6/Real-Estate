'use client'

import ListingCard from '@/components/dashboard/ListingCard'
import ListingCardSkeleton from '@/components/dashboard/ListingCardSkeleton'
import type { ListingDisplay } from '@/lib/dashboard/types'

type PropertySidebarProps = {
  listings: ListingDisplay[]
  selectedId: number | null
  loading?: boolean
  onSelect: (savedId: number) => void
}

export default function PropertySidebar({
  listings,
  selectedId,
  loading = false,
  onSelect,
}: PropertySidebarProps) {
  return (
    <aside className="property-sidebar" aria-label="Moje nekretnine">
      <div className="property-sidebar-header">
        <h2 className="dashboard-section-title">Moje Nekretnine</h2>
        <p className="property-sidebar-count">
          {loading ? 'Učitavanje…' : `${listings.length} sačuvanih oglasa`}
        </p>
      </div>
      {loading ? (
        <ListingCardSkeleton count={4} />
      ) : (
        <div className="property-sidebar-list">
          {listings.map((listing) => (
            <ListingCard
              key={listing.savedId}
              listing={listing}
              selected={listing.savedId === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </aside>
  )
}
