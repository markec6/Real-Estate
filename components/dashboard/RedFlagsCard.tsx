import { NIJE_DEO_ANALIZE } from '@/lib/dashboard/analysisDetailTypes'
import type { RedFlagsDetail } from '@/lib/dashboard/analysisDetailTypes'

type RedFlagsCardProps = {
  redFlags: RedFlagsDetail
}

export default function RedFlagsCard({ redFlags }: RedFlagsCardProps) {
  const hasFlags = redFlags.flags.length > 0
  const hasChecks = redFlags.recommendedChecks.length > 0

  return (
    <section className="analysis-card dashboard-glass" aria-labelledby="redflags-card-title">
      <h2 id="redflags-card-title" className="detail-card-title">
        Rizici &amp; Crvene Zastavice
      </h2>

      <div className="analysis-card-body">
        <div className="analysis-block">
          <h3 className="analysis-block-title">Crvene zastavice</h3>
          {hasFlags ? (
            <ul className="flag-list">
              {redFlags.flags.map((flag) => (
                <li
                  key={flag.text}
                  className={
                    flag.severity === 'red' ? 'flag-item flag-item-red' : 'flag-item flag-item-amber'
                  }
                >
                  <span className="flag-marker" aria-hidden="true" />
                  <span className="flag-text">{flag.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
          )}
        </div>

        <div className="analysis-block">
          <h3 className="analysis-block-title">Preporučene provere</h3>
          {hasChecks ? (
            <ul className="analysis-list">
              {redFlags.recommendedChecks.map((check) => (
                <li key={check}>{check}</li>
              ))}
            </ul>
          ) : (
            <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
          )}
        </div>
      </div>
    </section>
  )
}
