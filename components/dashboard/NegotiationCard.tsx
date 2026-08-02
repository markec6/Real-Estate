import { NIJE_DEO_ANALIZE } from '@/lib/dashboard/analysisDetailTypes'
import type { NegotiationDetail } from '@/lib/dashboard/analysisDetailTypes'
import { formatEuro } from '@/lib/dashboard/parseListingDisplay'

type NegotiationCardProps = {
  negotiation: NegotiationDetail
}

export default function NegotiationCard({ negotiation }: NegotiationCardProps) {
  const hasLeverage = negotiation.leveragePoints.length > 0
  const hasScripts = negotiation.scriptLines.length > 0
  const hasTarget =
    negotiation.targetDiscountPct !== null || negotiation.targetOfferEur !== null
  const hasAny = hasLeverage || hasScripts || hasTarget

  return (
    <section
      className="analysis-card dashboard-glass"
      aria-labelledby="negotiation-card-title"
    >
      <h2 id="negotiation-card-title" className="detail-card-title">
        Vodič za Pregovaranje
      </h2>

      {!hasAny ? (
        <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
      ) : (
        <div className="analysis-card-body">
          {hasTarget ? (
            <div className="analysis-block">
              <h3 className="analysis-block-title">Ciljana ponuda</h3>
              <div className="analysis-stack">
                {negotiation.targetDiscountPct !== null ? (
                  <p className="analysis-meta">
                    Ciljani popust:{' '}
                    <strong>
                      {new Intl.NumberFormat('sr-RS', {
                        maximumFractionDigits: 1,
                      }).format(negotiation.targetDiscountPct)}
                      %
                    </strong>
                  </p>
                ) : null}
                {negotiation.targetOfferEur !== null ? (
                  <p className="analysis-highlight">
                    Preporučena ponuda: {formatEuro(negotiation.targetOfferEur)}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="analysis-block">
            <h3 className="analysis-block-title">Poluge za pregovaranje</h3>
            {hasLeverage ? (
              <ol className="leverage-list">
                {negotiation.leveragePoints.map((point, index) => (
                  <li key={point} className="leverage-item">
                    <span className="leverage-index" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="leverage-text">{point}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
            )}
          </div>

          <div className="analysis-block">
            <h3 className="analysis-block-title">Skripte za razgovor</h3>
            {hasScripts ? (
              <ul className="analysis-list">
                {negotiation.scriptLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
