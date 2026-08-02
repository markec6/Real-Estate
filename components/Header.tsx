'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import AuthModal, { type AuthMode } from './AuthModal'
import { supabase } from '@/lib/supabase/client'

type UserProfile = {
  fullname: string | null
  email: string | null
  profile_image: string | null
}

const EXTENSION_AUTH_EVENT = 'BREI_WEBSITE_AUTH_SESSION'

function getMetadataDisplayName(user: User | null) {
  const metadataName = user?.user_metadata?.fullname
  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim()
  }

  return user?.email ?? 'Korisnik'
}

function getDisplayName(user: User | null, profile: UserProfile | null) {
  const profileName = profile?.fullname
  if (typeof profileName === 'string' && profileName.trim()) {
    return profileName.trim()
  }

  return getMetadataDisplayName(user)
}

function getInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || 'U'
}

function getMetadataProfileImage(user: User) {
  const metadataImage = user.user_metadata?.profile_image
  if (typeof metadataImage === 'string' && metadataImage.trim()) {
    return metadataImage.trim()
  }

  return null
}

function publishExtensionSession(session: unknown) {
  // Content script (websiteAuthBridge) listens for this and syncs into chrome.storage.
  // Target is always the page origin; the bridge validates against allowed website origins.
  window.postMessage(
    {
      type: EXTENSION_AUTH_EVENT,
      sessionValue: session ? JSON.stringify(session) : null,
    },
    window.location.origin,
  )
}

export default function Header() {
  const pathname = usePathname()
  const isDashboard = pathname === '/dashboard'
  const [dark, setDark] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileImage, setProfileImage] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  /* Sync React state with whatever the inline theme script already set on <html> */
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
      publishExtensionSession(data.session ?? null)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
      publishExtensionSession(session ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    if (params.get('openAuth') !== 'true') {
      return
    }

    params.delete('openAuth')
    setAuthMode('sign-in')
    setAuthModalOpen(true)
    setMobileMenuOpen(false)

    const nextSearch = params.toString()
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', nextUrl)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (!mobileMenuRef.current?.contains(target)) {
        setMobileMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    let active = true

    async function loadProfile(activeUser: User) {
      setProfile(null)
      setProfileImage(getMetadataProfileImage(activeUser))

      const { data, error } = await supabase
        .from('profiles')
        .select('fullname,email,profile_image')
        .eq('id', activeUser.id)
        .maybeSingle()

      if (!active || error) return

      const nextProfile = data as UserProfile | null
      setProfile(nextProfile)
      const image = nextProfile?.profile_image
      setProfileImage(typeof image === 'string' && image.trim() ? image.trim() : null)
    }

    if (user) {
      loadProfile(user)
    } else {
      setProfile(null)
      setProfileImage(null)
    }

    return () => {
      active = false
    }
  }, [user])

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark')
    setDark(isDark)
    try { localStorage.setItem('brei-theme', isDark ? 'dark' : 'light') } catch {}
  }

  function openAuthModal(nextMode: AuthMode) {
    setAuthMode(nextMode)
    setAuthModalOpen(true)
    setMobileMenuOpen(false)
  }

  async function signOut() {
    setMobileMenuOpen(false)
    setAuthLoading(true)
    const { error } = await supabase.auth.signOut()
    if (error) {
      setAuthLoading(false)
    }
  }

  function toggleThemeFromMenu() {
    toggleTheme()
    setMobileMenuOpen(false)
  }

  const displayName = user ? getDisplayName(user, profile) : ''
  const initial = displayName ? getInitial(displayName) : ''
  const avatarContent = profileImage ? (
    <img className="header-user-image" src={profileImage} alt="" />
  ) : (
    initial
  )

  return (
    <header className="site-header">
      <Link href="/" className="logo">
        <div className="logo-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 21h18M3 18h18M6 18V9M10 18V9M14 18V9M18 18V9M4 9h16M12 3l8 6H4l8-6z"/>
          </svg>
        </div>
        <div className="logo-text">
          <span className="logo-primary">Balkan Real Estate</span>
          <span className="logo-secondary">Intelligence Platform</span>
        </div>
      </Link>

      <div className="header-controls desktop-header-controls">
        {!authLoading && user ? (
          <nav className="header-nav" aria-label="Glavna navigacija">
            <Link
              href="/dashboard"
              className={isDashboard ? 'header-nav-link header-nav-link-active' : 'header-nav-link'}
              aria-current={isDashboard ? 'page' : undefined}
            >
              Dashboard
            </Link>
          </nav>
        ) : null}

        <div className="header-actions" aria-live="polite">
          {authLoading ? (
            <div className="header-auth-skeleton" aria-label="Provera sesije" />
          ) : user ? (
            <>
              <div className="header-user-badge" title={displayName}>
                <span className="header-user-initial" aria-hidden="true">{avatarContent}</span>
                <span className="header-user-name">{displayName}</span>
              </div>
              <button className="header-auth-button header-auth-button-ghost" onClick={signOut}>
                Odjava
              </button>
            </>
          ) : (
            <>
              <button
                className="header-auth-button header-auth-button-ghost"
                onClick={() => openAuthModal('sign-in')}
              >
                Prijava
              </button>
              <button
                className="header-auth-button header-auth-button-primary"
                onClick={() => openAuthModal('sign-up')}
              >
                Registracija
              </button>
            </>
          )}
        </div>

        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <div className="toggle-thumb">
            <svg className="icon-sun" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <svg className="icon-moon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          </div>
        </button>
      </div>

      <div className="mobile-menu-shell" ref={mobileMenuRef}>
        <button
          className={mobileMenuOpen ? 'mobile-menu-trigger mobile-menu-trigger-open' : 'mobile-menu-trigger'}
          type="button"
          aria-label={mobileMenuOpen ? 'Zatvori meni' : 'Otvori meni'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-header-menu"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span className="mobile-menu-icon" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <div
          id="mobile-header-menu"
          className={mobileMenuOpen ? 'mobile-menu-panel mobile-menu-panel-open' : 'mobile-menu-panel'}
          aria-hidden={!mobileMenuOpen}
        >
          {!authLoading && user ? (
            <nav className="mobile-menu-nav" aria-label="Glavna navigacija">
              <Link
                href="/dashboard"
                className={
                  isDashboard
                    ? 'mobile-menu-nav-link mobile-menu-nav-link-active'
                    : 'mobile-menu-nav-link'
                }
                aria-current={isDashboard ? 'page' : undefined}
                onClick={() => setMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
            </nav>
          ) : null}

          <div className="mobile-menu-section" aria-live="polite">
            {authLoading ? (
              <div className="header-auth-skeleton mobile-menu-skeleton" aria-label="Provera sesije" />
            ) : user ? (
              <>
                <div className="header-user-badge mobile-menu-user-badge" title={displayName}>
                  <span className="header-user-initial" aria-hidden="true">{avatarContent}</span>
                  <span className="header-user-name">{displayName}</span>
                </div>
                <button className="header-auth-button header-auth-button-ghost mobile-menu-button" onClick={signOut}>
                  Odjava
                </button>
              </>
            ) : (
              <>
                <button
                  className="header-auth-button header-auth-button-ghost mobile-menu-button"
                  onClick={() => openAuthModal('sign-in')}
                >
                  Prijava
                </button>
                <button
                  className="header-auth-button header-auth-button-primary mobile-menu-button"
                  onClick={() => openAuthModal('sign-up')}
                >
                  Registracija
                </button>
              </>
            )}
          </div>

          <div className="mobile-menu-theme-row">
            <div>
              <span className="mobile-menu-label">Tema</span>
              <span className="mobile-menu-subtitle">{dark ? 'Tamni mod' : 'Svetli mod'}</span>
            </div>
            <button
              className="theme-toggle"
              onClick={toggleThemeFromMenu}
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              <div className="toggle-thumb">
                <svg className="icon-sun" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
                <svg className="icon-moon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
              </div>
            </button>
          </div>
        </div>
      </div>

      <AuthModal
        open={authModalOpen}
        mode={authMode}
        onOpenChange={setAuthModalOpen}
        onModeChange={setAuthMode}
      />
    </header>
  )
}
