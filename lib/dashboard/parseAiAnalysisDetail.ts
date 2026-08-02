import type {
  AnalysisDetailViewModel,
  DetailContact,
  FaqDetailItem,
  FinancesDetail,
  MicrolocationDetail,
  NegotiationDetail,
  RedFlagItem,
  RedFlagsDetail,
  RenovationItem,
} from '@/lib/dashboard/analysisDetailTypes'
import {
  formatEuro,
  formatEuroPerSqm,
} from '@/lib/dashboard/parseListingDisplay'
import type { ListingDisplay } from '@/lib/dashboard/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

function firstAvailable(...values: unknown[]): unknown {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && !value.trim()) continue
    return value
  }
  return null
}

function collectStrings(value: unknown): string[] {
  if (!value) return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }
  if (!Array.isArray(value)) return []

  const out: string[] = []
  const seen = new Set<string>()

  for (const item of value) {
    let text = ''
    if (typeof item === 'string') {
      text = item.trim()
    } else if (isRecord(item)) {
      text = asString(
        firstAvailable(item.text, item.label, item.title, item.note, item.description),
      )
    }
    if (!text) continue
    const key = text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(text)
  }

  return out
}

function normalizeRenovationItems(value: unknown): RenovationItem[] {
  if (!value) return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [{ label: trimmed, amountEur: null, note: '' }] : []
  }
  if (!Array.isArray(value)) return []

  const items: RenovationItem[] = []
  for (const entry of value) {
    if (typeof entry === 'string') {
      const label = entry.trim()
      if (label) items.push({ label, amountEur: null, note: '' })
      continue
    }
    if (!isRecord(entry)) continue

    const label = asString(
      firstAvailable(
        entry.label,
        entry.name,
        entry.category,
        entry.stavka,
        entry.title,
        entry.text,
      ),
    )
    const note = asString(
      firstAvailable(entry.note, entry.description, entry.napomena, entry.detail),
    )
    const amountEur = asFiniteNumber(
      firstAvailable(
        entry.amountEur,
        entry.amount_eur,
        entry.cost_eur,
        entry.cost,
        entry.price,
        entry.cena,
        entry.trošak,
        entry.trosak,
      ),
    )

    if (!label && !note && amountEur === null) continue
    items.push({
      label: label || note || 'Stavka renoviranja',
      amountEur,
      note: label && note && note !== label ? note : '',
    })
  }

  return items
}

function flagSeverity(text: string): 'red' | 'amber' {
  const lower = text.toLowerCase()
  if (
    /pravn|uknjiž|uknjiz|teret|hipotek|vlasništ|vlasnist|spor|sud|nelegal|neovla|dokument/.test(
      lower,
    )
  ) {
    return 'red'
  }
  return 'amber'
}

/** Normalize Serbian local numbers to tel:+381… when possible. */
export function buildTelHref(phone: string): string | null {
  const raw = phone.trim()
  if (!raw) return null

  const compact = raw.replace(/[\s\-().]/g, '')
  if (!compact) return null

  if (compact.startsWith('+')) {
    const digits = `+${compact.slice(1).replace(/\D/g, '')}`
    return digits.length > 4 ? `tel:${digits}` : null
  }

  const digitsOnly = compact.replace(/\D/g, '')
  if (!digitsOnly) return null

  if (digitsOnly.startsWith('381')) {
    return `tel:+${digitsOnly}`
  }

  if (digitsOnly.startsWith('0') && digitsOnly.length >= 8) {
    return `tel:+381${digitsOnly.slice(1)}`
  }

  if (digitsOnly.length >= 8) {
    return `tel:+${digitsOnly}`
  }

  return `tel:${compact}`
}

function parseContact(listing: ListingDisplay): DetailContact | null {
  const ai = listing.aiAnalysis
  const nested = isRecord(ai?.contact_details) ? ai.contact_details : null
  const contact = isRecord(ai?.contact) ? ai.contact : null
  const kontakt = isRecord(ai?.kontakt) ? ai.kontakt : null
  const fromListing = listing.contactDetails

  const agencyName = asString(
    firstAvailable(
      fromListing?.agency_name,
      nested?.agency_name,
      contact?.agency_name,
      contact?.agency,
      kontakt?.agencija,
      ai?.agency_name,
    ),
  )
  const ownerName = asString(
    firstAvailable(kontakt?.ime_vlasnika, contact?.owner_name, contact?.name),
  )
  const phoneNumber = asString(
    firstAvailable(
      fromListing?.phone_number,
      nested?.phone_number,
      contact?.phone_number,
      contact?.phone,
      kontakt?.telefon,
      ai?.phone_number,
      ai?.phone,
    ),
  )
  const email = asString(
    firstAvailable(
      fromListing?.contact_email,
      nested?.contact_email,
      contact?.contact_email,
      contact?.email,
      ai?.contact_email,
    ),
  )

  if (!agencyName && !ownerName && !phoneNumber && !email) {
    return null
  }

  const isOwner =
    listing.isOwner ||
    fromListing?.is_owner === true ||
    asBoolean(firstAvailable(nested?.is_owner, contact?.is_owner, ai?.is_owner)) ===
      true

  const displayName =
    (isOwner ? ownerName || agencyName : agencyName || ownerName) ||
    (isOwner ? 'Fizičko lice' : 'Agencija')

  return {
    displayName,
    badgeLabel: isOwner ? 'Fizičko lice' : 'Agencija',
    phoneNumber,
    telHref: buildTelHref(phoneNumber),
    email,
    mailtoHref: email ? `mailto:${email}` : null,
  }
}

function parseFinances(
  ai: Record<string, unknown> | null,
  listing: ListingDisplay,
): FinancesDetail {
  const valuationSr = isRecord(ai?.procena_vrednosti) ? ai.procena_vrednosti : null
  const valuationEn = isRecord(ai?.valuation) ? ai.valuation : null
  const costsSr = isRecord(ai?.troškovi) ? ai.troškovi : null
  const costBreakdown = isRecord(ai?.cost_breakdown) ? ai.cost_breakdown : null
  const costsAlt = isRecord(ai?.costs) ? ai.costs : null
  const financials = isRecord(ai?.financials) ? ai.financials : null
  const rental =
    isRecord(ai?.rental_yield)
      ? ai.rental_yield
      : isRecord(ai?.prinos)
        ? ai.prinos
        : isRecord(financials?.rental_yield)
          ? financials.rental_yield
          : isRecord(costBreakdown?.rental_yield)
            ? costBreakdown.rental_yield
            : null

  const renovationItems = normalizeRenovationItems(
    firstAvailable(
      costBreakdown?.renovation_breakdown,
      costBreakdown?.itemized_renovation,
      costsSr?.stavke_renoviranja,
      costsSr?.razbijanje_renoviranja,
      ai?.renovation_breakdown,
      ai?.itemized_renovation,
    ),
  )

  const monthlyRentEur = asFiniteNumber(
    firstAvailable(
      rental?.monthly_rent_eur,
      rental?.estimated_rent_eur,
      rental?.mesečni_zakup_eur,
      rental?.mesecni_zakup_eur,
      ai?.monthly_rent_eur,
      ai?.estimated_rent_eur,
      financials?.monthly_rent_eur,
      costBreakdown?.monthly_rent_eur,
    ),
  )

  const annualRoiPct = asFiniteNumber(
    firstAvailable(
      rental?.annual_roi_pct,
      rental?.roi_pct,
      rental?.godišnji_prinos_procenat,
      rental?.godisnji_prinos_procenat,
      ai?.annual_roi_pct,
      financials?.annual_roi_pct,
    ),
  )

  const yieldNote = asString(
    firstAvailable(
      rental?.note,
      rental?.napomena,
      rental?.assessment,
      rental?.obrazloženje,
      ai?.rental_yield_note,
    ),
  )

  return {
    marketAssessment: asString(
      firstAvailable(
        valuationSr?.tržišna_procena,
        valuationEn?.market_assessment,
        financials?.market_status,
      ),
    ) || null,
    deviationPct: asFiniteNumber(
      firstAvailable(
        valuationSr?.odstupanje_od_tržišta_procenat,
        valuationEn?.estimated_deviation_pct,
        financials?.price_difference_percentage,
      ),
    ),
    pricePerSqm:
      listing.pricePerSqm ??
      asFiniteNumber(
        firstAvailable(
          valuationSr?.cena_po_m2,
          valuationEn?.price_per_m2,
          valuationEn?.price_per_sqm,
          financials?.price_per_sqm,
        ),
      ),
    reasoning: asString(
      firstAvailable(
        valuationSr?.obrazloženje,
        valuationEn?.analysis_reasoning,
        valuationEn?.reasoning,
      ),
    ) || null,
    utilitiesAssessment: asString(
      firstAvailable(
        costsSr?.procena_režija,
        costBreakdown?.utilities_assessment,
        costsAlt?.utilities_assessment,
      ),
    ) || null,
    monthlyUtilitiesEur: asFiniteNumber(
      firstAvailable(
        costsSr?.mesečne_režije_eur,
        costBreakdown?.estimated_monthly_utilities_eur,
        costsAlt?.estimated_monthly_utilities_eur,
      ),
    ),
    renovationAssessment: asString(
      firstAvailable(
        costsSr?.procena_renoviranja,
        costBreakdown?.renovation_assessment,
        costsAlt?.renovation_assessment,
      ),
    ) || null,
    renovationCostEur: asFiniteNumber(
      firstAvailable(
        costsSr?.trošak_renoviranja_eur,
        costBreakdown?.estimated_renovation_cost_eur,
        costBreakdown?.renovation_cost,
        costsAlt?.estimated_renovation_cost_eur,
      ),
    ),
    upkeepNotes: collectStrings(
      firstAvailable(
        costsSr?.napomene_o_održavanju,
        costBreakdown?.upkeep_notes,
        costsAlt?.upkeep_notes,
      ),
    ),
    renovationItems,
    monthlyRentEur,
    annualRoiPct,
    yieldNote: yieldNote || null,
  }
}

function parseRedFlags(ai: Record<string, unknown> | null): RedFlagsDetail {
  const legalSr = isRecord(ai?.pravne_i_tehničke_provere)
    ? ai.pravne_i_tehničke_provere
    : null
  const legalEn = isRecord(ai?.legal_and_technical_checks)
    ? ai.legal_and_technical_checks
    : null
  const insights = isRecord(ai?.insights) ? ai.insights : null

  const flagTexts = collectStrings(
    firstAvailable(
      legalSr?.crvene_zastavice,
      legalEn?.red_flags,
      ai?.red_flags,
      insights?.risks,
    ),
  )

  const flags: RedFlagItem[] = flagTexts.map((text) => ({
    text,
    severity: flagSeverity(text),
  }))

  const recommendedChecks = collectStrings(
    firstAvailable(
      legalSr?.preporučene_provere,
      legalEn?.recommended_checks,
      ai?.recommended_checks,
    ),
  )

  return { flags, recommendedChecks }
}

function parseNegotiation(
  ai: Record<string, unknown> | null,
  priceEur: number | null,
): NegotiationDetail {
  const negoSr = isRecord(ai?.strategija_pregovaranja)
    ? ai.strategija_pregovaranja
    : null
  const negoEn = isRecord(ai?.negotiation_strategy) ? ai.negotiation_strategy : null

  const targetDiscountPct = asFiniteNumber(
    firstAvailable(
      negoSr?.ciljani_popust_procenat,
      negoEn?.target_discount_pct,
      ai?.target_discount_pct,
    ),
  )

  const leveragePoints = collectStrings(
    firstAvailable(
      negoSr?.argumenti_za_spuštanje_cene,
      negoEn?.leverage_points,
      ai?.leverage_points,
    ),
  )

  const scriptLines = collectStrings(
    firstAvailable(
      negoSr?.skripte_za_pregovor,
      negoEn?.script_lines,
      ai?.script_lines,
    ),
  )

  let targetOfferEur: number | null = null
  if (
    priceEur !== null &&
    targetDiscountPct !== null &&
    targetDiscountPct >= 0 &&
    targetDiscountPct <= 100
  ) {
    targetOfferEur = Math.round(priceEur * (1 - targetDiscountPct / 100))
  }

  return {
    targetDiscountPct,
    targetOfferEur,
    leveragePoints,
    scriptLines,
  }
}

function joinBucket(value: unknown): string | null {
  const parts = collectStrings(value)
  if (parts.length === 0) {
    const single = asString(value)
    return single || null
  }
  return parts.join(' · ')
}

function parseMicrolocation(ai: Record<string, unknown> | null): MicrolocationDetail {
  const micro =
    isRecord(ai?.microlocation)
      ? ai.microlocation
      : isRecord(ai?.mikrolokacija)
        ? ai.mikrolokacija
        : isRecord(ai?.infrastructure)
          ? ai.infrastructure
          : isRecord(ai?.infrastruktura)
            ? ai.infrastruktura
            : null

  const transport = joinBucket(
    firstAvailable(
      micro?.transport,
      micro?.javni_prevoz,
      micro?.transit,
      ai?.transport,
    ),
  )
  const schools = joinBucket(
    firstAvailable(micro?.schools, micro?.škole, micro?.skole, ai?.schools),
  )
  const parking = joinBucket(
    firstAvailable(
      micro?.parking,
      micro?.parking_zone,
      micro?.parking_status,
      ai?.parking,
    ),
  )
  const noise = joinBucket(
    firstAvailable(micro?.noise, micro?.buka, micro?.noise_level, ai?.noise),
  )

  return {
    transport,
    schools,
    parking,
    noise,
    hasAny: Boolean(transport || schools || parking || noise),
  }
}

function parseFaqs(ai: Record<string, unknown> | null): FaqDetailItem[] {
  const raw = firstAvailable(ai?.dinamička_pitanja, ai?.dynamic_faq, ai?.faqs)
  if (!Array.isArray(raw)) return []

  const items: FaqDetailItem[] = []
  for (const entry of raw) {
    if (!isRecord(entry)) continue
    const question = asString(firstAvailable(entry.pitanje, entry.question))
    const answer = asString(firstAvailable(entry.odgovor, entry.answer))
    if (!question || !answer) continue
    items.push({ question, answer })
  }
  return items
}

function resolveSizeLabel(
  listing: ListingDisplay,
  ai: Record<string, unknown> | null,
): string {
  const direct = asFiniteNumber(
    firstAvailable(
      ai?.m2,
      ai?.area_m2,
      ai?.kvadratura,
      ai?.surface_area,
      isRecord(ai?.surface_area) ? ai.surface_area.sqm : null,
      isRecord(ai?.surface_area) ? ai.surface_area.m2 : null,
    ),
  )
  if (direct !== null && direct > 0) {
    return `${new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(direct)} m²`
  }

  if (
    listing.priceEur !== null &&
    listing.priceEur > 0 &&
    listing.pricePerSqm !== null &&
    listing.pricePerSqm > 0
  ) {
    const derived = Math.round(listing.priceEur / listing.pricePerSqm)
    if (derived > 0) {
      return `${new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 }).format(derived)} m²`
    }
  }

  return '—'
}

function resolveFloorLabel(ai: Record<string, unknown> | null): string {
  const floor = asString(
    firstAvailable(
      ai?.floor,
      ai?.sprat,
      ai?.floor_number,
      ai?.spratnost,
      isRecord(ai?.specs) ? ai.specs.floor : null,
      isRecord(ai?.specs) ? ai.specs.sprat : null,
    ),
  )
  return floor || '—'
}

function resolveRegistrationLabel(ai: Record<string, unknown> | null): string {
  const legalSr = isRecord(ai?.pravne_i_tehničke_provere)
    ? ai.pravne_i_tehničke_provere
    : null
  const legalEn = isRecord(ai?.legal_and_technical_checks)
    ? ai.legal_and_technical_checks
    : null

  const text = asString(
    firstAvailable(
      legalSr?.uknjiženost,
      legalEn?.registration_status,
      ai?.uknjiženost,
      ai?.registration_status,
    ),
  )
  if (text) return text

  const flag = asBoolean(ai?.is_registered)
  if (flag === true) return 'Uknjiženo'
  if (flag === false) return 'Nije uknjiženo'

  return '—'
}

export function parseAiAnalysisDetail(
  listing: ListingDisplay,
): AnalysisDetailViewModel {
  const ai = listing.aiAnalysis
  const locationLabel =
    [listing.city, listing.neighborhood].filter(Boolean).join(' · ') ||
    'Lokacija nije dostupna'

  return {
    title: listing.title,
    portalUrl: listing.portalUrl,
    locationLabel,
    quickSpecs: {
      totalPriceLabel: formatEuro(listing.priceEur),
      sizeLabel: resolveSizeLabel(listing, ai),
      pricePerSqmLabel: formatEuroPerSqm(listing.pricePerSqm),
      floorLabel: resolveFloorLabel(ai),
      registrationLabel: resolveRegistrationLabel(ai),
    },
    contact: parseContact(listing),
    finances: parseFinances(ai, listing),
    redFlags: parseRedFlags(ai),
    negotiation: parseNegotiation(ai, listing.priceEur),
    microlocation: parseMicrolocation(ai),
    faqs: parseFaqs(ai),
    hasAiAnalysis: ai !== null,
  }
}
