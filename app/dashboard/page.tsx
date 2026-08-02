'use client'

import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import AuthModal, { type AuthMode } from '@/components/AuthModal'
import Header from '@/components/Header'
import AuthGate from '@/components/dashboard/AuthGate'
import DashboardShell from '@/components/dashboard/DashboardShell'
import { fetchSavedListings } from '@/lib/dashboard/fetchSavedListings'
import type { DashboardLoadState, ListingDisplay } from '@/lib/dashboard/types'
import { supabase } from '@/lib/supabase/client'

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [loadState, setLoadState] = useState<DashboardLoadState>('loading')
  const [listings, setListings] = useState<ListingDisplay[]>([])
  const [error, setError] = useState<string | null>(null)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')

  const loadListings = useCallback(async () => {
    setLoadState('loading')
    setError(null)

    const result = await fetchSavedListings()

    if (!result.ok) {
      setListings([])
      setError(result.error)
      setLoadState('error')
      return
    }

    setListings(result.listings)
    setLoadState('ready')
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setAuthChecked(true)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthChecked(true)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!authChecked) return

    if (!user) {
      setListings([])
      setError(null)
      setLoadState('unauthenticated')
      return
    }

    void loadListings()
  }, [authChecked, user, loadListings])

  function openSignIn() {
    setAuthMode('sign-in')
    setAuthModalOpen(true)
  }

  return (
    <div className="dashboard-page">
      <Header />
      <div className="dashboard-root">
        {!authChecked ? (
          <div className="dashboard-shell">
            <div className="dashboard-main">
              <div className="dashboard-state dashboard-glass" aria-busy="true">
                <h2>Provera sesije…</h2>
                <p>Trenutno proveravamo da li ste prijavljeni.</p>
              </div>
            </div>
          </div>
        ) : !user ? (
          <div className="dashboard-shell">
            <div className="dashboard-main">
              <AuthGate onSignIn={openSignIn} />
            </div>
          </div>
        ) : (
          <DashboardShell
            listings={listings}
            loading={loadState === 'loading'}
            error={loadState === 'error' ? error : null}
            onRetry={loadListings}
          />
        )}
      </div>

      <AuthModal
        open={authModalOpen}
        mode={authMode}
        onOpenChange={setAuthModalOpen}
        onModeChange={setAuthMode}
      />
    </div>
  )
}
