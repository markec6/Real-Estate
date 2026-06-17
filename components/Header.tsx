'use client'

import { useState, useEffect } from 'react'

export default function Header() {
  const [dark, setDark] = useState(false)

  /* Sync React state with whatever the inline theme script already set on <html> */
  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'))
  }, [])

  function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark')
    setDark(isDark)
    try { localStorage.setItem('brei-theme', isDark ? 'dark' : 'light') } catch (_) {}
  }

  return (
    <header className="site-header">
      <a href="#" className="logo">
        <div className="logo-icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 21h18M3 18h18M6 18V9M10 18V9M14 18V9M18 18V9M4 9h16M12 3l8 6H4l8-6z"/>
          </svg>
        </div>
        <div className="logo-text">
          <span className="logo-primary">Balkan Real Estate</span>
          <span className="logo-secondary">Intelligence Platform</span>
        </div>
      </a>

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
    </header>
  )
}
