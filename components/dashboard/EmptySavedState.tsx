import Link from 'next/link'

export default function EmptySavedState() {
  return (
    <div className="dashboard-state dashboard-glass">
      <h2>Nemate sačuvanih oglasa</h2>
      <p>
        Skenirajte oglas Chrome ekstenzijom i sačuvajte ga u Dashboard da biste ovde
        pratili cenu, lokaciju i AI analizu.
      </p>
      <Link href="/install-extension" className="dashboard-cta">
        Instaliraj ekstenziju
      </Link>
    </div>
  )
}
