import type {
  ContactDetails,
  ListingDisplay,
  SavedListingRow,
} from '@/lib/dashboard/types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  return null
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/\s/g, '').replace(',', '.'))
    if (Number.isFinite(parsed)) return parsed
  }
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

function looksLikeOwner(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  if (!normalized) return false
  return (
    normalized.includes('vlasnik') ||
    normalized.includes('direktno od vlasnika') ||
    normalized === 'owner' ||
    normalized === 'private'
  )
}

function parseLocation(locationName: string | null): {
  city: string | null
  neighborhood: string | null
} {
  if (!locationName?.trim()) {
    return { city: null, neighborhood: null }
  }

  const parts = locationName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return { city: null, neighborhood: null }
  }

  if (parts.length === 1) {
    return { city: parts[0], neighborhood: null }
  }

  return {
    city: parts[0],
    neighborhood: parts.slice(1).join(', '),
  }
}

export function extractContactDetails(
  aiAnalysis: Record<string, unknown> | null,
): ContactDetails | null {
  if (!aiAnalysis) return null

  const nested = isRecord(aiAnalysis.contact_details)
    ? aiAnalysis.contact_details
    : null
  const contact = isRecord(aiAnalysis.contact) ? aiAnalysis.contact : null

  const agency_name = asString(
    firstAvailable(
      nested?.agency_name,
      contact?.agency_name,
      contact?.agency,
      aiAnalysis.agency_name,
    ),
  )
  const phone_number = asString(
    firstAvailable(
      nested?.phone_number,
      contact?.phone_number,
      contact?.phone,
      aiAnalysis.phone_number,
      aiAnalysis.phone,
    ),
  )
  const contact_email = asString(
    firstAvailable(
      nested?.contact_email,
      contact?.contact_email,
      contact?.email,
      aiAnalysis.contact_email,
    ),
  )
  const advertiser_type = asString(
    firstAvailable(
      nested?.advertiser_type,
      contact?.advertiser_type,
      aiAnalysis.advertiser_type,
    ),
  )

  const isOwnerFlag = asBoolean(
    firstAvailable(nested?.is_owner, contact?.is_owner, aiAnalysis.is_owner),
  )

  if (
    !agency_name &&
    !phone_number &&
    !contact_email &&
    !advertiser_type &&
    isOwnerFlag === null
  ) {
    return null
  }

  return {
    agency_name,
    phone_number,
    contact_email,
    is_owner: isOwnerFlag ?? false,
    advertiser_type,
  }
}

export function extractPricePerSqm(
  aiAnalysis: Record<string, unknown> | null,
): number | null {
  if (!aiAnalysis) return null

  const financials = isRecord(aiAnalysis.financials) ? aiAnalysis.financials : null
  const valuation = isRecord(aiAnalysis.valuation) ? aiAnalysis.valuation : null
  const valuationSr = isRecord(aiAnalysis.procena_vrednosti)
    ? aiAnalysis.procena_vrednosti
    : null

  return asFiniteNumber(
    firstAvailable(
      financials?.price_per_sqm,
      valuation?.price_per_sqm,
      valuation?.price_per_m2,
      valuationSr?.cena_po_m2,
      aiAnalysis.price_per_sqm,
      aiAnalysis.price_per_m2,
    ),
  )
}

function resolveIsOwner(
  listingIsOwner: boolean | null,
  contactDetails: ContactDetails | null,
  aiAnalysis: Record<string, unknown> | null,
): boolean {
  if (listingIsOwner === true) return true
  if (contactDetails?.is_owner === true) return true

  const financials = isRecord(aiAnalysis?.financials) ? aiAnalysis.financials : null
  const sellerType = asString(
    firstAvailable(
      contactDetails?.advertiser_type,
      financials?.seller_type,
      aiAnalysis?.advertiser_type,
      aiAnalysis?.seller_type,
    ),
  )

  if (looksLikeOwner(sellerType)) return true
  if (listingIsOwner === false) return false
  return false
}

export function parseListingDisplay(row: SavedListingRow): ListingDisplay | null {
  const listing = row.listing
  if (!listing) return null

  const aiAnalysis = isRecord(listing.ai_analysis) ? listing.ai_analysis : null
  const contactDetails = extractContactDetails(aiAnalysis)
  const { city, neighborhood } = parseLocation(listing.location_name)
  const isOwner = resolveIsOwner(listing.is_owner, contactDetails, aiAnalysis)

  return {
    savedId: row.id,
    listingId: listing.id,
    title: listing.title?.trim() || 'Bez naslova',
    priceEur: asFiniteNumber(listing.price_at_scan),
    pricePerSqm: extractPricePerSqm(aiAnalysis),
    city,
    neighborhood,
    isOwner,
    advertiserLabel: isOwner ? 'Vlasnik' : 'Agencija',
    portalUrl: listing.portal_url,
    contactDetails,
    aiAnalysis,
    status: row.status,
    savedAt: row.saved_at,
  }
}

export function parseSavedListings(rows: SavedListingRow[]): ListingDisplay[] {
  const parsed: ListingDisplay[] = []

  for (const row of rows) {
    const item = parseListingDisplay(row)
    if (item) parsed.push(item)
  }

  return parsed
}

export function formatEuro(value: number | null): string {
  if (value === null) return '—'
  return `${new Intl.NumberFormat('sr-RS', {
    maximumFractionDigits: 0,
  }).format(value)} €`
}

export function formatEuroPerSqm(value: number | null): string {
  if (value === null) return '— €/m²'
  return `${new Intl.NumberFormat('sr-RS', {
    maximumFractionDigits: 0,
  }).format(value)} €/m²`
}
