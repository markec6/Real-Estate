import { NIJE_DEO_ANALIZE } from '@/lib/dashboard/analysisDetailTypes'
import type { FinancesDetail } from '@/lib/dashboard/analysisDetailTypes'
import { formatEuro, formatEuroPerSqm } from '@/lib/dashboard/parseListingDisplay'

type FinancesCardProps = {
  finances: FinancesDetail
}

function formatDeviation(pct: number | null): string | null {
  if (pct === null) return null
  const formatted = new Intl.NumberFormat('sr-RS', {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(pct)
  return `${formatted}%`
}

export default function FinancesCard({ finances }: FinancesCardProps) {
  const hasValuation = Boolean(
    finances.marketAssessment ||
      finances.deviationPct !== null ||
      finances.reasoning ||
      finances.pricePerSqm !== null,
  )
  const hasCosts = Boolean(
    finances.utilitiesAssessment ||
      finances.monthlyUtilitiesEur !== null ||
      finances.renovationAssessment ||
      finances.renovationCostEur !== null ||
      finances.upkeepNotes.length > 0,
  )
  const hasItemized = finances.renovationItems.length > 0
  const hasYield =
    finances.monthlyRentEur !== null ||
    finances.annualRoiPct !== null ||
    Boolean(finances.yieldNote)

  return (
    <section className="analysis-card dashboard-glass" aria-labelledby="finances-card-title">
      <h2 id="finances-card-title" className="detail-card-title">
        Finansije &amp; Adaptacija
      </h2>

      <div className="analysis-card-body">
        <div className="analysis-block">
          <h3 className="analysis-block-title">Procena vrednosti</h3>
          {hasValuation ? (
            <div className="analysis-stack">
              {finances.marketAssessment ? (
                <p className="analysis-highlight">{finances.marketAssessment}</p>
              ) : null}
              {finances.deviationPct !== null ? (
                <p className="analysis-meta">
                  Odstupanje od tržišta:{' '}
                  <strong>{formatDeviation(finances.deviationPct)}</strong>
                </p>
              ) : null}
              {finances.pricePerSqm !== null ? (
                <p className="analysis-meta">
                  Cena / m²: <strong>{formatEuroPerSqm(finances.pricePerSqm)}</strong>
                </p>
              ) : null}
              {finances.reasoning ? (
                <p className="analysis-prose">{finances.reasoning}</p>
              ) : null}
            </div>
          ) : (
            <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
          )}
        </div>

        <div className="analysis-block">
          <h3 className="analysis-block-title">Troškovi i renoviranje</h3>
          {hasCosts ? (
            <div className="analysis-stack">
              {finances.utilitiesAssessment ? (
                <p className="analysis-prose">{finances.utilitiesAssessment}</p>
              ) : null}
              {finances.monthlyUtilitiesEur !== null ? (
                <p className="analysis-meta">
                  Mesečne režije:{' '}
                  <strong>{formatEuro(finances.monthlyUtilitiesEur)}</strong>
                </p>
              ) : null}
              {finances.renovationAssessment ? (
                <p className="analysis-prose">{finances.renovationAssessment}</p>
              ) : null}
              {finances.renovationCostEur !== null ? (
                <p className="analysis-meta">
                  Procena renoviranja:{' '}
                  <strong>{formatEuro(finances.renovationCostEur)}</strong>
                </p>
              ) : null}
              {finances.upkeepNotes.length > 0 ? (
                <ul className="analysis-list">
                  {finances.upkeepNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
          )}
        </div>

        <div className="analysis-block">
          <h3 className="analysis-block-title">Stavke renoviranja</h3>
          {hasItemized ? (
            <ul className="renovation-list">
              {finances.renovationItems.map((item) => (
                <li key={`${item.label}-${item.amountEur ?? 'x'}`} className="renovation-item">
                  <div>
                    <p className="renovation-item-label">{item.label}</p>
                    {item.note ? (
                      <p className="renovation-item-note">{item.note}</p>
                    ) : null}
                  </div>
                  <span className="renovation-item-amount">
                    {item.amountEur !== null ? formatEuro(item.amountEur) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
          )}
        </div>

        <div className="analysis-block">
          <h3 className="analysis-block-title">Prinos od izdavanja</h3>
          {hasYield ? (
            <div className="analysis-stack">
              {finances.monthlyRentEur !== null ? (
                <p className="analysis-meta">
                  Procenjena kirija:{' '}
                  <strong>{formatEuro(finances.monthlyRentEur)} / mesec</strong>
                </p>
              ) : null}
              {finances.annualRoiPct !== null ? (
                <p className="analysis-meta">
                  Godišnji ROI:{' '}
                  <strong>
                    {new Intl.NumberFormat('sr-RS', {
                      maximumFractionDigits: 1,
                    }).format(finances.annualRoiPct)}
                    %
                  </strong>
                </p>
              ) : null}
              {finances.yieldNote ? (
                <p className="analysis-prose">{finances.yieldNote}</p>
              ) : null}
            </div>
          ) : (
            <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
          )}
        </div>
      </div>
    </section>
  )
}
