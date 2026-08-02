'use client'

type AuthGateProps = {
  onSignIn: () => void
}

export default function AuthGate({ onSignIn }: AuthGateProps) {
  return (
    <div className="dashboard-state dashboard-glass">
      <h2>Prijavite se za Dashboard</h2>
      <p>
        Sačuvane nekretnine i AI analize dostupne su samo ulogovanim korisnicima.
      </p>
      <button type="button" className="dashboard-cta" onClick={onSignIn}>
        Prijava
      </button>
    </div>
  )
}
