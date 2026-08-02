'use client'

import { useEffect, useMemo, useState } from 'react'
import EmptySavedState from '@/components/dashboard/EmptySavedState'
import ListingCardSkeleton from '@/components/dashboard/ListingCardSkeleton'
import PropertySidebar from '@/components/dashboard/PropertySidebar'
import PropertySwitcherSheet from '@/components/dashboard/PropertySwitcherSheet'
import PropertyTopBar from '@/components/dashboard/PropertyTopBar'
import {
  formatEuro,
  formatEuroPerSqm,
} from '@/lib/dashboard/parseListingDisplay'
import type { ListingDisplay } from '@/lib/dashboard/types'

const SELECTED_STORAGE_KEY = 'brei-dashboard-selected-id'

type DashboardShellProps = {
  listings: ListingDisplay[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
}

function ThumbIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 21h18M3 18h18M6 18V9M10 18V9M14 18V9M18 18V9M4 9h16M12 3l8 6H4l8-6z" />
    </svg>
  )
}

function readStoredSelectedId(): number | null {
  try {
    const raw = localStorage.getItem(SELECTED_STORAGE_KEY)
    if (!raw) return null
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function persistSelectedId(savedId: number) {
  try {
    localStorage.setItem(SELECTED_STORAGE_KEY, String(savedId))
  } catch {
    /* ignore quota / private mode */
  }
}

export default function DashboardShell({
  listings,
  loading = false,
  error = null,
  onRetry,
}: DashboardShellProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  useEffect(() => {
    if (loading || listings.length === 0) {
      setSelectedId(null)
      return
    }

    const storedId = readStoredSelectedId()
    const stillExists =
      storedId !== null && listings.some((item) => item.savedId === storedId)

    const nextId = stillExists ? storedId : listings[0].savedId
    setSelectedId(nextId)
    persistSelectedId(nextId)
  }, [listings, loading])

  const selected = useMemo(
    () => listings.find((item) => item.savedId === selectedId) ?? null,
    [listings, selectedId],
  )

  function handleSelect(savedId: number) {
    setSelectedId(savedId)
    persistSelectedId(savedId)
  }

  if (!loading && error) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-main">
          <div className="dashboard-state dashboard-glass">
            <h2>Greška pri učitavanju</h2>
            <p className="dashboard-error-text">{error}</p>
            {onRetry ? (
              <button type="button" className="dashboard-cta" onClick={onRetry}>
                Pokušaj ponovo
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  if (!loading && listings.length === 0) {
    return (
      <div className="dashboard-shell">
        <div className="dashboard-main">
          <EmptySavedState />
        </div>
      </div>
    )
  }

  const locationLabel = selected
    ? [selected.city, selected.neighborhood].filter(Boolean).join(' · ') ||
      'Lokacija nije dostupna'
    : ''

  return (
    <div className="dashboard-shell">
      <PropertyTopBar
        selected={selected}
        totalCount={listings.length}
        onOpenSwitcher={() => setSheetOpen(true)}
      />

      <PropertySidebar
        listings={listings}
        selectedId={selectedId}
        loading={loading}
        onSelect={handleSelect}
      />

      <main className="dashboard-main">
        {loading ? (
          <div className="selected-listing-panel">
            <ListingCardSkeleton count={2} />
          </div>
        ) : selected ? (
          <div className="selected-listing-panel">
            <section className="selected-listing-hero dashboard-glass">
              <div className="selected-listing-hero-grid">
                <div className="listing-card-thumb" aria-hidden="true">
                  <ThumbIcon />
                </div>
                <div>
                  <div className="listing-card-title-row">
                    <h1 className="dashboard-section-title" style={{ margin: 0 }}>
                      {selected.title}
                    </h1>
                    <span
                      className={
                        selected.isOwner
                          ? 'listing-badge listing-badge-owner'
                          : 'listing-badge listing-badge-agency'
                      }
                    >
                      {selected.advertiserLabel}
                    </span>
                  </div>
                  <p className="selected-listing-location">{locationLabel}</p>
                  <div className="selected-listing-pricing">
                    <div className="selected-listing-price-block">
                      <span className="selected-listing-price-label">Cena</span>
                      <span className="selected-listing-price-value">
                        {formatEuro(selected.priceEur)}
                      </span>
                    </div>
                    <div className="selected-listing-price-block">
                      <span className="selected-listing-price-label">Cena / m²</span>
                      <span className="selected-listing-price-value">
                        {formatEuroPerSqm(selected.pricePerSqm)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="analysis-placeholder dashboard-glass">
              <span className="analysis-placeholder-badge">AI analiza</span>
              <h2 className="dashboard-section-title">Detalji analize — uskoro</h2>
              <p className="dashboard-section-subtitle">
                Ovde će se prikazati sažetak, rizici, pregovaračka strategija i kontakt
                podaci iz sačuvane AI analize.
              </p>
            </section>
          </div>
        ) : null}
      </main>

      <PropertySwitcherSheet
        open={sheetOpen}
        listings={listings}
        selectedId={selectedId}
        onClose={() => setSheetOpen(false)}
        onSelect={handleSelect}
      />
    </div>
  )
}
