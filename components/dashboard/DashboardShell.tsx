'use client'

import { useEffect, useMemo, useState } from 'react'
import EmptySavedState from '@/components/dashboard/EmptySavedState'
import ListingCardSkeleton from '@/components/dashboard/ListingCardSkeleton'
import ListingDetailView from '@/components/dashboard/ListingDetailView'
import PropertySidebar from '@/components/dashboard/PropertySidebar'
import PropertySwitcherSheet from '@/components/dashboard/PropertySwitcherSheet'
import PropertyTopBar from '@/components/dashboard/PropertyTopBar'
import type { ListingDisplay } from '@/lib/dashboard/types'

const SELECTED_STORAGE_KEY = 'brei-dashboard-selected-id'

type DashboardShellProps = {
  listings: ListingDisplay[]
  loading?: boolean
  error?: string | null
  onRetry?: () => void
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
            <ListingDetailView listing={selected} />
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
