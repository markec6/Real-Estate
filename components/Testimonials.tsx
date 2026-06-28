/* Pure Server Component — hover lift is CSS-driven (no 'use client' needed) */

interface Testimonial {
  id: string
  name: string
  title: string
  region: string
  quote: string
  initials: string
  featured?: boolean
}

const testimonials: Testimonial[] = [
  {
    id: 'nikola',
    name: 'Nikola Stanković',
    title: 'Premium Agent',
    region: 'Beograd',
    initials: 'NS',
    quote:
      'Ranije sam trošio po 3 sata dnevno vrteći HaloOglase i ručno upoređivao da li je oglas agencijski ili je pravi vlasnik. Sa ovim alatom dobijem Viber obaveštenje čim se pojavi izvorni oglas. Bukvalno hvatam ekskluzive pre nego što drugi uopšte popiju kafu.',
  },
  {
    id: 'marko',
    name: 'Marko Horvat',
    title: 'Vlasnik Agencije',
    region: 'Novi Sad',
    initials: 'MH',
    featured: true,
    quote:
      'Uveo sam ovaj sistem za ceo svoj tim od 8 agenata. Najjača stvar je timski panel gde odmah vidimo ako je neko od kolega već zabeležio ili pozvao vlasnika, tako da ne dupliramo pozive i ne nerviramo ljude na terenu. Produktivnost nam je skočila za preko 40% u prvih mesec dana korišćenja.',
  },
  {
    id: 'amra',
    name: 'Amra Hadžić',
    title: 'Ekskluzivni Posrednik',
    region: 'Sarajevo',
    initials: 'AH',
    quote:
      'Istorija promena cena mi je omiljena opcija! Kada pozovem vlasnika i vidim da je tri puta spuštao cenu na različitim portalima, imam savršenu pregovaračku moć da ga ubedim na ekskluzivan ugovor po realnoj ceni.',
  },
  {
    id: 'luka',
    name: 'Luka Radović',
    title: 'Top Producer',
    region: 'Podgorica',
    initials: 'LR',
    quote:
      'Bio sam skeptičan jer na Balkanu softveri često baguju, ali probali smo onih 7 dana besplatno bez kartice i uverili se. Sistem radi bez greške, skeniranje je instantno.',
  },
]

function StarRating() {
  return (
    <div className="testi-stars" aria-label="Ocena: 5 od 5 zvezdica">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="testi-star" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.77l-4.94 2.94.94-5.5-4-3.9 5.53-.8L10 1.5z" />
        </svg>
      ))}
    </div>
  )
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <article
      className={`testi-card${t.featured ? ' testi-card-feature' : ''}`}
      aria-labelledby={`testi-name-${t.id}`}
    >
      <div className="testi-card-top">
        <div className="testi-author-row">
          <div className="testi-avatar" aria-hidden="true">
            {t.initials}
          </div>
          <div className="testi-author-meta">
            <p className="testi-name" id={`testi-name-${t.id}`}>
              {t.name}
            </p>
            <p className="testi-title">{t.title}</p>
          </div>
        </div>
        <span className="testi-region">{t.region}</span>
      </div>

      <StarRating />

      <blockquote className="testi-quote">
        <p>&ldquo;{t.quote}&rdquo;</p>
      </blockquote>
    </article>
  )
}

export default function Testimonials() {
  return (
    <section className="testi-section" aria-labelledby="testi-heading">
      {/* Section header */}
      <div className="testi-header">
        <div className="s2-badge">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Reč Agenta
        </div>

        <h2 className="hiw-h2" id="testi-heading">
          Šta kažu lideri na tržištu{' '}
          <span style={{ color: 'var(--accent)' }}>nekretnina?</span>
        </h2>

        <p className="testi-subtitle">
          Saznajte kako su top agenti iz regiona automatizovali potragu za vlasnicima
          i duplirali broj ekskluzivnih ugovora.
        </p>
      </div>

      {/* Bento grid */}
      <div className="testi-container">
        <div className="testi-grid">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} t={t} />
          ))}
        </div>
      </div>
    </section>
  )
}
