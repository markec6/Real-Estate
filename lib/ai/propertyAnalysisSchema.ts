import { z } from 'zod/v4'

const MAX_TITLE_LENGTH = 240
const MAX_LOCATION_LENGTH = 180
const MAX_DESCRIPTION_LENGTH = 6000
const MAX_FEATURE_LENGTH = 160
const MAX_FEATURES = 40

function cleanText(value: unknown, fallback = '', maxLength?: number) {
  if (value === null || value === undefined) return fallback

  const cleaned = String(value).replace(/\s+/g, ' ').trim()
  const resolved = cleaned || fallback

  return maxLength ? resolved.slice(0, maxLength) : resolved
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function firstDefined(
  record: Record<string, unknown>,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) {
      return record[key]
    }
  }

  return undefined
}

function parseLocaleNumber(value: unknown, fallback = Number.NaN) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }

  if (typeof value !== 'string') return fallback

  const compact = value
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d.,+-]/g, '')

  if (!compact) return fallback

  const lastComma = compact.lastIndexOf(',')
  const lastDot = compact.lastIndexOf('.')
  const decimalSeparator =
    lastComma > -1 && lastDot > -1
      ? lastComma > lastDot
        ? ','
        : '.'
      : lastComma > -1
        ? ','
        : lastDot > -1
          ? '.'
          : null

  if (!decimalSeparator) {
    const parsed = Number(compact)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  const separatorIndex = compact.lastIndexOf(decimalSeparator)
  const fractionalDigits = compact.length - separatorIndex - 1
  const looksLikeThousandsSeparator =
    fractionalDigits === 3 &&
    compact.slice(0, separatorIndex).replace(/[^\d]/g, '').length >= 1

  if (looksLikeThousandsSeparator && (compact.match(/[.,]/g)?.length ?? 0) === 1) {
    return Number(compact.replace(/[.,]/g, ''))
  }

  const normalized =
    decimalSeparator === ','
      ? compact.replace(/\./g, '').replace(',', '.')
      : compact.replace(/,/g, '')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseNumberWithFallback(value: unknown, fallback: number) {
  const parsed = parseLocaleNumber(value, fallback)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeFeatures(...values: unknown[]): string[] {
  const tags: string[] = values.flatMap((value): string[] => {
    if (value === null || value === undefined) return []

    if (Array.isArray(value)) {
      return value.flatMap((entry) => normalizeFeatures(entry))
    }

    return String(value)
      .split(/[,;\n|•]+/g)
      .map((entry) => cleanText(entry, '', MAX_FEATURE_LENGTH))
      .filter(Boolean)
  })

  return Array.from(new Set(tags)).slice(0, MAX_FEATURES)
}

function normalizeUrl(value: unknown) {
  const fallback = 'https://halooglasi.com'
  const cleaned = cleanText(value, fallback)

  try {
    const url = new URL(cleaned)
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? url.toString()
      : fallback
  } catch {
    return fallback
  }
}

function priceLooksLikePerM2(value: unknown) {
  return typeof value === 'string' && /(?:\/\s*m[²2]|po\s*m[²2]|m[²2])/i.test(value)
}

function normalizeFlexibleMetric(value: unknown) {
  const cleaned = cleanText(value)
  if (!cleaned) return ''

  const parsed = parseLocaleNumber(cleaned)
  return Number.isFinite(parsed) && /\d/.test(cleaned) ? String(parsed) : cleaned
}

function normalizeMonthlyExpenses(value: unknown) {
  const cleaned = cleanText(value)
  if (!cleaned) return ''

  const parsed = parseLocaleNumber(cleaned)
  return Number.isFinite(parsed) ? parsed : cleaned
}

function normalizePropertyPayload(value: unknown) {
  const record = toRecord(value)
  const areaRaw = firstDefined(record, [
    'm2',
    'area_m2',
    'area_sqm',
    'kvadratura',
    'povrsina',
    'površina',
  ])
  const m2 = Math.max(parseNumberWithFallback(areaRaw, 1), 1)

  const priceRaw = firstDefined(record, [
    'price',
    'cena',
    'total_price',
    'price_eur',
    'price_at_scan',
  ])
  const pricePerM2Raw = firstDefined(record, [
    'price_per_m2',
    'price_per_sqm',
    'cena_po_m2',
    'cena_po_kvadratu',
  ])
  const derivedPricePerM2 = priceLooksLikePerM2(priceRaw)
    ? parseNumberWithFallback(priceRaw, 0)
    : parseNumberWithFallback(pricePerM2Raw, 0)
  const parsedPrice = priceLooksLikePerM2(priceRaw)
    ? 0
    : parseNumberWithFallback(priceRaw, 0)

  return {
    title: firstDefined(record, ['title', 'naslov']),
    price:
      parsedPrice > 0
        ? parsedPrice
        : derivedPricePerM2 > 0
          ? derivedPricePerM2 * m2
          : 0,
    location: firstDefined(record, [
      'location',
      'lokacija',
      'location_name',
      'municipality',
      'opstina',
      'opština',
      'city',
      'grad',
    ]),
    m2,
    description: firstDefined(record, ['description', 'opis']),
    features: normalizeFeatures(
      record.features,
      record.tags,
      record.karakteristike,
      record.oprema,
      record.dodatno,
    ),
    portal_url: firstDefined(record, [
      'portal_url',
      'listing_url',
      'url',
      'href',
      'link',
    ]),
    rooms: firstDefined(record, ['rooms', 'broj_soba', 'sobe']),
    floor: firstDefined(record, ['floor', 'sprat', 'spratnost']),
    total_floors: firstDefined(record, [
      'total_floors',
      'ukupna_spratnost',
      'ukupno_spratova',
    ]),
    heating: firstDefined(record, ['heating', 'grejanje']),
    property_type: firstDefined(record, [
      'property_type',
      'tip_nekretnine',
      'tip',
    ]),
    building_state: firstDefined(record, [
      'building_state',
      'stanje_objekta',
      'stanje',
    ]),
    advertiser_type: firstDefined(record, [
      'advertiser_type',
      'oglasivac',
      'oglašivač',
      'seller_type',
    ]),
    monthly_expenses: firstDefined(record, [
      'monthly_expenses',
      'mesecne_rezije',
      'mesečne_režije',
      'mesečne režije',
      'rezije',
      'režije',
    ]),
    phone: firstDefined(record, [
      'phone',
      'phone_number',
      'telefon',
      'broj_telefona',
      'contact_phone',
    ]),
    owner_name: firstDefined(record, [
      'owner_name',
      'ime_vlasnika',
      'vlasnik',
      'owner',
    ]),
    agency_name: firstDefined(record, [
      'agency_name',
      'agencija',
      'agency',
      'naziv_agencije',
    ]),
  }
}

const NumberFromInput = (fallback: number, minValue: number) =>
  z
    .preprocess(
      (value) => Math.max(parseNumberWithFallback(value, fallback), minValue),
      z.number().finite().min(minValue),
    )
    .catch(fallback)

const CleanStringFromInput = (fallback: string, max: number) =>
  z
    .preprocess(
      (value) => cleanText(value, fallback, max),
      z.string().max(max),
    )
    .catch(fallback)

const FeaturesFromInput = z
  .preprocess(
    (value) => normalizeFeatures(value),
    z.array(z.string().trim().min(1).max(MAX_FEATURE_LENGTH)).max(MAX_FEATURES),
  )
  .catch([])

const UrlFromInput = z.preprocess(
  normalizeUrl,
  z.string().url(),
).catch('https://halooglasi.com')

const FlexibleMetricFromInput = z
  .preprocess(normalizeFlexibleMetric, z.string().max(120))
  .catch('')

const MonthlyExpensesFromInput = z
  .preprocess(
    normalizeMonthlyExpenses,
    z.union([z.number().finite().nonnegative(), z.string().max(120)]),
  )
  .catch('')

const NonEmptyTrimmedString = (max: number) =>
  z.string().trim().min(1).max(max)

export const PropertyScanRequestSchema = z
  .preprocess(
    normalizePropertyPayload,
    z.object({
      title: CleanStringFromInput('Nekretnina na oglasu', MAX_TITLE_LENGTH),
      price: NumberFromInput(0, 0),
      location: CleanStringFromInput('Nepoznata lokacija', MAX_LOCATION_LENGTH),
      m2: NumberFromInput(1, 1),
      description: CleanStringFromInput('', MAX_DESCRIPTION_LENGTH),
      features: FeaturesFromInput,
      portal_url: UrlFromInput,
      rooms: FlexibleMetricFromInput,
      floor: CleanStringFromInput('', 120),
      total_floors: FlexibleMetricFromInput,
      heating: CleanStringFromInput('', 120),
      property_type: CleanStringFromInput('', 120),
      building_state: CleanStringFromInput('', 160),
      advertiser_type: CleanStringFromInput('', 120),
      monthly_expenses: MonthlyExpensesFromInput,
      phone: CleanStringFromInput('', 120),
      owner_name: CleanStringFromInput('', 160),
      agency_name: CleanStringFromInput('', 160),
    }),
  )

export type PropertyScanRequest = z.infer<typeof PropertyScanRequestSchema>

export const MarketAssessmentSchema = z.enum(['Overpriced', 'Fair', 'Bargain'])

export const PropertyAnalysisSchema = z
  .object({
    summary: NonEmptyTrimmedString(600),
    valuation: z
      .object({
        market_assessment: MarketAssessmentSchema,
        estimated_deviation_pct: z.number().finite().min(-100).max(100),
        price_per_m2: z.number().finite().nonnegative(),
        analysis_reasoning: NonEmptyTrimmedString(1200),
      })
      .strict(),
    costs_breakdown: z
      .object({
        utilities_assessment: NonEmptyTrimmedString(1000),
        estimated_monthly_utilities_eur: z.number().finite().nonnegative().nullable(),
        renovation_assessment: NonEmptyTrimmedString(1000),
        estimated_renovation_cost_eur: z.number().finite().nonnegative().nullable(),
        upkeep_notes: z.array(NonEmptyTrimmedString(240)).min(1).max(8),
      })
      .strict(),
    legal_and_technical_checks: z
      .object({
        registration_status: NonEmptyTrimmedString(500),
        heating: NonEmptyTrimmedString(500),
        building_age: NonEmptyTrimmedString(500),
        red_flags: z.array(NonEmptyTrimmedString(300)).max(8),
        recommended_checks: z.array(NonEmptyTrimmedString(300)).min(1).max(8),
      })
      .strict(),
    negotiation_strategy: z
      .object({
        target_discount_pct: z.number().finite().min(0).max(15),
        leverage_points: z.array(NonEmptyTrimmedString(300)).min(1).max(6),
        script_lines: z.array(NonEmptyTrimmedString(400)).min(3).max(4),
      })
      .strict(),
    dynamic_faq: z
      .array(
        z
          .object({
            question: NonEmptyTrimmedString(260),
            answer: NonEmptyTrimmedString(800),
          })
          .strict(),
      )
      .min(3)
      .max(5),
  })
  .strict()

export type PropertyAnalysis = z.infer<typeof PropertyAnalysisSchema>
