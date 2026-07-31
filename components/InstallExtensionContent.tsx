'use client'

import { useId, useState } from 'react'

const EXTENSIONS_URL = 'chrome://extensions'
/** Served from `public/extension.zip` at the site root */
const EXTENSION_ZIP_URL = '/extension.zip'

type CopyState = 'idle' | 'copied' | 'error'

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function ChromeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 2h8.66" />
      <path d="M4.2 6.1 8.5 13.5" />
      <path d="M19.8 17.9h-8.6" />
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5.05 3.42 9.74 8 11 4.58-1.26 8-5.95 8-11V5l-8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z" />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2.5h6.5A2.5 2.5 0 0 1 21 10v6.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
    </svg>
  )
}

const steps = [
  {
    title: 'Korak 1',
    text: (
      <>
        Preuzmite <code>.zip</code> fajl iznad i otpakujte (unzip) folder na vašem računaru.
      </>
    ),
  },
  {
    title: 'Korak 2',
    text: (
      <>
        Otvorite novi tab u Chrome pretraživaču, ukucajte <code>{EXTENSIONS_URL}</code> i uključite{' '}
        <strong>Developer mode</strong> (Razvojni režim) gore desno.
      </>
    ),
  },
  {
    title: 'Korak 3',
    text: (
      <>
        Kliknite na <strong>Load unpacked</strong> (Učitaj otpakovano), izaberite otpakovani folder i
        započnite skeniranje!
      </>
    ),
  },
]

export default function InstallExtensionContent() {
  const feedbackId = useId()
  const [copyState, setCopyState] = useState<CopyState>('idle')

  async function copyExtensionsUrl() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(EXTENSIONS_URL)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = EXTENSIONS_URL
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2200)
    } catch {
      setCopyState('error')
    }
  }

  const copyFeedback =
    copyState === 'copied'
      ? 'Kopirano. Nalepite adresu u novi Chrome tab.'
      : copyState === 'error'
        ? 'Kopiranje nije uspelo. Označite tekst i kopirajte ga ručno.'
        : 'Jedan klik kopira Chrome adresu za instalaciju.'

  return (
    <section className="install-grid-surface relative overflow-hidden px-6 pb-20 pt-28 sm:px-8 lg:px-16 lg:pb-28 lg:pt-36">
      <div className="relative z-[1] mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-700 shadow-sm shadow-orange-500/10 dark:border-orange-400/20 dark:bg-orange-400/10 dark:text-orange-200">
            <span aria-hidden="true">⚡</span>
            Brza Aktivacija Ekstenzije
          </div>

          <div className="mt-8 max-w-3xl">
            <h1 className="text-4xl font-black tracking-[-0.06em] text-stone-950 sm:text-5xl lg:text-6xl dark:text-stone-50">
              Instalirajte Ekstenziju i Započnite Skeniranje u 3 Brza Koraka
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600 sm:text-xl dark:text-stone-300">
              Preuzmite paket, učitajte ga u vaš Chrome pretraživač i odmah iskoristite vaših 5
              besplatnih kredita.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              className="inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-4 text-base font-extrabold text-white shadow-2xl shadow-orange-500/25 transition hover:-translate-y-0.5 hover:from-orange-500 hover:to-orange-700 hover:shadow-orange-500/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-500"
              href={EXTENSION_ZIP_URL}
              download="extension.zip"
            >
              <span className="install-icon">
                <DownloadIcon />
              </span>
              Preuzmi Ekstenziju (.zip)
            </a>
            <div className="inline-flex items-center gap-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.8)]" />
              Chrome Developer Mode instalacija
            </div>
          </div>

          <div className="mt-6 max-w-2xl rounded-2xl border border-stone-200/80 bg-white/70 p-3 shadow-xl shadow-stone-950/5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/60 dark:shadow-black/20">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="sr-only" htmlFor="chrome-extension-url">
                Chrome ekstenzije URL
              </label>
              <input
                id="chrome-extension-url"
                className="min-h-12 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 font-mono text-sm font-semibold text-stone-800 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                value={EXTENSIONS_URL}
                readOnly
              />
              <button
                type="button"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 px-4 text-sm font-bold text-orange-700 transition hover:bg-orange-500/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 dark:border-orange-400/25 dark:text-orange-200"
                onClick={copyExtensionsUrl}
                aria-describedby={feedbackId}
              >
                <span className="install-icon-sm">
                  {copyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
                </span>
                {copyState === 'copied' ? 'Kopirano' : 'Kopiraj'}
              </button>
            </div>
            <p
              id={feedbackId}
              className="mt-3 text-sm font-medium text-stone-500 dark:text-stone-400"
              aria-live="polite"
            >
              {copyFeedback}
            </p>
          </div>

          <div className="mt-8 max-w-3xl rounded-2xl border border-stone-200/80 bg-white/75 p-5 shadow-2xl shadow-stone-950/5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/65 dark:shadow-black/20">
            <div className="flex items-center gap-3">
              <span className="install-card-icon">
                <ChromeIcon />
              </span>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-orange-600 dark:text-orange-300">
                  Vodič za instalaciju
                </p>
                <h2 className="text-xl font-extrabold tracking-[-0.04em] text-stone-950 dark:text-stone-50">
                  Aktivirajte ekstenziju bez Chrome Web Store-a
                </h2>
              </div>
            </div>

            <ol className="mt-6 grid gap-4">
              {steps.map((step, index) => (
                <li key={step.title} className="grid gap-4 rounded-2xl border border-stone-200/70 bg-stone-50/70 p-4 sm:grid-cols-[auto_1fr] dark:border-zinc-800 dark:bg-zinc-900/55">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-sm font-black text-white shadow-lg shadow-orange-500/25">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-extrabold text-stone-950 dark:text-stone-50">{step.title}</h3>
                    <p className="mt-1 leading-7 text-stone-600 dark:text-stone-300">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="install-float-slow relative mx-auto max-w-xl rounded-[2rem] border border-stone-200 bg-white/70 p-3 shadow-2xl shadow-orange-500/10 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
            <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 shadow-inner dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-2 border-b border-stone-200 px-4 py-3 dark:border-zinc-800">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                  <span className="install-icon-sm">
                    <ShieldIcon />
                  </span>
                  <span className="truncate">nekretnine.rs/prodaja-stanova</span>
                </div>
              </div>

              <div className="relative overflow-hidden rounded-b-[1.5rem] p-5">
                <div className="absolute right-6 top-6 z-20 install-pulse-soft rounded-full border border-orange-400/30 bg-orange-500 px-3 py-1 text-xs font-black text-white shadow-xl shadow-orange-500/30">
                  5 Kredita
                </div>

                <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-xl shadow-stone-950/5 dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-black/20">
                  <div className="h-36 rounded-xl bg-gradient-to-br from-stone-200 via-stone-100 to-orange-100 dark:from-zinc-800 dark:via-zinc-900 dark:to-orange-950/40" />
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-extrabold text-stone-950 dark:text-stone-50">
                        HaloOglasi · Dvosoban stan
                      </p>
                      <p className="mt-1 text-xs font-semibold text-stone-500 dark:text-zinc-400">
                        Vračar, Beograd · 54m2 · Direktan kontakt
                      </p>
                    </div>
                    <strong className="text-sm text-stone-950 dark:text-stone-50">120.000 EUR</strong>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-center text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      Bez duplikata
                    </span>
                    <span className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-2 py-2 text-center text-[11px] font-bold text-orange-700 dark:text-orange-300">
                      Cena -8%
                    </span>
                    <span className="rounded-xl border border-zinc-300 bg-zinc-100 px-2 py-2 text-center text-[11px] font-bold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      AI score 8.7
                    </span>
                  </div>
                </article>

                <div className="relative z-10 -mt-6 ml-auto w-[88%] rounded-2xl border border-orange-400/25 bg-zinc-950 p-4 text-white shadow-2xl shadow-orange-500/20">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="install-icon grid h-10 w-10 place-items-center rounded-xl bg-orange-500 shadow-lg shadow-orange-500/30">
                        <SparkIcon />
                      </span>
                      <div>
                        <p className="text-sm font-extrabold">Balkan Estate AI</p>
                        <p className="text-xs font-semibold text-zinc-400">Ekstenzija aktivna</p>
                      </div>
                    </div>
                    <span className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
                      Aktivan i skenira
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between text-xs font-bold text-zinc-400">
                        <span>Analiza oglasa</span>
                        <span>92%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-[92%] rounded-full bg-gradient-to-r from-orange-500 to-amber-400 shadow-[0_0_18px_rgba(249,115,22,0.55)]" />
                      </div>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                      <span className="install-icon text-orange-300">
                        <FolderIcon />
                      </span>
                      <p className="text-xs font-semibold leading-5 text-zinc-300">
                        Pronađen direktan kontakt i upoređena cena po m2 sa sličnim oglasima.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
