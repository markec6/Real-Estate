'use client'

import { useEffect, useId, useRef } from 'react'
import ListingCard from '@/components/dashboard/ListingCard'
import type { ListingDisplay } from '@/lib/dashboard/types'

type PropertySwitcherSheetProps = {
  open: boolean
  listings: ListingDisplay[]
  selectedId: number | null
  onClose: () => void
  onSelect: (savedId: number) => void
}

export default function PropertySwitcherSheet({
  open,
  listings,
  selectedId,
  onClose,
  onSelect,
}: PropertySwitcherSheetProps) {
  const titleId = useId()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null
    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus()
    })

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
      previouslyFocusedRef.current?.focus?.()
    }
  }, [open, onClose])

  function handleSelect(savedId: number) {
    onSelect(savedId)
    onClose()
  }

  return (
    <>
      <div
        className={
          open
            ? 'property-sheet-backdrop property-sheet-backdrop-open dashboard-mobile-only'
            : 'property-sheet-backdrop dashboard-mobile-only'
        }
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={
          open
            ? 'property-sheet property-sheet-open dashboard-mobile-only'
            : 'property-sheet dashboard-mobile-only'
        }
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden={!open}
      >
        <div className="property-sheet-handle" aria-hidden="true" />
        <div className="property-sheet-header">
          <h2 id={titleId}>Promeni oglas ({listings.length})</h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="property-sheet-close"
            onClick={onClose}
            aria-label="Zatvori"
          >
            ✕
          </button>
        </div>
        <div className="property-sheet-list">
          {listings.map((listing) => (
            <ListingCard
              key={listing.savedId}
              listing={listing}
              selected={listing.savedId === selectedId}
              onSelect={handleSelect}
            />
          ))}
        </div>
      </div>
    </>
  )
}
