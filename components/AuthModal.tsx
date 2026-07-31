'use client'

import { FormEvent, MouseEvent, useEffect, useId, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

export type AuthMode = 'sign-in' | 'sign-up'

type AuthModalProps = {
  open: boolean
  mode: AuthMode
  onOpenChange: (open: boolean) => void
  onModeChange: (mode: AuthMode) => void
  banner?: string
  postAuthRedirectUrl?: string
  onAuthSuccess?: () => void
}

export default function AuthModal({
  open,
  mode,
  onOpenChange,
  onModeChange,
  banner,
  postAuthRedirectUrl,
  onAuthSuccess,
}: AuthModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  const [fullName, setFullName] = useState('')
  const [city, setCity] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (open && !dialog.open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null
      dialog.showModal()
      document.body.classList.add('auth-modal-open')
    }

    if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    function handleClose() {
      document.body.classList.remove('auth-modal-open')
      previouslyFocusedRef.current?.focus()
      if (open) onOpenChange(false)
    }

    function handleCancel(event: Event) {
      event.preventDefault()
      onOpenChange(false)
    }

    dialog.addEventListener('close', handleClose)
    dialog.addEventListener('cancel', handleCancel)

    return () => {
      dialog.removeEventListener('close', handleClose)
      dialog.removeEventListener('cancel', handleCancel)
      document.body.classList.remove('auth-modal-open')
    }
  }, [onOpenChange, open])

  useEffect(() => {
    setError('')
    setMessage('')
    setPassword('')
  }, [mode, open])

  function closeModal() {
    onOpenChange(false)
  }

  function completeAuthentication() {
    closeModal()

    if (onAuthSuccess) {
      onAuthSuccess()
      return
    }

    if (postAuthRedirectUrl) {
      window.location.assign(postAuthRedirectUrl)
    }
  }

  function switchMode(nextMode: AuthMode) {
    if (loading || nextMode === mode) return
    onModeChange(nextMode)
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      closeModal()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    const trimmedFullName = fullName.trim()
    const trimmedCity = city.trim()
    const trimmedEmail = email.trim()

    if (mode === 'sign-up' && !trimmedFullName) {
      setError('Unesite puno ime.')
      return
    }

    if (mode === 'sign-up' && !trimmedCity) {
      setError('Unesite grad.')
      return
    }

    if (!trimmedEmail) {
      setError('Unesite email adresu.')
      return
    }

    if (password.length < 6) {
      setError('Lozinka mora imati najmanje 6 karaktera.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'sign-up') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            data: {
              fullname: trimmedFullName,
              city: trimmedCity,
            },
            ...(postAuthRedirectUrl
              ? {
                  emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(postAuthRedirectUrl)}`,
                }
              : {}),
          },
        })

        if (signUpError) throw signUpError

        if (data.session) {
          completeAuthentication()
          return
        }

        setMessage('Nalog je kreiran. Proverite email ako Supabase trazi potvrdu naloga.')
        return
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (signInError) throw signInError

      completeAuthentication()
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Autentifikacija nije uspela.')
    } finally {
      setLoading(false)
    }
  }

  const isSignUp = mode === 'sign-up'

  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClick={handleBackdropClick}
    >
      <div className="auth-panel" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          className="auth-close"
          onClick={closeModal}
          aria-label="Zatvori autentifikaciju"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="auth-heading">
          <span className="auth-kicker">Balkan Estate</span>
          <h2 id={titleId}>{isSignUp ? 'Kreiraj nalog' : 'Dobrodosli nazad'}</h2>
          <p id={descriptionId}>
            {isSignUp
              ? 'Unesite podatke i odmah povezite nalog sa platformom.'
              : 'Prijavite se email adresom i lozinkom.'}
          </p>
        </div>

        {banner && isSignUp && (
          <div className="auth-offer-banner" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2 3 7v5c0 5.25 3.84 9.74 9 10 5.16-.26 9-4.75 9-10V7l-9-5Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            {banner}
          </div>
        )}

        <div className="auth-mode-switch" role="tablist" aria-label="Izbor autentifikacije">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignUp}
            className={!isSignUp ? 'auth-mode-tab auth-mode-tab-active' : 'auth-mode-tab'}
            onClick={() => switchMode('sign-in')}
          >
            Prijava
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignUp}
            className={isSignUp ? 'auth-mode-tab auth-mode-tab-active' : 'auth-mode-tab'}
            onClick={() => switchMode('sign-up')}
          >
            Registracija
          </button>
        </div>

        <form
          className={isSignUp ? 'auth-form auth-form-sign-up' : 'auth-form'}
          onSubmit={handleSubmit}
        >
          {isSignUp && (
            <label className="auth-field">
              <span>Puno ime</span>
              <input
                type="text"
                name="fullname"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                placeholder="Petar Petrovic"
                disabled={loading}
                required
              />
            </label>
          )}

          {isSignUp && (
            <label className="auth-field">
              <span>Grad</span>
              <input
                type="text"
                name="city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                autoComplete="address-level2"
                placeholder="Beograd"
                disabled={loading}
                required
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="ime@kompanija.com"
              disabled={loading}
              required
            />
          </label>

          <label className="auth-field">
            <span>Lozinka</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              placeholder="Najmanje 6 karaktera"
              disabled={loading}
              minLength={6}
              required
            />
          </label>

          {error && (
            <p className="auth-feedback auth-feedback-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="auth-feedback auth-feedback-success" role="status">
              {message}
            </p>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? 'Obrada...' : isSignUp ? 'Kreiraj nalog' : 'Prijavi se'}
          </button>
        </form>
      </div>
    </dialog>
  )
}
