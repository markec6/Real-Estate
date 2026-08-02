export const NIJE_DEO_ANALIZE = 'Nije deo sačuvane analize'

export type QuickSpecs = {
  totalPriceLabel: string
  sizeLabel: string
  pricePerSqmLabel: string
  floorLabel: string
  registrationLabel: string
}

export type DetailContact = {
  displayName: string
  badgeLabel: 'Agencija' | 'Fizičko lice'
  phoneNumber: string
  telHref: string | null
  email: string
  mailtoHref: string | null
}

export type RenovationItem = {
  label: string
  amountEur: number | null
  note: string
}

export type FinancesDetail = {
  marketAssessment: string | null
  deviationPct: number | null
  pricePerSqm: number | null
  reasoning: string | null
  utilitiesAssessment: string | null
  monthlyUtilitiesEur: number | null
  renovationAssessment: string | null
  renovationCostEur: number | null
  upkeepNotes: string[]
  renovationItems: RenovationItem[]
  monthlyRentEur: number | null
  annualRoiPct: number | null
  yieldNote: string | null
}

export type RedFlagItem = {
  text: string
  severity: 'red' | 'amber'
}

export type RedFlagsDetail = {
  flags: RedFlagItem[]
  recommendedChecks: string[]
}

export type NegotiationDetail = {
  targetDiscountPct: number | null
  targetOfferEur: number | null
  leveragePoints: string[]
  scriptLines: string[]
}

export type MicrolocationDetail = {
  transport: string | null
  schools: string | null
  parking: string | null
  noise: string | null
  hasAny: boolean
}

export type FaqDetailItem = {
  question: string
  answer: string
}

export type AnalysisDetailViewModel = {
  title: string
  portalUrl: string
  locationLabel: string
  quickSpecs: QuickSpecs
  contact: DetailContact | null
  finances: FinancesDetail
  redFlags: RedFlagsDetail
  negotiation: NegotiationDetail
  microlocation: MicrolocationDetail
  faqs: FaqDetailItem[]
  hasAiAnalysis: boolean
}
