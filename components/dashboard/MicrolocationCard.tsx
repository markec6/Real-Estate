import { NIJE_DEO_ANALIZE } from '@/lib/dashboard/analysisDetailTypes'
import type { MicrolocationDetail } from '@/lib/dashboard/analysisDetailTypes'

type MicrolocationCardProps = {
  microlocation: MicrolocationDetail
}

const ROWS: Array<{
  key: keyof Pick<MicrolocationDetail, 'transport' | 'schools' | 'parking' | 'noise'>
  label: string
}> = [
  { key: 'transport', label: 'Transport' },
  { key: 'schools', label: 'Škole' },
  { key: 'parking', label: 'Parking zona' },
  { key: 'noise', label: 'Nivo buke' },
]

export default function MicrolocationCard({ microlocation }: MicrolocationCardProps) {
  return (
    <section
      className="analysis-card dashboard-glass"
      aria-labelledby="microlocation-card-title"
    >
      <h2 id="microlocation-card-title" className="detail-card-title">
        Mikrolokacija &amp; Infrastruktura
      </h2>

      {!microlocation.hasAny ? (
        <p className="detail-empty-state">{NIJE_DEO_ANALIZE}</p>
      ) : (
        <ul className="micro-list">
          {ROWS.map((row) => {
            const value = microlocation[row.key]
            return (
              <li key={row.key} className="micro-row">
                <span className="micro-label">{row.label}</span>
                <span className="micro-value">
                  {value || NIJE_DEO_ANALIZE}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
